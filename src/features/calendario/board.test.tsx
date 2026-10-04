// @vitest-environment jsdom
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import { CalendarBoard } from "./board";
import { type Activity, type CalendarActions } from "./model";

const id = "00000000-0000-4000-8000-000000000001";
const member = { id: "member", display_name: "Fixture" };
const row: Activity = {
  id,
  season_year: 2026,
  created_by: member.id,
  creator: member.display_name,
  source_idea_id: id,
  category: "camping",
  title: "Camping",
  description: "Una noche",
  status: "confirmed",
  start_date: "2026-12-05",
  end_date: "2026-12-06",
  start_time: "22:00",
  end_time: "02:00",
  created_at: "2026-10-01T12:00:00Z",
};
const actions: CalendarActions = {
  create: vi.fn(),
  edit: vi.fn(),
  delete: vi.fn(),
};
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
function board(activities: Activity[] = [], isAdmin = false, viewer = member) {
  return render(
    <CalendarBoard
      activities={activities}
      member={viewer}
      isAdmin={isAdmin}
      initialNow={Date.parse("2026-12-05T12:00:00-04:00")}
      actions={actions}
    />,
  );
}
test("empty calendar still renders all 23 dates, actual metrics and day buttons", () => {
  board();
  expect(
    screen.getByRole("heading", { level: 1, name: "CALENDARIO" }),
  ).toBeVisible();
  expect(
    screen.getByText("EL CALENDARIO ESTÁ DEMASIADO LIMPIO."),
  ).toBeVisible();
  expect(screen.getByText("Eso no puede durar.")).toBeVisible();
  expect(screen.getByLabelText("Datos del calendario")).toHaveTextContent(
    "EN CALENDARIO0CONFIRMADAS0DÍAS LIBRES23",
  );
  const days = screen.getAllByRole("region", {
    name: /^(SÁB|DOM|LUN|MAR|MIÉ|JUE|VIE) /,
  });
  expect(days).toHaveLength(23);
  expect(days[0]).toHaveAccessibleName("SÁB 28 NOV");
  expect(days.at(-1)).toHaveAccessibleName("DOM 20 DIC");
  expect(screen.getAllByText("LIBRE")).toHaveLength(23);
  expect(screen.getAllByRole("button", { name: /^\+ Agendar/ })).toHaveLength(
    23,
  );
  fireEvent.click(screen.getByRole("button", { name: "+ Agendar 5 DIC" }));
  expect(
    within(screen.getByRole("dialog")).getByLabelText("Fecha de inicio"),
  ).toHaveValue("2026-12-05");
  expect(document.querySelector('[aria-current="date"]')).toHaveAttribute(
    "datetime",
    "2026-12-05",
  );
});
test("multi-day cards recur, cancelled visible but free; origin/category/creator/range are readable", () => {
  board([
    row,
    {
      ...row,
      id: "cancelled",
      title: "Plan muerto",
      status: "cancelled",
      start_date: "2026-12-07",
      end_date: "2026-12-07",
      source_idea_id: null,
    },
  ]);
  expect(screen.getAllByRole("article")).toHaveLength(3);
  expect(
    screen.getAllByText("CONFIRMADO", { selector: ".activity-status" }),
  ).toHaveLength(2);
  expect(screen.getByText("CANCELADO")).toBeVisible();
  expect(screen.getByLabelText("Datos del calendario")).toHaveTextContent(
    "EN CALENDARIO1CONFIRMADAS1DÍAS LIBRES21",
  );
  const card = screen.getAllByRole("article")[0];
  expect(card).toHaveTextContent("CAMPING");
  expect(card).toHaveTextContent("POR Fixture");
  expect(card).toHaveTextContent("5 DIC 22:00 — 6 DIC 02:00");
  expect(
    within(card).getByRole("link", { name: "ORIGEN: EL AFILADERO" }),
  ).toHaveAttribute("href", `/afiladero#idea-${id}`);
});
test("only creator/admin get edit/delete; delete requires exact accessible confirmation", async () => {
  const view = board([{ ...row, end_date: row.start_date, end_time: null }]);
  fireEvent.click(screen.getByRole("button", { name: "ELIMINAR" }));
  const dialog = screen.getByRole("dialog", {
    name: "¿ELIMINAR ESTA ACTIVIDAD?",
  });
  expect(dialog).toHaveAccessibleDescription(
    "Si el plan simplemente murió, conviene marcarlo como CANCELADO. Elimina solo si esta entrada no debería existir.",
  );
  expect(actions.delete).not.toHaveBeenCalled();
  fireEvent.click(within(dialog).getByRole("button", { name: "CANCELAR" }));
  expect(screen.getByRole("button", { name: "ELIMINAR" })).toHaveFocus();
  fireEvent.click(screen.getByRole("button", { name: "ELIMINAR" }));
  fireEvent.click(within(dialog).getByRole("button", { name: "ELIMINAR" }));
  await act(async () => {});
  expect(actions.delete).toHaveBeenCalledExactlyOnceWith(id);
  view.unmount();
  const other = board(
    [{ ...row, end_date: row.start_date, end_time: null }],
    false,
    { id: "other", display_name: "Other" },
  );
  expect(
    screen.queryByRole("button", { name: "EDITAR" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "ELIMINAR" }),
  ).not.toBeInTheDocument();
  other.unmount();
  board([{ ...row, end_date: row.start_date, end_time: null }], true, {
    id: "admin",
    display_name: "Admin",
  });
  expect(screen.getByRole("button", { name: "EDITAR" })).toBeVisible();
});
test("departure date never highlights a plan day", () => {
  render(
    <CalendarBoard
      activities={[]}
      member={member}
      isAdmin={false}
      initialNow={Date.parse("2026-12-21T01:00:00-04:00")}
      actions={actions}
    />,
  );
  expect(document.querySelector('[aria-current="date"]')).toBeNull();
});
