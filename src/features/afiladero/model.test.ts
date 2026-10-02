import { describe, expect, test } from "vitest";

import {
  categories,
  composeIdeas,
  ideaInputSchema,
  sortIdeas,
  type IdeaRow,
} from "./model";

export const ideaFixture: IdeaRow = {
  id: "00000000-0000-4000-8000-000000000001",
  season_year: 2026,
  proposed_by: "00000000-0000-4000-8000-000000000011",
  category: "camping",
  title: "Camping en Toro Toro",
  description: "Una noche y cero señal.",
  created_at: "2026-10-02T12:00:00Z",
};

test("one typed category map defines all ten labels and icons", () => {
  expect(Object.keys(categories)).toEqual([
    "parrillada",
    "bar",
    "concierto",
    "camping",
    "juegos",
    "excursion",
    "restaurante",
    "road_trip",
    "cine",
    "cuestionable",
  ]);
  expect(Object.values(categories).map(({ label }) => label)).toEqual([
    "PARRILLADA",
    "BAR",
    "CONCIERTO",
    "CAMPING",
    "JUEGOS",
    "EXCURSIÓN",
    "RESTAURANTE",
    "ROAD TRIP",
    "CINE",
    "IDEA CUESTIONABLE",
  ]);
  expect(Object.values(categories).every(({ icon }) => icon)).toBe(true);
});

describe("shared create/edit validation", () => {
  test("trims input and converts an empty description to null", () => {
    expect(
      ideaInputSchema.parse({
        category: "camping",
        title: "  Plan  ",
        description: " \n ",
      }),
    ).toEqual({
      category: "camping",
      title: "Plan",
      description: null,
    });
  });
  test.each([
    { title: "ab" },
    { title: "x".repeat(81) },
    { title: "   " },
    { category: "unknown" },
    { description: "x".repeat(401) },
    { proposed_by: ideaFixture.proposed_by },
    { season_year: 2027 },
    { role: "admin" },
  ])("rejects invalid content or browser-owned identity: %j", (override) => {
    expect(
      ideaInputSchema.safeParse({
        category: "bar",
        title: "Plan",
        description: "",
        ...override,
      }).success,
    ).toBe(false);
  });
  test("accepts exact trimmed bounds including Unicode characters", () => {
    expect(
      ideaInputSchema.safeParse({
        category: "cine",
        title: "x".repeat(80),
        description: "x".repeat(400),
      }).success,
    ).toBe(true);
    expect(
      ideaInputSchema.safeParse({
        category: "cine",
        title: "🎬🎬🎬",
        description: null,
      }).success,
    ).toBe(true);
    expect(
      ideaInputSchema.safeParse({
        category: "cine",
        title: "🎬🎬",
        description: null,
      }).success,
    ).toBe(false);
  });
});

test("composition counts all votes and finds caller vote without exposing roster roles", () => {
  const [idea] = composeIdeas(
    [ideaFixture],
    [
      {
        idea_id: ideaFixture.id,
        member_id: ideaFixture.proposed_by,
        vote: "maybe",
      },
      { idea_id: ideaFixture.id, member_id: "other", vote: "in" },
      { idea_id: "other-idea", member_id: "other", vote: "pass" },
    ],
    [{ id: ideaFixture.proposed_by, display_name: "Fixture" }],
    ideaFixture.proposed_by,
  );
  expect(idea.counts).toEqual({ in: 1, maybe: 1, pass: 0 });
  expect(idea.currentVote).toBe("maybe");
  expect(idea.author).toBe("Fixture");
  expect(composeIdeas([ideaFixture], [], [], "other")[0].author).toBe(
    "Miembro de otra expedición",
  );
  expect(composeIdeas([], [], [], "other")).toEqual([]);
});

test("most committed uses in, maybe, then date; newest uses only date and does not mutate", () => {
  const ideas = composeIdeas(
    [
      ideaFixture,
      { ...ideaFixture, id: "b", created_at: "2026-10-03T12:00:00Z" },
      { ...ideaFixture, id: "c", created_at: "2026-10-04T12:00:00Z" },
      { ...ideaFixture, id: "d", created_at: "2026-10-05T12:00:00Z" },
    ],
    [],
    [],
    "caller",
  );
  ideas[0].counts = { in: 2, maybe: 0, pass: 20 };
  ideas[1].counts = { in: 1, maybe: 2, pass: 0 };
  ideas[2].counts = { in: 1, maybe: 2, pass: 9 };
  ideas[3].counts = { in: 1, maybe: 1, pass: 0 };
  expect(sortIdeas(ideas, "most").map(({ id }) => id)).toEqual([
    ideaFixture.id,
    "c",
    "b",
    "d",
  ]);
  expect(sortIdeas(ideas, "newest").map(({ id }) => id)).toEqual([
    "d",
    "c",
    "b",
    ideaFixture.id,
  ]);
  expect(ideas[0].id).toBe(ideaFixture.id);
});
