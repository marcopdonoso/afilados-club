"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { z } from "zod";

import { categories, categoryKeys } from "@/features/afiladero/model";
import { IdeaDialog } from "@/features/afiladero/dialog";
import { seasonBounds } from "@/features/season/model";
import {
  activityCreateSchema,
  activityEditSchema,
  statusLabels,
  type Activity,
  type ActivityFields,
  type CalendarActions,
  type CalendarResult,
  type SourceIdea,
} from "./model";

function ActivityForm({
  actions,
  date,
  idea,
  activity,
}: {
  actions: CalendarActions;
  date?: string;
  idea?: SourceIdea;
  activity?: Activity;
}) {
  const id = useId();
  const lock = useRef(false);
  const [pending, setPending] = useState(false);
  const [fields, setFields] = useState<ActivityFields>({});
  const [error, setError] = useState("");
  const [start, setStart] = useState(activity?.start_date ?? date ?? "");
  const [end, setEnd] = useState(activity?.end_date ?? date ?? "");
  const content = activity ?? idea;
  const origin = activity?.source_idea_id ?? idea?.id;
  const fieldProps = (name: keyof ActivityFields) => ({
    id: `${id}-${name}`,
    name,
    "aria-invalid": !!fields[name],
    "aria-describedby": fields[name] ? `${id}-${name}-error` : undefined,
  });
  function fieldError(name: keyof ActivityFields) {
    return (
      fields[name] && (
        <p className="field-error" id={`${id}-${name}-error`}>
          {fields[name]!.join(" ")}
        </p>
      )
    );
  }
  function showFields(form: HTMLFormElement, errors: ActivityFields) {
    setFields(errors);
    form
      .querySelector<HTMLElement>(`[name="${Object.keys(errors)[0]}"]`)
      ?.focus();
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const input = Object.fromEntries(data);
    setError("");
    const parsed = activity
      ? activityEditSchema.safeParse({ ...input, id: activity.id })
      : activityCreateSchema.safeParse({
          ...input,
          source_idea_id: idea?.id ?? null,
        });
    if (!parsed.success) {
      showFields(form, z.flattenError<unknown>(parsed.error).fieldErrors);
      return;
    }
    setFields({});
    lock.current = true;
    setPending(true);
    let result: CalendarResult;
    try {
      // Parse the matching branch so edit never sends immutable source identity.
      result = activity
        ? await actions.edit(
            activityEditSchema.parse({ ...input, id: activity.id }),
          )
        : await actions.create(
            activityCreateSchema.parse({
              ...input,
              source_idea_id: idea?.id ?? null,
            }),
          );
    } catch {
      result = {
        ok: false,
        error: "NO SE PUDO GUARDAR LA ACTIVIDAD. Inténtalo otra vez.",
      };
    }
    lock.current = false;
    setPending(false);
    if (result.ok) {
      if (!activity) {
        form.reset();
        setStart(date ?? "");
        setEnd(date ?? "");
      }
      form.closest("dialog")?.close();
    } else {
      setError(result.error);
      showFields(form, result.fields ?? {});
    }
  }
  return (
    <form
      className="idea-form activity-form"
      onSubmit={submit}
      noValidate
      aria-busy={pending}
    >
      {origin && (
        <p className="technical activity-origin">ORIGEN: EL AFILADERO</p>
      )}
      <p className="activity-form-note">
        Horarios de Bolivia. El 21 de diciembre es solo de salida, hasta las{" "}
        {seasonBounds.closingTime}.
      </p>
      <label htmlFor={`${id}-category`}>Categoría</label>
      <select
        {...fieldProps("category")}
        required
        defaultValue={content?.category ?? ""}
      >
        <option value="" disabled>
          Elige el tipo de plan
        </option>
        {categoryKeys.map((key) => (
          <option key={key} value={key}>
            {categories[key].label}
          </option>
        ))}
      </select>
      {fieldError("category")}
      <label htmlFor={`${id}-title`}>Título</label>
      <input
        {...fieldProps("title")}
        required
        defaultValue={content?.title ?? ""}
      />
      {fieldError("title")}
      <label htmlFor={`${id}-description`}>Descripción (opcional)</label>
      <textarea
        {...fieldProps("description")}
        rows={3}
        defaultValue={content?.description ?? ""}
      />
      {fieldError("description")}
      <label htmlFor={`${id}-status`}>Estado</label>
      <select
        {...fieldProps("status")}
        required
        defaultValue={activity?.status ?? "tentative"}
      >
        {Object.entries(statusLabels)
          .filter(([key]) => activity || key !== "cancelled")
          .map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
      </select>
      {fieldError("status")}
      <div className="activity-date-fields">
        <div>
          <label htmlFor={`${id}-start_date`}>Fecha de inicio</label>
          <input
            {...fieldProps("start_date")}
            type="date"
            required
            min={seasonBounds.firstPlanDate}
            max={seasonBounds.lastPlanDate}
            value={start}
            onChange={(event) => {
              const next = event.target.value;
              if (!end || end === start) setEnd(next);
              setStart(next);
            }}
          />
          {fieldError("start_date")}
        </div>
        <div>
          <label htmlFor={`${id}-start_time`}>Hora de inicio (opcional)</label>
          <input
            {...fieldProps("start_time")}
            type="time"
            defaultValue={activity?.start_time?.slice(0, 5) ?? ""}
          />
          {fieldError("start_time")}
        </div>
        <div>
          <label htmlFor={`${id}-end_date`}>Fecha de fin</label>
          <input
            {...fieldProps("end_date")}
            type="date"
            min={start || seasonBounds.firstPlanDate}
            max={seasonBounds.departureDate}
            value={end}
            onChange={(event) => setEnd(event.target.value)}
          />
          {fieldError("end_date")}
        </div>
        <div>
          <label htmlFor={`${id}-end_time`}>Hora de fin (opcional)</label>
          <input
            {...fieldProps("end_time")}
            type="time"
            max={
              end === seasonBounds.departureDate
                ? seasonBounds.closingTime
                : undefined
            }
            defaultValue={activity?.end_time?.slice(0, 5) ?? ""}
          />
          {fieldError("end_time")}
        </div>
      </div>
      {error && (
        <p className="action-error" role="alert">
          {error}
        </p>
      )}
      <p className="action-status technical" role="status">
        {pending ? "GUARDANDO ACTIVIDAD…" : ""}
      </p>
      <div className="dialog-actions">
        <button
          type="button"
          className="afiladero-discrete technical"
          onClick={(event) => event.currentTarget.closest("dialog")?.close()}
        >
          CANCELAR
        </button>
        <button
          type="submit"
          className="afiladero-primary technical"
          disabled={pending}
        >
          PONER EN EL CALENDARIO
        </button>
      </div>
    </form>
  );
}

export function ActivityFormDialog({
  label = "AGENDAR ACTIVIDAD",
  primary = true,
  ...props
}: {
  actions: CalendarActions;
  date?: string;
  idea?: SourceIdea;
  activity?: Activity;
  label?: string;
  primary?: boolean;
}) {
  const [activated, setActivated] = useState(false);
  // Mount fields on first activation, not 23 hidden forms on every board render.
  // Native button activation includes keyboard clicks; the shared dialog owns focus.
  return (
    <div className="activity-control" onClickCapture={() => setActivated(true)}>
      <IdeaDialog
        label={props.activity ? "EDITAR" : label}
        title={props.activity ? "EDITAR ACTIVIDAD" : "AGENDAR ACTIVIDAD"}
        primary={!props.activity && primary}
      >
        {activated && <ActivityForm {...props} />}
      </IdeaDialog>
    </div>
  );
}
