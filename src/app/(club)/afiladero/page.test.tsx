// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

import { requireClubMember } from "@/lib/auth/member";
import { createClient } from "@/lib/supabase/server";
import { season } from "@/features/season/model";

import AfiladeroPage from "./page";

vi.mock("@/lib/auth/member", () => ({ requireClubMember: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("./actions", () => ({
  createIdea: vi.fn(),
  editIdea: vi.fn(),
  deleteIdea: vi.fn(),
  voteIdea: vi.fn(),
  removeVote: vi.fn(),
}));

const from = vi.fn();
const memberId = "00000000-0000-4000-8000-000000000011";
function query(data: unknown, error: unknown = null) {
  const result = { data, error };
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
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

test("page independently requires membership, not only layout", async () => {
  const denied = new Error("NEXT_REDIRECT");
  vi.mocked(requireClubMember).mockRejectedValueOnce(denied);
  await expect(
    AfiladeroPage({ searchParams: Promise.resolve({}) }),
  ).rejects.toBe(denied);
  expect(createClient).not.toHaveBeenCalled();
});

test("loads current season, active roster and own role; valid empty ideas skip vote query", async () => {
  const ideas = query([]);
  const roster = query([{ id: memberId, display_name: "Fixture" }]);
  const role = query({ role: "admin" });
  render(
    await AfiladeroPage({ searchParams: Promise.resolve({ order: "newest" }) }),
  );
  expect(ideas.eq).toHaveBeenCalledWith("season_year", season.year);
  expect(roster.select).toHaveBeenCalledWith("id,display_name");
  expect(roster.eq).toHaveBeenCalledWith("is_active", true);
  expect(role.eq).toHaveBeenCalledWith("id", memberId);
  expect(role.eq).toHaveBeenCalledWith("is_active", true);
  expect(from.mock.calls.map(([table]) => table)).toEqual([
    "activity_ideas",
    "club_members",
    "club_members",
  ]);
  expect(screen.getByText("TODAVÍA NO HAY NADA QUE DISCUTIR.")).toBeVisible();
  expect(screen.getByRole("link", { name: "NUEVAS" })).toHaveAttribute(
    "aria-current",
    "page",
  );
});

test("votes are restricted to loaded idea IDs and composed into real stats", async () => {
  const id = "00000000-0000-4000-8000-000000000001";
  query([
    {
      id,
      proposed_by: memberId,
      season_year: season.year,
      category: "cine",
      title: "Una película",
      description: null,
      created_at: "2026-10-02T12:00:00Z",
    },
  ]);
  query([
    { id: memberId, display_name: "Fixture" },
    { id: "other", display_name: "Other" },
  ]);
  query({ role: "member" });
  const votes = query([{ idea_id: id, member_id: memberId, vote: "in" }]);
  const scheduled = query([
    {
      id: "scheduled",
      source_idea_id: id,
      start_date: "2026-12-05",
      status: "confirmed",
    },
  ]);
  render(
    await AfiladeroPage({
      searchParams: Promise.resolve({ order: "invalid" }),
    }),
  );
  expect(votes.in).toHaveBeenCalledWith("idea_id", [id]);
  expect(scheduled.in).toHaveBeenCalledWith("source_idea_id", [id]);
  expect(
    screen.getByRole("link", { name: "EN CALENDARIO · 5 DIC" }),
  ).toHaveAttribute("href", "/calendario#activity-scheduled");
  expect(screen.getByLabelText("Datos del Afiladero")).toHaveTextContent(
    "IDEAS1VOTOS1MIEMBROS2",
  );
  expect(screen.getByRole("link", { name: "MÁS AFILADAS" })).toHaveAttribute(
    "aria-current",
    "page",
  );
});

test.each(["ideas", "roster", "role", "votes", "scheduled"])(
  "%s load failure is not an empty board or fake zero stats",
  async (failed) => {
    query(
      failed === "votes" || failed === "scheduled" ? [{ id: "idea" }] : [],
      failed === "ideas" ? { message: "private" } : null,
    );
    query([], failed === "roster" ? { message: "private" } : null);
    query(
      { role: "member" },
      failed === "role" ? { message: "private" } : null,
    );
    if (failed === "votes") query(null, { message: "private" });
    if (failed === "scheduled") {
      query([]);
      query(null, { message: "private" });
    }
    render(await AfiladeroPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "NO SE PUDO ABRIR EL AFILADERO",
    );
    expect(
      screen.queryByLabelText("Datos del Afiladero"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("TODAVÍA NO HAY NADA QUE DISCUTIR."),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("private")).not.toBeInTheDocument();
  },
);

test("missing client and thrown loader errors fail visibly", async () => {
  vi.mocked(createClient).mockResolvedValueOnce(null);
  render(await AfiladeroPage({ searchParams: Promise.resolve({}) }));
  expect(screen.getByRole("alert")).toBeVisible();
});
