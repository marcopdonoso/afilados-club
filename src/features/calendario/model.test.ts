import { expect, test } from "vitest";

import {
  activityCreateSchema,
  activityEditSchema,
  calendarDates,
  calendarMetrics,
  coveredDates,
  formatActivityRange,
  getCalendarToday,
  sortActivities,
  type Activity,
} from "./model";

const base = {
  category: "camping",
  title: "  Camping  ",
  description: " ",
  status: "tentative",
  start_date: "2026-11-28",
};
const row: Activity = {
  id: "00000000-0000-4000-8000-000000000001",
  season_year: 2026,
  created_by: "member",
  creator: "Fixture",
  source_idea_id: null,
  category: "camping",
  title: "Camping",
  description: null,
  status: "tentative",
  start_date: "2026-11-28",
  end_date: "2026-11-28",
  start_time: null,
  end_time: null,
  created_at: "2026-10-01T12:00:00Z",
};

test("23 chronological plan dates cross months, starting on Saturday", () => {
  expect(calendarDates).toHaveLength(23);
  expect(calendarDates[0]).toEqual({
    date: "2026-11-28",
    weekday: "SÁB",
    label: "28 NOV",
  });
  expect(calendarDates[3]).toEqual({
    date: "2026-12-01",
    weekday: "MAR",
    label: "1 DIC",
  });
  expect(calendarDates.at(-1)).toEqual({
    date: "2026-12-20",
    weekday: "DOM",
    label: "20 DIC",
  });
  expect(new Set(calendarDates.map(({ date }) => date)).size).toBe(23);
});

test.each([
  ["2026-11-29T03:59:59Z", "2026-11-28"],
  ["2026-11-29T04:00:00Z", "2026-11-29"],
  ["2026-11-27T23:00:00-04:00", null],
  ["2026-12-21T01:00:00-04:00", null],
])(
  "today in La Paz at %s is %s, regardless of device zone",
  (instant, today) => {
    expect(getCalendarToday(Date.parse(instant))).toBe(today);
  },
);

test("coverage includes every covered plan date, not departure", () => {
  expect(coveredDates({ ...row, end_date: "2026-12-01" })).toEqual([
    "2026-11-28",
    "2026-11-29",
    "2026-11-30",
    "2026-12-01",
  ]);
  expect(
    coveredDates({ ...row, start_date: "2026-12-20", end_date: "2026-12-21" }),
  ).toEqual(["2026-12-20"]);
});

test("real metrics count activities once and occupied dates once; cancelled stays free", () => {
  expect(calendarMetrics([])).toEqual({ scheduled: 0, confirmed: 0, free: 23 });
  expect(
    calendarMetrics([
      { ...row, end_date: "2026-11-30", status: "confirmed" },
      {
        ...row,
        id: "second",
        start_date: "2026-11-29",
        end_date: "2026-11-29",
      },
      {
        ...row,
        id: "cancelled",
        start_date: "2026-12-01",
        end_date: "2026-12-02",
        status: "cancelled",
      },
    ]),
  ).toEqual({ scheduled: 2, confirmed: 1, free: 20 });
});

test("stable ordering is chronological, timed-first, time then creation then ID", () => {
  const rows = [
    { ...row, id: "all" },
    { ...row, id: "late", start_time: "18:00:00" },
    {
      ...row,
      id: "b",
      start_time: "09:00",
      created_at: "2026-10-02T12:00:00Z",
    },
    {
      ...row,
      id: "a",
      start_time: "09:00",
      created_at: "2026-10-02T12:00:00Z",
    },
    { ...row, id: "early", start_time: "09:00" },
    { ...row, id: "tomorrow", start_date: "2026-11-29" },
  ];
  expect(sortActivities(rows).map(({ id }) => id)).toEqual([
    "early",
    "a",
    "b",
    "late",
    "all",
    "tomorrow",
  ]);
  expect(rows[0].id).toBe("all");
  expect(
    sortActivities(
      [
        {
          ...row,
          id: "continuing",
          start_date: "2026-11-27",
          end_date: "2026-11-28",
        },
        { ...row, id: "timed", start_time: "09:00" },
      ],
      "2026-11-28",
    ).map(({ id }) => id),
  ).toEqual(["timed", "continuing"]);
});

test.each([
  [{}, "28 NOV · TODO EL DÍA"],
  [{ start_time: "18:00:00" }, "28 NOV · DESDE 18:00"],
  [{ start_time: "18:00", end_time: "20:00" }, "28 NOV · 18:00–20:00"],
  [
    { start_time: "22:00", end_date: "2026-11-29", end_time: "02:00" },
    "28 NOV 22:00 — 29 NOV 02:00",
  ],
  [{ end_date: "2026-12-01" }, "28 NOV — 1 DIC · TODO EL DÍA"],
  [
    { start_time: "18:00", end_date: "2026-12-01" },
    "28 NOV 18:00 — 1 DIC · SIN HORA DE FIN",
  ],
])("range formatting %j", (changes, text) => {
  expect(formatActivityRange({ ...row, ...changes })).toBe(text);
});

test("create normalizes blank content/time/source and defaults end date and status", () => {
  expect(
    activityCreateSchema.parse({
      category: "camping",
      title: "  Camping  ",
      start_date: "2026-11-28",
    }),
  ).toEqual({
    category: "camping",
    title: "Camping",
    description: null,
    status: "tentative",
    start_date: "2026-11-28",
    end_date: "2026-11-28",
    start_time: null,
    end_time: null,
    source_idea_id: null,
  });
});

test.each([
  { title: "ab" },
  { title: "x".repeat(81) },
  { description: "x".repeat(401) },
  { category: "other" },
  { status: "cancelled" },
  { status: "other" },
  { start_date: "2026-11-27" },
  { start_date: "2026-12-21" },
  { start_date: "2026-11-31" },
  { end_date: "2026-11-27" },
  { end_date: "2026-12-22" },
  { end_date: "2026-12-21" },
  { end_time: "15:00" },
  { start_time: "24:00" },
  { start_time: "15:00", end_time: "15:00" },
  { start_time: "15:00", end_time: "14:00" },
  { end_date: "2026-12-21", start_time: "18:00", end_time: "09:00" },
  { created_by: row.id },
  { season_year: 2027 },
  { id: row.id },
  { source_idea_id: "invalid" },
])("invalid/strict create rejected: %j", (changes) => {
  expect(activityCreateSchema.safeParse({ ...base, ...changes }).success).toBe(
    false,
  );
});

test.each(["07:24", "07:25"])(
  "departure end %s allowed, overnight may end earlier than start",
  (end_time) => {
    expect(
      activityCreateSchema.safeParse({
        ...base,
        start_date: "2026-12-20",
        end_date: "2026-12-21",
        start_time: "22:00",
        end_time,
      }).success,
    ).toBe(true);
  },
);

test("edit can cancel and reinstate, never rewrite source or identity", () => {
  for (const status of ["tentative", "confirmed", "cancelled"])
    expect(
      activityEditSchema.safeParse({ ...base, id: row.id, status }).success,
    ).toBe(true);
  for (const changes of [
    { source_idea_id: row.id },
    { created_by: row.id },
    { season_year: 2026 },
    { created_at: row.created_at },
  ])
    expect(
      activityEditSchema.safeParse({ ...base, id: row.id, ...changes }).success,
    ).toBe(false);
});

test("edit requires an explicit status so omission cannot silently reinstate a cancelled plan", () => {
  expect(
    activityEditSchema.safeParse({
      id: row.id,
      category: "camping",
      title: "Camping",
      start_date: "2026-12-05",
    }).success,
  ).toBe(false);
});
