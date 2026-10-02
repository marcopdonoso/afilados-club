import { beforeEach, expect, test, vi } from "vitest";

import { season } from "@/features/season/model";
import { requireClubMember } from "@/lib/auth/member";
import { createClient } from "@/lib/supabase/server";

import {
  createIdea,
  deleteIdea,
  editIdea,
  removeVote,
  voteIdea,
} from "./actions";

vi.mock("@/lib/auth/member", () => ({ requireClubMember: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { revalidatePath } from "next/cache";

const memberId = "00000000-0000-4000-8000-000000000011";
const ideaId = "00000000-0000-4000-8000-000000000001";
const content = {
  category: "camping",
  title: "  Camping  ",
  description: "  ",
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
  () => createIdea(content),
  () => editIdea({ id: ideaId, ...content }),
  () => deleteIdea(ideaId),
  () => voteIdea({ ideaId, vote: "in" }),
  () => removeVote(ideaId),
])("every action authorizes before accessing its client", async (call) => {
  const denied = new Error("NEXT_REDIRECT");
  vi.mocked(requireClubMember).mockRejectedValueOnce(denied);
  await expect(call()).rejects.toBe(denied);
  expect(createClient).not.toHaveBeenCalled();
  expect(revalidatePath).not.toHaveBeenCalled();
});

test("creation sends only permitted columns, season comes from server and identity is defaulted", async () => {
  const write = query([{ id: ideaId }]);
  expect(await createIdea(content)).toEqual({ ok: true });
  expect(write.insert).toHaveBeenCalledWith({
    category: "camping",
    title: "Camping",
    description: null,
    season_year: season.year,
  });
  expect(write.select).toHaveBeenCalledWith("id");
  expect(revalidatePath).toHaveBeenCalledWith("/afiladero");
});

test.each([
  { ...content, title: "ab" },
  { ...content, category: "other" },
  { ...content, description: "x".repeat(401) },
  { ...content, proposed_by: memberId },
  { ...content, season_year: 2027 },
  { ...content, role: "admin" },
])("invalid/spoofed creation does not write: %j", async (input) => {
  expect((await createIdea(input)).ok).toBe(false);
  expect(from).not.toHaveBeenCalled();
});

test("editing scopes by current author and season and never changes immutable columns", async () => {
  const write = query([{ id: ideaId }]);
  expect(await editIdea({ id: ideaId, ...content })).toEqual({ ok: true });
  expect(write.update).toHaveBeenCalledWith({
    category: "camping",
    title: "Camping",
    description: null,
  });
  expect(write.eq.mock.calls).toEqual([
    ["id", ideaId],
    ["season_year", season.year],
    ["proposed_by", memberId],
  ]);
});

test("editing someone else's idea or a disappeared row fails rather than claiming success", async () => {
  query([]);
  expect((await editIdea({ id: ideaId, ...content })).ok).toBe(false);
  expect(revalidatePath).not.toHaveBeenCalled();
});

test.each([
  { id: "bad", ...content },
  { id: ideaId, ...content, title: "ab" },
  { id: ideaId, ...content, category: "other" },
  { id: ideaId, ...content, description: "x".repeat(401) },
  { id: ideaId, ...content, proposed_by: memberId },
  { id: ideaId, ...content, season_year: 2027 },
])("invalid/spoofed edit cannot reach the DB: %j", async (input) => {
  expect((await editIdea(input)).ok).toBe(false);
  expect(from).not.toHaveBeenCalled();
});

test.each([deleteIdea, removeVote])(
  "invalid ID-only action cannot reach the DB",
  async (action) => {
    expect((await action({ id: ideaId, role: "admin" })).ok).toBe(false);
    expect(from).not.toHaveBeenCalled();
  },
);

test("author can delete and active admin can delete but ordinary non-author cannot", async () => {
  query({ id: ideaId, proposed_by: memberId });
  const own = query([{ id: ideaId }]);
  expect(await deleteIdea(ideaId)).toEqual({ ok: true });
  expect(own.eq).toHaveBeenCalledWith("season_year", season.year);
  from.mockClear();
  query({ id: ideaId, proposed_by: "other" });
  const role = query({ role: "admin" });
  query([{ id: ideaId }]);
  expect(await deleteIdea(ideaId)).toEqual({ ok: true });
  expect(role.eq.mock.calls).toEqual([
    ["id", memberId],
    ["is_active", true],
  ]);
  vi.mocked(revalidatePath).mockClear();
  query({ id: ideaId, proposed_by: "other" });
  query({ role: "member" });
  expect((await deleteIdea(ideaId)).ok).toBe(false);
  expect(revalidatePath).not.toHaveBeenCalled();
});

test("deletion detects zero affected rows after authorization", async () => {
  query({ id: ideaId, proposed_by: memberId });
  query([]);
  expect(await deleteIdea(ideaId)).toEqual({
    ok: false,
    error: "NO SE PUDO ELIMINAR.",
  });
  expect(revalidatePath).not.toHaveBeenCalled();
});

test("new vote defaults member identity, change updates only vote, selected removal is own-scoped", async () => {
  const idea = query({ id: ideaId });
  query(null);
  const insert = query([{ idea_id: ideaId }]);
  expect(await voteIdea({ ideaId, vote: "in" })).toEqual({ ok: true });
  expect(idea.eq).toHaveBeenCalledWith("season_year", season.year);
  expect(insert.insert).toHaveBeenCalledWith({ idea_id: ideaId, vote: "in" });
  query({ id: ideaId });
  query({ vote: "in" });
  const update = query([{ idea_id: ideaId }]);
  expect(await voteIdea({ ideaId, vote: "maybe" })).toEqual({ ok: true });
  expect(update.update).toHaveBeenCalledWith({ vote: "maybe" });
  expect(update.eq.mock.calls).toEqual([
    ["idea_id", ideaId],
    ["member_id", memberId],
  ]);
  query({ id: ideaId });
  const remove = query([{ idea_id: ideaId }]);
  expect(await removeVote(ideaId)).toEqual({ ok: true });
  expect(remove.eq.mock.calls).toEqual([
    ["idea_id", ideaId],
    ["member_id", memberId],
  ]);
});

test("concurrent insert conflict retries only the caller's vote-only update", async () => {
  query({ id: ideaId });
  query(null);
  query(null, { code: "23505" });
  const update = query([{ idea_id: ideaId }]);
  expect(await voteIdea({ ideaId, vote: "pass" })).toEqual({ ok: true });
  expect(update.update).toHaveBeenCalledWith({ vote: "pass" });
  expect(update.eq).toHaveBeenCalledWith("member_id", memberId);
});

test.each([
  { ideaId: "bad", vote: "in" },
  { ideaId, vote: "other" },
  { ideaId, vote: "in", member_id: memberId },
])("invalid vote cannot reach the DB: %j", async (input) => {
  expect((await voteIdea(input)).ok).toBe(false);
  expect(from).not.toHaveBeenCalled();
});

test("missing season idea and missing own vote never return success", async () => {
  query(null);
  expect((await voteIdea({ ideaId, vote: "in" })).ok).toBe(false);
  query({ id: ideaId });
  query([]);
  expect((await removeVote(ideaId)).ok).toBe(false);
  expect(revalidatePath).not.toHaveBeenCalled();
});

test("vote read error and zero-row update do not insert or report success", async () => {
  query({ id: ideaId });
  query(null, { message: "read failed" });
  expect((await voteIdea({ ideaId, vote: "in" })).ok).toBe(false);
  expect(from).toHaveBeenCalledTimes(2);
  query({ id: ideaId });
  query({ vote: "in" });
  query([]);
  expect((await voteIdea({ ideaId, vote: "maybe" })).ok).toBe(false);
  expect(revalidatePath).not.toHaveBeenCalled();
});

test("missing idea and role-query failure prevent deletion", async () => {
  query(null);
  expect((await deleteIdea(ideaId)).ok).toBe(false);
  query({ id: ideaId, proposed_by: "other" });
  query({ role: "admin" }, { message: "role failed" });
  expect((await deleteIdea(ideaId)).ok).toBe(false);
  expect(revalidatePath).not.toHaveBeenCalled();
});

test("DB failures, exceptions and missing client use generic Spanish copy", async () => {
  query(null, { message: "private DB detail" });
  expect(await createIdea(content)).toEqual({
    ok: false,
    error: "NO SE PUDO LANZAR LA IDEA. Inténtalo otra vez.",
  });
  vi.mocked(createClient).mockRejectedValueOnce(
    new Error("private connection detail"),
  );
  expect(await voteIdea({ ideaId, vote: "in" })).toEqual({
    ok: false,
    error: "ESE VOTO NO ENTRÓ. Inténtalo nuevamente.",
  });
  vi.mocked(createClient).mockResolvedValueOnce(null);
  expect((await editIdea({ id: ideaId, ...content })).ok).toBe(false);
  expect(revalidatePath).not.toHaveBeenCalled();
});
