import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { ClubHeader } from "@/components/club-header";
import { categories, type RosterMember } from "@/features/afiladero/model";
import { season, seasonDays } from "@/features/season/model";
import {
  calendarDates,
  calendarMetrics,
  formatActivityRange,
  getCalendarToday,
  sortActivities,
  statusLabels,
  type Activity,
  type CalendarActions,
} from "./model";
import { ActivityFormDialog } from "./activity-form";
import { ActivityDeleteControl } from "./delete-control";

export function CalendarBoard({
  activities,
  member,
  isAdmin,
  initialNow,
  actions,
}: {
  activities: Activity[];
  member: RosterMember;
  isAdmin: boolean;
  initialNow: number;
  actions: CalendarActions;
}) {
  const metrics = calendarMetrics(activities);
  const today = getCalendarToday(initialNow);
  const sorted = sortActivities(activities);
  return (
    <div className="season-home calendario-page">
      <ClubHeader member={member} returnHome />
      <main className="page-width calendario-main">
        <section className="calendario-hero" aria-labelledby="calendario-title">
          <p className="technical afiladero-kicker">
            TEMPORADA {season.year} · {seasonDays} DÍAS
          </p>
          <h1 id="calendario-title">CALENDARIO</h1>
          <div className="afiladero-intro">
            <p>Lo que ya dejó de ser una buena intención.</p>
            <ActivityFormDialog actions={actions} />
          </div>
        </section>
        <dl className="afiladero-stats" aria-label="Datos del calendario">
          {[
            ["EN CALENDARIO", metrics.scheduled],
            ["CONFIRMADAS", metrics.confirmed],
            ["DÍAS LIBRES", metrics.free],
          ].map(([label, count]) => (
            <div key={label}>
              <dt className="technical">{label}</dt>
              <dd>{count}</dd>
            </div>
          ))}
        </dl>
        {activities.length === 0 && (
          <div className="afiladero-empty calendario-empty">
            <CalendarDays size={48} strokeWidth={1} aria-hidden="true" />
            <h2>EL CALENDARIO ESTÁ DEMASIADO LIMPIO.</h2>
            <p>Eso no puede durar.</p>
            <ActivityFormDialog
              actions={actions}
              label="AGENDAR LA PRIMERA ACTIVIDAD"
            />
          </div>
        )}
        <section
          className="calendario-plan"
          aria-label="Agenda de la temporada"
        >
          <div className="calendario-plan-heading technical">
            <h2>23 FECHAS. NINGUNA EXCUSA NUEVA.</h2>
            <span>HORARIOS DE BOLIVIA</span>
          </div>
          <div className="calendario-grid">
            {calendarDates.map(({ date, weekday, label }) => {
              const entries = sortActivities(
                sorted.filter(
                  (activity) =>
                    activity.start_date <= date && activity.end_date >= date,
                ),
                date,
              );
              return (
                <section
                  className={`calendar-day${today === date ? " calendar-day-today" : ""}`}
                  key={date}
                  aria-label={`${weekday} ${label}`}
                >
                  <div className="calendar-day-heading">
                    <h3 className="technical">
                      <span>{weekday}</span>
                      <time
                        dateTime={date}
                        aria-current={today === date ? "date" : undefined}
                      >
                        {label}
                      </time>
                    </h3>
                    <ActivityFormDialog
                      actions={actions}
                      date={date}
                      label={`+ Agendar ${label}`}
                      primary={false}
                    />
                  </div>
                  {entries.length === 0 ? (
                    <p className="calendar-free technical">LIBRE</p>
                  ) : (
                    entries.map((activity) => (
                      <article
                        key={activity.id}
                        id={
                          activity.start_date === date
                            ? `activity-${activity.id}`
                            : undefined
                        }
                        className={`activity-card activity-${activity.status}`}
                        aria-labelledby={`activity-title-${activity.id}-${date}`}
                      >
                        <p className="activity-status technical">
                          {statusLabels[activity.status]}
                        </p>
                        <p className="activity-category technical">
                          {categories[activity.category].label}
                        </p>
                        <h4 id={`activity-title-${activity.id}-${date}`}>
                          {activity.title}
                        </h4>
                        <p className="activity-range">
                          {formatActivityRange(activity)}
                        </p>
                        {date !== activity.start_date && (
                          <p className="technical activity-continuation">
                            CONTINÚA
                          </p>
                        )}
                        {activity.description && (
                          <p className="activity-description">
                            {activity.description}
                          </p>
                        )}
                        <p className="activity-creator technical">
                          POR {activity.creator}
                        </p>
                        {activity.source_idea_id && (
                          <Link
                            className="activity-origin technical"
                            href={`/afiladero#idea-${activity.source_idea_id}`}
                          >
                            ORIGEN: EL AFILADERO
                          </Link>
                        )}
                        {(activity.created_by === member.id || isAdmin) && (
                          <div className="activity-management">
                            <ActivityFormDialog
                              activity={activity}
                              actions={actions}
                            />
                            <ActivityDeleteControl
                              id={activity.id}
                              action={actions.delete}
                            />
                          </div>
                        )}
                      </article>
                    ))
                  )}
                </section>
              );
            })}
          </div>
        </section>
      </main>
      <footer className="page-width afiladero-footer technical">
        <span>LOS PLANES PUEDEN CAMBIAR. LA TEMPORADA NO SE ALARGA.</span>
        <Link href="/afiladero">VOLVER AL AFILADERO →</Link>
      </footer>
    </div>
  );
}
