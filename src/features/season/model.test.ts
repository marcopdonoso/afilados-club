import { describe, expect, test } from "vitest";

import {
  formatSeasonDate,
  getCountdown,
  getPhase,
  getSeasonDay,
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
    [Date.parse("2026-12-21T00:00:00-04:00"), "live", 24],
    [season.endsAt - 1, "live", 24],
    [season.endsAt, "closed", null],
    [season.endsAt + 1, "closed", null],
  ] as const)("at %s returns %s and day %s", (now, phase, day) => {
    expect(getPhase(now)).toBe(phase);
    expect(getSeasonDay(now)).toBe(day);
  });

  test("different offsets representing the same instant have identical results", () => {
    const local = Date.parse("2026-12-21T23:59:59-04:00");
    const utc = Date.parse("2026-12-22T03:59:59Z");
    const distant = Date.parse("2026-12-22T12:59:59+09:00");
    expect(local).toBe(utc);
    expect(distant).toBe(utc);
    for (const now of [local, utc, distant]) {
      expect(getPhase(now)).toBe("live");
      expect(getSeasonDay(now)).toBe(24);
      expect(formatSeasonDate(now)).toBe("21 DIC");
    }
  });

  test("derives the duration and display dates in the declared zone", () => {
    expect(seasonDays).toBe(24);
    expect(seasonDates).toEqual({
      opening: "28 NOV",
      closing: "22 DIC",
      lastDay: "21 DIC",
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
