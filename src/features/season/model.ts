type Season = {
  name: string;
  year: number;
  timeZone: string;
  warmupAt: number;
  startsAt: number;
  endsAt: number;
};

export const season = {
  name: "Temporada 2026",
  year: 2026,
  timeZone: "America/La_Paz",
  warmupAt: Date.parse("2026-10-01T00:00:00-04:00"),
  startsAt: Date.parse("2026-11-28T07:25:00-04:00"),
  endsAt: Date.parse("2026-12-21T07:25:00-04:00"),
} as const satisfies Season;

const SECOND = 1_000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export type SeasonPhase = "preseason" | "live" | "closed";
export type Countdown = Record<
  "days" | "hours" | "minutes" | "seconds",
  number
>;

export const seasonDays = (season.endsAt - season.startsAt) / DAY;
export const phaseLabels: Record<SeasonPhase, string> = {
  preseason: "PRETEMPORADA",
  live: "TEMPORADA ABIERTA",
  closed: "TEMPORADA CERRADA",
};

export function getPhase(now: number): SeasonPhase {
  if (now < season.startsAt) return "preseason";
  return now < season.endsAt ? "live" : "closed";
}

export function getSeasonDay(now: number): number | null {
  if (getPhase(now) !== "live") return null;
  const date = getSeasonISODate(now);
  if (date > seasonBounds.lastPlanDate) return null;
  return (
    Math.round(
      (Date.parse(date) - Date.parse(seasonBounds.firstPlanDate)) / DAY,
    ) + 1
  );
}

export function getCountdown(now: number, target: number): Countdown {
  const remaining = Math.max(0, Math.floor((target - now) / SECOND));
  return {
    days: Math.floor(remaining / (DAY / SECOND)),
    hours: Math.floor((remaining % (DAY / SECOND)) / (HOUR / SECOND)),
    minutes: Math.floor((remaining % (HOUR / SECOND)) / (MINUTE / SECOND)),
    seconds: remaining % (MINUTE / SECOND),
  };
}

export function getWarmupProgress(now: number): number {
  // Temporal preparation progress only: this is not member activity or readiness.
  const elapsed = (now - season.warmupAt) / (season.startsAt - season.warmupAt);
  return now >= season.startsAt
    ? 100
    : Math.min(99, Math.round(Math.max(0, elapsed) * 100));
}

export function getWarmupCopy(progress: number): string {
  if (progress <= 15) return "Todavía se permiten excusas.";
  if (progress <= 40) return "Empieza el calentamiento.";
  if (progress <= 65) return "El grupo debería empezar a organizarse.";
  if (progress <= 85) return "Ya no hay vuelta atrás.";
  if (progress <= 99) return "Afilado crítico.";
  return "TEMPORADA ABIERTA.";
}

const dateFormatter = new Intl.DateTimeFormat("es-BO", {
  timeZone: season.timeZone,
  day: "numeric",
  month: "short",
});

export function formatSeasonDate(timestamp: number): string {
  const parts = dateFormatter.formatToParts(timestamp);
  const day = parts.find((part) => part.type === "day")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  return `${day} ${month?.replace(".", "").toUpperCase()}`;
}

const isoFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: season.timeZone,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
export function getSeasonISODate(timestamp: number): string {
  const parts = isoFormatter.formatToParts(timestamp);
  return ["year", "month", "day"]
    .map((type) => parts.find((part) => part.type === type)!.value)
    .join("-");
}
export function formatSeasonTime(timestamp: number): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: season.timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(timestamp);
}
export const seasonBounds = {
  firstPlanDate: getSeasonISODate(season.startsAt),
  lastPlanDate: getSeasonISODate(season.endsAt - DAY),
  departureDate: getSeasonISODate(season.endsAt),
  openingTime: formatSeasonTime(season.startsAt),
  closingTime: formatSeasonTime(season.endsAt),
};

export const seasonDates = {
  opening: formatSeasonDate(season.startsAt),
  closing: formatSeasonDate(season.endsAt),
  lastDay: formatSeasonDate(season.endsAt - DAY),
  nextYear:
    Number(
      new Intl.DateTimeFormat("en", {
        timeZone: season.timeZone,
        year: "numeric",
      }).format(season.endsAt),
    ) + 1,
};
