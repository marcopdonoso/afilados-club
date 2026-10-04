import { beforeEach, expect, test, vi } from "vitest";
import { requireClubMember } from "@/lib/auth/member";
import { createClient } from "@/lib/supabase/server";
import { loadCalendar } from "./load";
import { activityColumns } from "./model";
vi.mock("@/lib/auth/member", () => ({ requireClubMember: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
const from = vi.fn();
function query(data: unknown, error: unknown = null) {
  const result = { data, error };
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
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
    id: "member",
    display_name: "Fixture",
  });
  vi.mocked(createClient).mockResolvedValue({ from } as unknown as NonNullable<
    Awaited<ReturnType<typeof createClient>>
  >);
});
test("loader independently authorizes before reading session data", async () => {
  const denied = new Error("NEXT_REDIRECT");
  vi.mocked(requireClubMember).mockRejectedValueOnce(denied);
  await expect(loadCalendar()).rejects.toBe(denied);
  expect(createClient).not.toHaveBeenCalled();
});
test("valid empty results are real empty; query is current-season/narrow and roster active", async () => {
  const activities = query([]);
  const roster = query([]);
  const own = query({ role: "admin" });
  expect(await loadCalendar()).toEqual({ activities: [], isAdmin: true });
  expect(activities.select).toHaveBeenCalledWith(activityColumns);
  expect(activities.eq).toHaveBeenCalledWith("season_year", 2026);
  expect(roster.eq).toHaveBeenCalledWith("is_active", true);
  expect(own.eq).toHaveBeenCalledWith("id", "member");
});
test("creator names resolve only from the active roster and sorting is deterministic", async () => {
  query([
    {
      id: "b",
      created_by: "inactive",
      start_date: "2026-12-06",
      start_time: null,
      created_at: "2026-10-01",
    },
    {
      id: "a",
      created_by: "member",
      start_date: "2026-12-05",
      start_time: "12:00",
      created_at: "2026-10-01",
    },
  ]);
  query([{ id: "member", display_name: "Fixture" }]);
  query({ role: "member" });
  const { activities } = await loadCalendar();
  expect(activities.map(({ id, creator }) => [id, creator])).toEqual([
    ["a", "Fixture"],
    ["b", "Miembro de otra expedición"],
  ]);
});
test.each([0, 1, 2])(
  "read failure %s must not fabricate zeros",
  async (failed) => {
    for (let index = 0; index < 3; index++)
      query(
        index === 2 ? { role: "member" } : [],
        index === failed ? { message: "private" } : null,
      );
    await expect(loadCalendar()).rejects.toThrow("Calendar unavailable");
  },
);
test("missing client/data/role and thrown client fail", async () => {
  vi.mocked(createClient).mockResolvedValueOnce(null);
  await expect(loadCalendar()).rejects.toThrow();
  query(null);
  query([]);
  query({ role: "member" });
  await expect(loadCalendar()).rejects.toThrow();
  query([]);
  query([]);
  query(null);
  await expect(loadCalendar()).rejects.toThrow();
});
