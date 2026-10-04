import Link from "next/link";
import type { BoardIdea } from "@/features/afiladero/model";
import { ActivityFormDialog } from "./activity-form";
import { formatPlanDate, type CalendarActions } from "./model";

export function PromotionControl({
  idea,
  actions,
}: {
  idea: BoardIdea;
  actions: CalendarActions;
}) {
  return idea.scheduled ? (
    <Link
      className="activity-origin technical"
      href={`/calendario#activity-${idea.scheduled.id}`}
    >
      EN CALENDARIO ·{" "}
      {idea.scheduled.status === "cancelled"
        ? "CANCELADO"
        : formatPlanDate(idea.scheduled.start_date)}
    </Link>
  ) : (
    <ActivityFormDialog
      idea={idea}
      actions={actions}
      label="AGENDAR"
      primary={false}
    />
  );
}
