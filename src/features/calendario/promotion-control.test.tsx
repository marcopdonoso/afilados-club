// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { PromotionControl } from "./promotion-control";
import { composeIdeas } from "@/features/afiladero/model";
const idea = composeIdeas(
  [
    {
      id: "00000000-0000-4000-8000-000000000001",
      season_year: 2026,
      proposed_by: "other",
      category: "camping",
      title: "Camping",
      description: "Una noche",
      created_at: "2026-10-01T00:00:00Z",
    },
  ],
  [],
  [],
  "member",
)[0];
const actions = { create: vi.fn(), edit: vi.fn(), delete: vi.fn() };
test("zero votes and another author do not gate promotion; shared form keeps snapshot editable", () => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  render(<PromotionControl idea={idea} actions={actions} />);
  fireEvent.click(screen.getByRole("button", { name: "AGENDAR" }));
  const dialog = screen.getByRole("dialog");
  expect(within(dialog).getByLabelText("Título")).toHaveValue("Camping");
  expect(within(dialog).getByLabelText("Fecha de inicio")).toHaveValue("");
  expect(within(dialog).getByLabelText("Título")).not.toHaveAttribute(
    "readonly",
  );
});
test.each(["tentative", "confirmed", "cancelled"] as const)(
  "linked %s idea has badge/link and cannot be promoted twice",
  (status) => {
    render(
      <PromotionControl
        idea={{
          ...idea,
          scheduled: { id: "scheduled", start_date: "2026-12-05", status },
        }}
        actions={actions}
      />,
    );
    expect(
      screen.queryByRole("button", { name: "AGENDAR" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", {
        name: `EN CALENDARIO · ${status === "cancelled" ? "CANCELADO" : "5 DIC"}`,
      }),
    ).toHaveAttribute("href", "/calendario#activity-scheduled");
  },
);
