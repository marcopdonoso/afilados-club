import { beforeEach, expect, test, vi } from "vitest";
import { revalidatePath } from "next/cache";
import { requireClubMember } from "@/lib/auth/member";
import { createClient } from "@/lib/supabase/server";
import { createActivity, editActivity, deleteActivity } from "./actions";

vi.mock("@/lib/auth/member", () => ({ requireClubMember: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const id = "00000000-0000-4000-8000-000000000001";
const memberId = "00000000-0000-4000-8000-000000000011";
const input = {
  status: "tentative",
  category: "cine",
  title: " Película ",
  start_date: "2026-12-05",
};
const from = vi.fn();
function query(data: unknown, error: unknown = null) {
  const result = { data, error };
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(result),
    then: (resolve: (value: typeof result) => unknown) =>
      Promise.resolve(result).then(resolve),
  };
  from.mockReturnValueOnce(chain);
  return chain;
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(requireClubMember).mockResolvedValue({
    id: memberId,
    display_name: "Fixture",
  });
  vi.mocked(createClient).mockResolvedValue({ from } as unknown as NonNullable<
    Awaited<ReturnType<typeof createClient>>
  >);
});
test.each([
  () => createActivity(input),
  () => editActivity({ id, ...input }),
  () => deleteActivity(id),
])("actions authorize before any validation or client", async (call) => {
  const denied = new Error("NEXT_REDIRECT");
  vi.mocked(requireClubMember).mockRejectedValueOnce(denied);
  await expect(call()).rejects.toBe(denied);
  expect(createClient).not.toHaveBeenCalled();
});
test("create sends only granted inputs, database defaults identity and season", async () => {
  const write = query([{ id }]);
  expect(await createActivity(input)).toEqual({ ok: true });
  expect(write.insert).toHaveBeenCalledWith({
    category: "cine",
    title: "Película",
    description: null,
    status: "tentative",
    source_idea_id: null,
    start_date: "2026-12-05",
    end_date: "2026-12-05",
    start_time: null,
    end_time: null,
  });
  expect(write.select).toHaveBeenCalledWith("id");
  expect(vi.mocked(revalidatePath).mock.calls).toEqual([
    ["/calendario"],
    ["/afiladero"],
    ["/"],
  ]);
});
test.each([
  { created_by: memberId },
  { season_year: 2027 },
  { id },
  { status: "cancelled" },
  { start_date: "2026-12-21" },
  { start_time: "22:00", end_time: "02:00" },
  { category: "other" },
])("strict create denies invalid input %j", async (changes) => {
  expect((await createActivity({ ...input, ...changes })).ok).toBe(false);
  expect(from).not.toHaveBeenCalled();
});
test("promotion checks same-season idea without vote threshold and copies user-edited content", async () => {
  const source = query({ id });
  const write = query([{ id }]);
  expect(await createActivity({ ...input, source_idea_id: id })).toEqual({
    ok: true,
  });
  expect(source.eq.mock.calls).toEqual([
    ["id", id],
    ["season_year", 2026],
  ]);
  expect(write.insert).toHaveBeenCalledWith(
    expect.objectContaining({ title: "Película", source_idea_id: id }),
  );
  expect(from.mock.calls.map(([table]) => table)).toEqual([
    "activity_ideas",
    "season_activities",
  ]);
});
test("missing/wrong-season source and source read error never insert", async () => {
  query(null);
  expect((await createActivity({ ...input, source_idea_id: id })).ok).toBe(
    false,
  );
  query({ id }, { code: "private" });
  expect((await createActivity({ ...input, source_idea_id: id })).ok).toBe(
    false,
  );
  expect(from).toHaveBeenCalledTimes(2);
});
test("promotion unique race returns safe Spanish copy, no duplicate retry or raw error", async () => {
  query({ id });
  query(null, { code: "23505", message: "private details" });
  expect(await createActivity({ ...input, source_idea_id: id })).toEqual({
    ok: false,
    error:
      "ESTA IDEA YA ESTÁ EN EL CALENDARIO. Actualiza la página para ver el plan.",
  });
  expect(revalidatePath).not.toHaveBeenCalled();
});
test.each(["edit", "delete"])(
  "creator/admin can %s, another member cannot",
  async (operation) => {
    const call = () =>
      operation === "edit"
        ? editActivity({ id, ...input, status: "cancelled" })
        : deleteActivity(id);
    query({ id, created_by: memberId });
    const own = query([{ id }]);
    expect(await call()).toEqual({ ok: true });
    expect(own.eq.mock.calls).toEqual([
      ["id", id],
      ["season_year", 2026],
    ]);
    if (operation === "edit")
      expect(own.update).toHaveBeenCalledWith({
        category: "cine",
        title: "Película",
        description: null,
        status: "cancelled",
        start_date: "2026-12-05",
        end_date: "2026-12-05",
        start_time: null,
        end_time: null,
      });
    query({ id, created_by: "other" });
    const role = query({ role: "admin" });
    query([{ id }]);
    expect(await call()).toEqual({ ok: true });
    expect(role.eq).toHaveBeenCalledWith("is_active", true);
    vi.mocked(revalidatePath).mockClear();
    query({ id, created_by: "other" });
    query({ role: "member" });
    expect((await call()).ok).toBe(false);
    expect(revalidatePath).not.toHaveBeenCalled();
  },
);
test.each(["edit", "delete"])(
  "%s handles disappeared rows and failures without success",
  async (operation) => {
    const call = () =>
      operation === "edit"
        ? editActivity({ id, ...input })
        : deleteActivity(id);
    query(null);
    expect((await call()).ok).toBe(false);
    query({ id, created_by: memberId });
    query([]);
    expect((await call()).ok).toBe(false);
    query({ id, created_by: "other" });
    query({ role: "admin" }, { code: "private" });
    expect((await call()).ok).toBe(false);
    expect(revalidatePath).not.toHaveBeenCalled();
  },
);
test.each([
  { source_idea_id: id },
  { season_year: 2027 },
  { created_at: "now" },
  { created_by: id },
])("edit rejects immutable fields %j", async (changes) => {
  expect((await editActivity({ id, ...input, ...changes })).ok).toBe(false);
  expect(from).not.toHaveBeenCalled();
});
test("invalid deletion, missing client, exceptions and write errors fail safely", async () => {
  expect((await deleteActivity({ id })).ok).toBe(false);
  vi.mocked(createClient).mockResolvedValueOnce(null);
  expect((await createActivity(input)).ok).toBe(false);
  vi.mocked(createClient).mockRejectedValueOnce(new Error("private"));
  expect((await createActivity(input)).ok).toBe(false);
  query(null, { message: "private" });
  expect(await createActivity(input)).toEqual({
    ok: false,
    error: "NO SE PUDO GUARDAR LA ACTIVIDAD. Inténtalo otra vez.",
  });
});
