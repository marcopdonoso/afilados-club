"use client";

import { useRef, useState, type MouseEvent } from "react";
import { IdeaDialog } from "@/features/afiladero/dialog";
import type { CalendarActions } from "./model";

function Confirmation({
  id,
  action,
}: {
  id: string;
  action: CalendarActions["delete"];
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
      const result = await action(id);
      if (result.ok) dialog?.close();
      else setError(result.error);
    } catch {
      setError("NO SE PUDO ELIMINAR LA ACTIVIDAD. Inténtalo otra vez.");
    } finally {
      lock.current = false;
      setPending(false);
    }
  }
  return (
    <div aria-busy={pending}>
      {error && (
        <p className="action-error" role="alert">
          {error}
        </p>
      )}
      <p className="action-status technical" role="status">
        {pending ? "ELIMINANDO ACTIVIDAD…" : ""}
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
export function ActivityDeleteControl({
  id,
  action,
}: {
  id: string;
  action: CalendarActions["delete"];
}) {
  return (
    <IdeaDialog
      label="ELIMINAR"
      title="¿ELIMINAR ESTA ACTIVIDAD?"
      description="Si el plan simplemente murió, conviene marcarlo como CANCELADO. Elimina solo si esta entrada no debería existir."
    >
      <Confirmation id={id} action={action} />
    </IdeaDialog>
  );
}
