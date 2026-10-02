"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { z } from "zod";

import {
  categories,
  categoryKeys,
  characterCount,
  ideaInputSchema,
  type ActionResult,
  type BoardActions,
  type BoardIdea,
  type FieldErrors,
} from "./model";
import { IdeaDialog } from "./dialog";

function IdeaForm({
  idea,
  actions,
}: {
  idea?: BoardIdea;
  actions: BoardActions;
}) {
  const id = useId();
  const lock = useRef(false);
  const [pending, setPending] = useState(false);
  const [fields, setFields] = useState<FieldErrors>({});
  const [error, setError] = useState("");
  const [title, setTitle] = useState(idea?.title ?? "");
  const [description, setDescription] = useState(idea?.description ?? "");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const parsed = ideaInputSchema.safeParse({
      category: data.get("category"),
      title,
      description,
    });
    setError("");
    if (!parsed.success) {
      const errors = z.flattenError(parsed.error).fieldErrors;
      setFields(errors);
      const first = Object.keys(errors)[0];
      form.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
      return;
    }
    setFields({});
    lock.current = true;
    setPending(true);
    let result: ActionResult;
    try {
      result = idea
        ? await actions.edit({ ...parsed.data, id: idea.id })
        : await actions.create(parsed.data);
    } catch {
      result = {
        ok: false,
        error: idea
          ? "NO SE PUDO MODIFICAR LA IDEA. Inténtalo otra vez."
          : "NO SE PUDO LANZAR LA IDEA. Inténtalo otra vez.",
      };
    }
    lock.current = false;
    setPending(false);
    if (result.ok) {
      if (!idea) {
        form.reset();
        setTitle("");
        setDescription("");
      }
      form.closest("dialog")?.close();
    } else {
      setError(result.error);
      setFields(result.fields ?? {});
    }
  }

  return (
    <form
      className="idea-form"
      onSubmit={submit}
      noValidate
      aria-busy={pending}
    >
      <label htmlFor={`${id}-category`}>Categoría</label>
      <select
        id={`${id}-category`}
        name="category"
        required
        defaultValue={idea?.category ?? ""}
        aria-invalid={!!fields.category}
        aria-describedby={fields.category ? `${id}-category-error` : undefined}
      >
        <option value="" disabled>
          Elige el tipo de plan
        </option>
        {categoryKeys.map((category) => (
          <option key={category} value={category}>
            {categories[category].label}
          </option>
        ))}
      </select>
      {fields.category && (
        <p className="field-error" id={`${id}-category-error`}>
          {fields.category.join(" ")}
        </p>
      )}
      <label htmlFor={`${id}-title`}>Título</label>
      <input
        id={`${id}-title`}
        name="title"
        required
        value={title}
        placeholder="Camping en Toro Toro"
        onChange={(event) => setTitle(event.target.value)}
        aria-invalid={!!fields.title}
        aria-describedby={`${id}-title-count${fields.title ? ` ${id}-title-error` : ""}`}
      />
      <p className="field-counter technical" id={`${id}-title-count`}>
        {characterCount(title.trim())}/80 · MÍNIMO 3
      </p>
      {fields.title && (
        <p className="field-error" id={`${id}-title-error`}>
          {fields.title.join(" ")}
        </p>
      )}
      <label htmlFor={`${id}-description`}>Descripción (opcional)</label>
      <textarea
        id={`${id}-description`}
        name="description"
        rows={4}
        value={description}
        placeholder="Una noche, parrilla, cero señal y decisiones cuestionables."
        onChange={(event) => setDescription(event.target.value)}
        aria-invalid={!!fields.description}
        aria-describedby={`${id}-description-count${fields.description ? ` ${id}-description-error` : ""}`}
      />
      <p className="field-counter technical" id={`${id}-description-count`}>
        {characterCount(description.trim())}/400
      </p>
      {fields.description && (
        <p className="field-error" id={`${id}-description-error`}>
          {fields.description.join(" ")}
        </p>
      )}
      {error && (
        <p className="action-error" role="alert">
          {error}
        </p>
      )}
      <p className="action-status technical" role="status">
        {pending ? "ENVIANDO IDEA…" : ""}
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
          {idea ? "GUARDAR CAMBIOS" : "LANZAR AL AFILADERO"}
        </button>
      </div>
    </form>
  );
}

export function IdeaFormDialog({
  idea,
  actions,
  label = "PROPONER IDEA",
}: {
  idea?: BoardIdea;
  actions: BoardActions;
  label?: string;
}) {
  return (
    <IdeaDialog
      label={idea ? "EDITAR" : label}
      title={idea ? "EDITAR IDEA" : "PROPONER IDEA"}
      primary={!idea}
    >
      <IdeaForm idea={idea} actions={actions} />
    </IdeaDialog>
  );
}
