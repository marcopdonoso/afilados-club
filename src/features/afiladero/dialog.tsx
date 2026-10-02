"use client";

import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";

export function IdeaDialog({
  label,
  title,
  description,
  primary = false,
  children,
}: {
  label: string;
  title: string;
  description?: string;
  primary?: boolean;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  function close() {
    dialog.current?.close();
  }
  function cycleFocus(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== "Tab") return;
    const controls = event.currentTarget.querySelectorAll<HTMLElement>(
      ':is(button, a[href], input, select, textarea, [tabindex="0"]):not(:disabled)',
    );
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className={
          primary
            ? "afiladero-primary technical"
            : "afiladero-discrete technical"
        }
        onClick={() => dialog.current?.showModal()}
      >
        {label}
      </button>
      <dialog
        ref={dialog}
        className="idea-dialog"
        aria-labelledby={`${id}-heading`}
        aria-describedby={description ? `${id}-description` : undefined}
        onClose={() => trigger.current?.focus()}
        onKeyDown={cycleFocus}
      >
        <div className="dialog-topline technical">
          <span>MESA DE OPERACIONES</span>
          <button
            type="button"
            className="afiladero-discrete"
            onClick={close}
            aria-label="Cerrar diálogo"
          >
            CERRAR ×
          </button>
        </div>
        <h2 id={`${id}-heading`}>{title}</h2>
        {description && (
          <p id={`${id}-description`} className="dialog-description">
            {description}
          </p>
        )}
        {children}
      </dialog>
    </>
  );
}
