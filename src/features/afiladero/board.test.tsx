// @vitest-environment jsdom
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

import { AfiladeroBoard } from "./board";
import { composeIdeas, type BoardActions } from "./model";

const memberId = "00000000-0000-4000-8000-000000000011";
const ideaId = "00000000-0000-4000-8000-000000000001";
const idea = composeIdeas(
  [
    {
      id: ideaId,
      proposed_by: memberId,
      season_year: 2026,
      category: "camping",
      title: "Camping en Toro Toro",
      description: "Una noche y cero señal.",
      created_at: "2026-10-02T12:00:00Z",
    },
  ],
  [{ idea_id: ideaId, member_id: memberId, vote: "in" }],
  [{ id: memberId, display_name: "Fixture" }],
  memberId,
)[0];
const actions: BoardActions = {
  create: vi.fn(),
  edit: vi.fn(),
  delete: vi.fn(),
  vote: vi.fn(),
  removeVote: vi.fn(),
};

function board(overrides = {}) {
  return render(
    <AfiladeroBoard
      ideas={[idea]}
      member={{ id: memberId, display_name: "Fixture" }}
      isAdmin={false}
      memberCount={3}
      order="most"
      actions={actions}
      {...overrides}
    />,
  );
}

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

test("empty board has presence and real stats, no fake ideas", () => {
  board({ ideas: [] });
  expect(screen.getByText("TODAVÍA NO HAY NADA QUE DISCUTIR.")).toBeVisible();
  expect(screen.getByText("Eso debería preocuparnos.")).toBeVisible();
  expect(
    screen.getByRole("button", { name: "PROPONER LA PRIMERA IDEA" }),
  ).toBeVisible();
  expect(screen.queryByRole("article")).not.toBeInTheDocument();
  expect(screen.getByLabelText("Datos del Afiladero")).toHaveTextContent(
    "IDEAS0VOTOS0MIEMBROS3",
  );
});

test("card shows author/date/counts/current vote; only own edits and author/admin deletion", () => {
  const view = board();
  const card = screen.getByRole("article");
  expect(card).toHaveTextContent("CAMPING");
  expect(card).toHaveTextContent("Fixture");
  expect(card.querySelector("time")).toHaveAttribute(
    "datetime",
    idea.created_at,
  );
  expect(
    within(card).getByRole("button", { name: /ME AFILO 1/ }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(card).toHaveTextContent("TU VOTO");
  expect(within(card).getByRole("button", { name: "EDITAR" })).toBeVisible();
  expect(within(card).getByRole("button", { name: "ELIMINAR" })).toBeVisible();
  view.rerender(
    <AfiladeroBoard
      ideas={[idea]}
      member={{ id: "other", display_name: "Other" }}
      isAdmin={false}
      memberCount={3}
      order="most"
      actions={actions}
    />,
  );
  expect(
    screen.queryByRole("button", { name: "EDITAR" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "ELIMINAR" }),
  ).not.toBeInTheDocument();
  view.rerender(
    <AfiladeroBoard
      ideas={[idea]}
      member={{ id: "admin", display_name: "Admin" }}
      isAdmin
      memberCount={3}
      order="most"
      actions={actions}
    />,
  );
  expect(
    screen.queryByRole("button", { name: "EDITAR" }),
  ).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "ELIMINAR" })).toBeVisible();
});

test("vote toggle removes selected and changes other; one pending lock per idea and accessible errors", async () => {
  let resolve!: (value: { ok: false; error: string }) => void;
  vi.mocked(actions.removeVote).mockReturnValueOnce(
    new Promise((done) => {
      resolve = done;
    }),
  );
  board();
  const selected = screen.getByRole("button", { name: /ME AFILO 1/ });
  fireEvent.click(selected);
  fireEvent.click(selected);
  fireEvent.click(screen.getByRole("button", { name: /PUEDE SER 0/ }));
  expect(actions.removeVote).toHaveBeenCalledExactlyOnceWith(ideaId);
  expect(actions.vote).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: /PASO 0/ })).toBeDisabled();
  expect(screen.getByRole("status")).toHaveTextContent("REGISTRANDO VOTO");
  await act(async () =>
    resolve({ ok: false, error: "ESE VOTO NO ENTRÓ. Inténtalo nuevamente." }),
  );
  expect(screen.getByRole("alert")).toHaveTextContent("ESE VOTO NO ENTRÓ");
  expect(selected).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(screen.getByRole("button", { name: /PUEDE SER 0/ }));
  await act(async () => {});
  expect(actions.vote).toHaveBeenCalledWith({ ideaId, vote: "maybe" });
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

test("form uses real labels, associated validation, trims shared input and keeps DB errors visible", async () => {
  vi.mocked(actions.create).mockResolvedValueOnce({
    ok: false,
    error: "NO SE PUDO LANZAR LA IDEA. Inténtalo otra vez.",
  });
  board();
  fireEvent.click(screen.getByRole("button", { name: "PROPONER IDEA" }));
  const dialog = screen.getByRole("dialog", { name: "PROPONER IDEA" });
  fireEvent.click(
    within(dialog).getByRole("button", { name: "LANZAR AL AFILADERO" }),
  );
  await act(async () => {});
  expect(within(dialog).getByLabelText("Título")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  expect(within(dialog).getByLabelText("Categoría")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  expect(actions.create).not.toHaveBeenCalled();
  fireEvent.change(within(dialog).getByLabelText("Categoría"), {
    target: { value: "camping" },
  });
  fireEvent.change(within(dialog).getByLabelText("Título"), {
    target: { value: "  Camping en Toro Toro  " },
  });
  fireEvent.change(within(dialog).getByLabelText("Descripción (opcional)"), {
    target: { value: "   " },
  });
  fireEvent.click(
    within(dialog).getByRole("button", { name: "LANZAR AL AFILADERO" }),
  );
  await act(async () => {});
  expect(actions.create).toHaveBeenCalledWith({
    category: "camping",
    title: "Camping en Toro Toro",
    description: null,
  });
  expect(within(dialog).getByRole("alert")).toHaveTextContent(
    "NO SE PUDO LANZAR LA IDEA",
  );
  expect(dialog).toHaveAttribute("open");
});

test("shared edit form pre-fills content; deletion requires explicit native dialog confirmation", async () => {
  board();
  fireEvent.click(screen.getByRole("button", { name: "EDITAR" }));
  const edit = screen.getByRole("dialog", { name: "EDITAR IDEA" });
  expect(within(edit).getByLabelText("Título")).toHaveValue(idea.title);
  fireEvent.click(
    within(edit).getByRole("button", { name: "GUARDAR CAMBIOS" }),
  );
  await act(async () => {});
  expect(actions.edit).toHaveBeenCalledWith({
    id: ideaId,
    category: "camping",
    title: idea.title,
    description: idea.description,
  });
  fireEvent.click(screen.getByRole("button", { name: "ELIMINAR" }));
  const confirmation = screen.getByRole("dialog", {
    name: "¿Eliminar esta idea?",
  });
  expect(confirmation).toHaveTextContent("También desaparecerán sus votos.");
  expect(actions.delete).not.toHaveBeenCalled();
  fireEvent.click(
    within(confirmation).getByRole("button", { name: "CANCELAR" }),
  );
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "ELIMINAR" }));
  fireEvent.click(
    within(screen.getByRole("dialog")).getByRole("button", {
      name: "ELIMINAR",
    }),
  );
  await act(async () => {});
  expect(actions.delete).toHaveBeenCalledExactlyOnceWith(ideaId);
});

test("dialog keyboard focus cycles both ends and returns to its trigger on close", () => {
  board();
  const opener = screen.getByRole("button", { name: "PROPONER IDEA" });
  fireEvent.click(opener);
  const dialog = screen.getByRole("dialog", { name: "PROPONER IDEA" });
  const first = within(dialog).getByRole("button", { name: "Cerrar diálogo" });
  const last = within(dialog).getByRole("button", {
    name: "LANZAR AL AFILADERO",
  });
  expect(dialog.querySelectorAll("button:not(:disabled)")).toHaveLength(3);
  first.focus();
  fireEvent.keyDown(first, { key: "Tab", shiftKey: true });
  expect(last).toHaveFocus();
  fireEvent.keyDown(last, { key: "Tab" });
  expect(first).toHaveFocus();
  fireEvent.click(first);
  expect(opener).toHaveFocus();
});
