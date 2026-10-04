import { z } from "zod";

import {
  idSchema,
  ideaInputSchema,
  type Category,
  type IdeaInput,
} from "@/features/afiladero/model";
import {
  formatSeasonDate,
  getSeasonISODate,
  seasonBounds,
  seasonDays,
} from "@/features/season/model";

export const statusLabels = {
  tentative: "TENTATIVO",
  confirmed: "CONFIRMADO",
  cancelled: "CANCELADO",
} as const;
export type ActivityStatus = keyof typeof statusLabels;
const dateSchema = z.iso.date({ error: "Elige una fecha válida." });
const timeSchema = z
  .union([
    z.iso.time({ precision: -1, error: "Usa una hora válida (HH:MM)." }),
    z.literal(""),
  ])
  .nullable()
  .optional()
  .transform((value) => value || null);
const contentSchema = ideaInputSchema.extend({
  status: z
    .enum(["tentative", "confirmed", "cancelled"], {
      error: "Elige un estado válido.",
    })
    .default("tentative"),
  start_date: dateSchema,
  end_date: z.union([dateSchema, z.literal("")]).optional(),
  start_time: timeSchema,
  end_time: timeSchema,
});

function validateWindow(
  input: z.infer<typeof contentSchema>,
  ctx: z.RefinementCtx,
) {
  const end = input.end_date || input.start_date;
  const issue = (field: keyof typeof input, message: string) =>
    ctx.addIssue({ code: "custom", path: [field], message });
  if (
    input.start_date < seasonBounds.firstPlanDate ||
    input.start_date > seasonBounds.lastPlanDate
  )
    issue(
      "start_date",
      "El inicio debe estar entre el 28 de noviembre y el 20 de diciembre.",
    );
  if (end < input.start_date || end > seasonBounds.departureDate)
    issue(
      "end_date",
      "El fin no puede ser anterior al inicio ni posterior al 21 de diciembre.",
    );
  if (input.end_time && !input.start_time)
    issue("end_time", "Indica una hora de inicio antes de la hora de fin.");
  if (
    end === input.start_date &&
    input.start_time &&
    input.end_time &&
    input.end_time <= input.start_time
  )
    issue(
      "end_time",
      "La hora de fin debe ser posterior al inicio. Si pasa la medianoche, cambia la fecha de fin.",
    );
  if (
    end === seasonBounds.departureDate &&
    (!input.start_time ||
      !input.end_time ||
      input.end_time > seasonBounds.closingTime)
  )
    issue(
      "end_time",
      `El 21 de diciembre es solo de salida: indica una hora de fin hasta las ${seasonBounds.closingTime}. No admite todo el día.`,
    );
}
export const activityCreateSchema = contentSchema
  .extend({
    status: z
      .enum(["tentative", "confirmed"], {
        error: "Una actividad nueva debe ser tentativa o confirmada.",
      })
      .default("tentative"),
    source_idea_id: idSchema
      .nullable()
      .optional()
      .transform((value) => value ?? null),
  })
  .superRefine(validateWindow)
  .transform((input) => ({
    ...input,
    end_date: input.end_date || input.start_date,
  }));
export const activityEditSchema = contentSchema
  .extend({
    id: idSchema,
    status: z.enum(["tentative", "confirmed", "cancelled"], {
      error: "Elige un estado válido.",
    }),
  })
  .superRefine(validateWindow)
  .transform((input) => ({
    ...input,
    end_date: input.end_date || input.start_date,
  }));
export type ActivityInput = z.infer<typeof activityCreateSchema>;
export type ActivityEditInput = z.infer<typeof activityEditSchema>;
export type ActivityFields = Partial<
  Record<keyof ActivityEditInput | "source_idea_id", string[]>
>;
export type CalendarResult =
  { ok: true } | { ok: false; error: string; fields?: ActivityFields };
export type CalendarActions = {
  create: (input: ActivityInput) => Promise<CalendarResult>;
  edit: (input: ActivityEditInput) => Promise<CalendarResult>;
  delete: (id: string) => Promise<CalendarResult>;
};
export type SourceIdea = IdeaInput & { id: string };
export type ActivityRow = {
  id: string;
  season_year: number;
  source_idea_id: string | null;
  created_by: string;
  status: ActivityStatus;
  category: Category;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string;
  start_time: string | null;
  end_time: string | null;
  created_at: string;
};
export type Activity = ActivityRow & { creator: string };
export const activityColumns =
  "id,season_year,source_idea_id,created_by,status,category,title,description,start_date,end_date,start_time,end_time,created_at";

// Date-only arithmetic uses UTC to avoid the device zone; displayed instants use La Paz.
export function formatPlanDate(date: string): string {
  return formatSeasonDate(Date.parse(`${date}T12:00:00Z`));
}
export const calendarDates = Array.from({ length: seasonDays }, (_, index) => {
  const timestamp = Date.parse(seasonBounds.firstPlanDate) + index * 86_400_000;
  const date = new Date(timestamp).toISOString().slice(0, 10);
  const weekday = new Intl.DateTimeFormat("es-BO", {
    timeZone: "UTC",
    weekday: "short",
  })
    .format(timestamp)
    .replace(".", "")
    .toUpperCase();
  return { date, weekday, label: formatPlanDate(date) };
});
export function getCalendarToday(now: number): string | null {
  const date = getSeasonISODate(now);
  return date >= seasonBounds.firstPlanDate && date <= seasonBounds.lastPlanDate
    ? date
    : null;
}
export function coveredDates(
  activity: Pick<ActivityRow, "start_date" | "end_date">,
): string[] {
  return calendarDates
    .filter(
      ({ date }) => date >= activity.start_date && date <= activity.end_date,
    )
    .map(({ date }) => date);
}
export function calendarMetrics(activities: Activity[]) {
  const active = activities.filter(({ status }) => status !== "cancelled");
  return {
    scheduled: active.length,
    confirmed: active.filter(({ status }) => status === "confirmed").length,
    free: seasonDays - new Set(active.flatMap(coveredDates)).size,
  };
}
export function sortActivities(
  activities: Activity[],
  coveredDay?: string,
): Activity[] {
  return [...activities].sort(
    (a, b) =>
      (coveredDay ? 0 : a.start_date.localeCompare(b.start_date)) ||
      (a.start_time?.slice(0, 5) ?? "99:99").localeCompare(
        b.start_time?.slice(0, 5) ?? "99:99",
      ) ||
      a.created_at.localeCompare(b.created_at) ||
      a.id.localeCompare(b.id),
  );
}
export function formatActivityRange(
  activity: Pick<
    ActivityRow,
    "start_date" | "end_date" | "start_time" | "end_time"
  >,
): string {
  const start = formatPlanDate(activity.start_date);
  const end = formatPlanDate(activity.end_date);
  const from = activity.start_time?.slice(0, 5);
  const to = activity.end_time?.slice(0, 5);
  if (!from)
    return `${start}${activity.end_date !== activity.start_date ? ` — ${end}` : ""} · TODO EL DÍA`;
  if (activity.start_date === activity.end_date)
    return `${start} · ${to ? `${from}–${to}` : `DESDE ${from}`}`;
  return `${start} ${from} — ${end}${to ? ` ${to}` : " · SIN HORA DE FIN"}`;
}
