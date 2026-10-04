// @vitest-environment jsdom
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import { ActivityFormDialog } from "./activity-form";
import type { CalendarActions, Activity } from "./model";

const actions: CalendarActions = {
  create: vi.fn(),
  edit: vi.fn(),
  delete: vi.fn(),
};
const id = "00000000-0000-4000-8000-000000000001";
beforeEach(() => {
  vi.resetAllMocks();
  for (const action of Object.values(actions))
    vi.mocked(action).mockResolvedValue({ ok: true });
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
});

test("day create pre-fills both dates with correct limits; associated errors and focus", async () => {
  render(
    <ActivityFormDialog actions={actions} date="2026-12-05" label="+ 5 DIC" />,
  );
  fireEvent.click(screen.getByRole("button", { name: "+ 5 DIC" }));
  const dialog = screen.getByRole("dialog");
  expect(within(dialog).getByLabelText("Fecha de inicio")).toHaveValue(
    "2026-12-05",
  );
  expect(within(dialog).getByLabelText("Fecha de fin")).toHaveValue(
    "2026-12-05",
  );
  expect(within(dialog).getByLabelText("Fecha de inicio")).toHaveAttribute(
    "max",
    "2026-12-20",
  );
  expect(within(dialog).getByLabelText("Fecha de fin")).toHaveAttribute(
    "max",
    "2026-12-21",
  );
  expect(
    within(dialog).queryByRole("option", { name: "CANCELADO" }),
  ).not.toBeInTheDocument();
  fireEvent.click(
    within(dialog).getByRole("button", { name: "PONER EN EL CALENDARIO" }),
  );
  expect(actions.create).not.toHaveBeenCalled();
  const category = within(dialog).getByLabelText("Categoría");
  expect(category).toHaveFocus();
  expect(category).toHaveAttribute("aria-invalid", "true");
  expect(
    document.getElementById(category.getAttribute("aria-describedby")!),
  ).toHaveTextContent("Elige una categoría.");
  fireEvent.change(category, { target: { value: "cine" } });
  fireEvent.change(within(dialog).getByLabelText("Título"), {
    target: { value: "  Película  " },
  });
  fireEvent.click(
    within(dialog).getByRole("button", { name: "PONER EN EL CALENDARIO" }),
  );
  await act(async () => {});
  expect(actions.create).toHaveBeenCalledWith(
    expect.objectContaining({
      title: "Película",
      start_date: "2026-12-05",
      end_date: "2026-12-05",
      source_idea_id: null,
    }),
  );
  expect(screen.getByRole("button", { name: "+ 5 DIC" })).toHaveFocus();
});

test("idea promotion snapshots content with fixed origin and no selected date", () => {
  render(
    <ActivityFormDialog
      actions={actions}
      idea={{
        id,
        title: "Camping",
        category: "camping",
        description: "Una noche",
      }}
      label="AGENDAR"
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "AGENDAR" }));
  const dialog = screen.getByRole("dialog");
  expect(within(dialog).getByLabelText("Título")).toHaveValue("Camping");
  expect(within(dialog).getByLabelText("Categoría")).toHaveValue("camping");
  expect(within(dialog).getByLabelText("Descripción (opcional)")).toHaveValue(
    "Una noche",
  );
  expect(within(dialog).getByLabelText("Fecha de inicio")).toHaveValue("");
  expect(within(dialog).getByText("ORIGEN: EL AFILADERO")).toBeVisible();
  expect(dialog.querySelector('[name="source_idea_id"]')).toBeNull();
});

test("edit pre-fills times, allows cancellation/reinstatement, and sends no source", async () => {
  const activity: Activity = {
    id,
    season_year: 2026,
    source_idea_id: id,
    created_by: id,
    creator: "Fixture",
    category: "camping",
    title: "Camping",
    description: null,
    status: "cancelled",
    start_date: "2026-12-05",
    end_date: "2026-12-06",
    start_time: "22:00:00",
    end_time: "02:00:00",
    created_at: "2026-10-01T00:00:00Z",
  };
  render(<ActivityFormDialog actions={actions} activity={activity} />);
  fireEvent.click(screen.getByRole("button", { name: "EDITAR" }));
  const dialog = screen.getByRole("dialog");
  expect(
    within(dialog).getByLabelText("Hora de inicio (opcional)"),
  ).toHaveValue("22:00");
  expect(within(dialog).getByLabelText("Estado")).toHaveValue("cancelled");
  fireEvent.change(within(dialog).getByLabelText("Estado"), {
    target: { value: "confirmed" },
  });
  fireEvent.click(
    within(dialog).getByRole("button", { name: "PONER EN EL CALENDARIO" }),
  );
  await act(async () => {});
  expect(actions.edit).toHaveBeenCalledWith({
    id,
    category: "camping",
    title: "Camping",
    description: null,
    status: "confirmed",
    start_date: "2026-12-05",
    end_date: "2026-12-06",
    start_time: "22:00",
    end_time: "02:00",
  });
});

test("pending lock prevents duplicate writes, server fields remain associated and keyboard stays in dialog", async () => {
  let resolve!: (value: {
    ok: false;
    error: string;
    fields: { title: string[] };
  }) => void;
  vi.mocked(actions.create).mockReturnValueOnce(
    new Promise((done) => {
      resolve = done;
    }),
  );
  render(<ActivityFormDialog actions={actions} date="2026-12-05" />);
  const trigger = screen.getByRole("button", { name: "AGENDAR ACTIVIDAD" });
  fireEvent.click(trigger);
  const dialog = screen.getByRole("dialog");
  fireEvent.change(within(dialog).getByLabelText("Categoría"), {
    target: { value: "cine" },
  });
  fireEvent.change(within(dialog).getByLabelText("Título"), {
    target: { value: "Película" },
  });
  const submit = within(dialog).getByRole("button", {
    name: "PONER EN EL CALENDARIO",
  });
  const first = within(dialog).getByRole("button", { name: "Cerrar diálogo" });
  submit.focus();
  fireEvent.keyDown(submit, { key: "Tab" });
  expect(first).toHaveFocus();
  fireEvent.keyDown(first, { key: "Tab", shiftKey: true });
  expect(submit).toHaveFocus();
  fireEvent.click(submit);
  fireEvent.click(submit);
  expect(actions.create).toHaveBeenCalledTimes(1);
  expect(submit).toBeDisabled();
  expect(within(dialog).getByRole("status")).toHaveTextContent(
    "GUARDANDO ACTIVIDAD…",
  );
  await act(async () =>
    resolve({
      ok: false,
      error: "No se pudo guardar.",
      fields: { title: ["Revisa el título."] },
    }),
  );
  expect(within(dialog).getByRole("alert")).toHaveTextContent(
    "No se pudo guardar.",
  );
  expect(within(dialog).getByLabelText("Título")).toHaveFocus();
  expect(within(dialog).getByLabelText("Título")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  fireEvent.click(first);
  expect(trigger).toHaveFocus();
});
