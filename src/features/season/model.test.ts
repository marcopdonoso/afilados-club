import { describe, expect, test } from "vitest";

import {
  formatSeasonDate,
  getCountdown,
  getPhase,
  getSeasonDay,
  getWarmupCopy,
  getWarmupProgress,
  season,
  seasonDates,
  seasonDays,
} from "./model";

describe("the exclusive season window", () => {
  test.each([
    [season.startsAt - 1, "preseason", null],
    [season.startsAt, "live", 1],
    [Date.parse("2026-11-29T00:00:00-04:00"), "live", 2],
    [Date.parse("2026-11-28T07:24:59-04:00"), "preseason", null],
    [Date.parse("2026-11-28T07:25:00-04:00"), "live", 1],
    [Date.parse("2026-12-20T07:24:59-04:00"), "live", 23],
    [Date.parse("2026-12-20T07:25:00-04:00"), "live", 23],
    [Date.parse("2026-12-21T00:00:00-04:00"), "live", null],
    [Date.parse("2026-12-21T07:24:59-04:00"), "live", null],
    [Date.parse("2026-12-21T07:25:00-04:00"), "closed", null],
    [season.endsAt - 1, "live", null],
    [season.endsAt, "closed", null],
    [season.endsAt + 1, "closed", null],
  ] as const)("at %s returns %s and day %s", (now, phase, day) => {
    expect(getPhase(now)).toBe(phase);
    expect(getSeasonDay(now)).toBe(day);
  });

  test("different offsets representing the same instant have identical results", () => {
    const local = Date.parse("2026-12-20T23:59:59-04:00");
    const utc = Date.parse("2026-12-21T03:59:59Z");
    const distant = Date.parse("2026-12-21T12:59:59+09:00");
    expect(local).toBe(utc);
    expect(distant).toBe(utc);
    for (const now of [local, utc, distant]) {
      expect(getPhase(now)).toBe("live");
      expect(getSeasonDay(now)).toBe(23);
      expect(formatSeasonDate(now)).toBe("20 DIC");
    }
  });

  test("derives the duration and display dates in the declared zone", () => {
    expect(season.startsAt).toBe(Date.parse("2026-11-28T07:25:00-04:00"));
    expect(season.endsAt).toBe(Date.parse("2026-12-21T07:25:00-04:00"));
    expect(seasonDays).toBe(23);
    expect(seasonDates).toEqual({
      opening: "28 NOV",
      closing: "21 DIC",
      lastDay: "20 DIC",
      nextYear: 2027,
    });
  });
});

describe("countdown arithmetic", () => {
  test("decomposes remaining whole seconds", () => {
    const remaining = (2 * 86_400 + 3 * 3_600 + 4 * 60 + 5) * 1_000;
    expect(getCountdown(season.startsAt - remaining, season.startsAt)).toEqual({
      days: 2,
      hours: 3,
      minutes: 4,
      seconds: 5,
    });
  });

  test.each([
    [-1, 0, 0],
    [0, 0, 0],
    [1, 0, 0],
    [999, 0, 0],
    [1_000, 0, 1],
    [59_999, 0, 59],
    [60_000, 1, 0],
  ])(
    "remaining %s ms yields %s minutes and %s seconds",
    (remaining, minutes, seconds) => {
      expect(
        getCountdown(season.startsAt - remaining, season.startsAt),
      ).toEqual({
        days: 0,
        hours: 0,
        minutes,
        seconds,
      });
    },
  );

  test("long-expired targets never produce negative units", () => {
    expect(Object.values(getCountdown(season.endsAt, season.startsAt))).toEqual(
      [0, 0, 0, 0],
    );
  });
});

describe("temporal warmup", () => {
  test("warmup reaches 100 only at the exact opening instant", () => {
    expect(season.warmupAt).toBe(Date.parse("2026-10-01T00:00:00-04:00"));
    expect(getWarmupProgress(season.startsAt - 1)).toBe(99);
    expect(getWarmupProgress(season.startsAt)).toBe(100);
  });
  test.each([
    [season.warmupAt - 1, 0],
    [season.warmupAt, 0],
    [Date.parse("2026-10-30T00:00:00-04:00"), 50],
    [season.startsAt, 100],
    [season.endsAt, 100],
  ])("at %s is clamped to %s percent", (now, progress) => {
    expect(getWarmupProgress(now)).toBe(progress);
  });
});

describe("warmup copy", () => {
  test.each([
    [0, "Todavía se permiten excusas."],
    [15, "Todavía se permiten excusas."],
    [16, "Empieza el calentamiento."],
    [40, "Empieza el calentamiento."],
    [41, "El grupo debería empezar a organizarse."],
    [65, "El grupo debería empezar a organizarse."],
    [66, "Ya no hay vuelta atrás."],
    [85, "Ya no hay vuelta atrás."],
    [86, "Afilado crítico."],
    [99, "Afilado crítico."],
    [100, "TEMPORADA ABIERTA."],
  ] as const)("at %s percent returns %s", (progress, copy) => {
    expect(getWarmupCopy(progress)).toBe(copy);
  });
});
