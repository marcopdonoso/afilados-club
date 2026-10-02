"use client";

import { useRef, useState, type MouseEvent } from "react";

import { IdeaDialog } from "./dialog";
import type { BoardActions } from "./model";

function DeleteConfirmation({
  ideaId,
  action,
}: {
  ideaId: string;
  action: BoardActions["delete"];
}) {
  const lock = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function remove(event: MouseEvent<HTMLButtonElement>) {
    if (lock.current) return;
    const dialog = event.currentTarget.closest("dialog");
    lock.current = true;
    setPending(true);
    setError("");
    try {
      const result = await action(ideaId);
      if (result.ok) dialog?.close();
      else setError(result.error);
    } catch {
      setError("NO SE PUDO ELIMINAR.");
    } finally {
      lock.current = false;
      setPending(false);
    }
  }
  return (
    <div aria-busy={pending}>
      {error && (
        <p role="alert" className="action-error">
          {error}
        </p>
      )}
      <p role="status" className="action-status technical">
        {pending ? "ELIMINANDO IDEA…" : ""}
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
          type="button"
          className="afiladero-primary technical"
          disabled={pending}
          onClick={remove}
        >
          ELIMINAR
        </button>
      </div>
    </div>
  );
}

export function DeleteControl({
  ideaId,
  action,
}: {
  ideaId: string;
  action: BoardActions["delete"];
}) {
  return (
    <IdeaDialog
      label="ELIMINAR"
      title="¿Eliminar esta idea?"
      description="También desaparecerán sus votos."
    >
      <DeleteConfirmation ideaId={ideaId} action={action} />
    </IdeaDialog>
  );
}
