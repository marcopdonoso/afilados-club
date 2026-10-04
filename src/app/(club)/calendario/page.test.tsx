// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import { requireClubMember } from "@/lib/auth/member";
import { loadCalendar } from "@/features/calendario/load";
import CalendarPage from "./page";
vi.mock("@/lib/auth/member", () => ({ requireClubMember: vi.fn() }));
vi.mock("next/server", () => ({
  connection: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/features/calendario/load", () => ({ loadCalendar: vi.fn() }));
vi.mock("./actions", () => ({
  createActivity: vi.fn(),
  editActivity: vi.fn(),
  deleteActivity: vi.fn(),
}));
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(requireClubMember).mockResolvedValue({
    id: "member",
    display_name: "Fixture",
  });
});
test("page reuses membership guard independently of private layout", async () => {
  const denied = new Error("NEXT_REDIRECT");
  vi.mocked(requireClubMember).mockRejectedValueOnce(denied);
  await expect(CalendarPage()).rejects.toBe(denied);
  expect(loadCalendar).not.toHaveBeenCalled();
});
test("valid empty data renders the calendar and real metrics", async () => {
  vi.mocked(loadCalendar).mockResolvedValue({ activities: [], isAdmin: false });
  render(await CalendarPage());
  expect(screen.getByLabelText("Datos del calendario")).toHaveTextContent(
    "DÍAS LIBRES23",
  );
});
test("failed read is visible and never an empty board or raw SQL", async () => {
  vi.mocked(loadCalendar).mockRejectedValue(new Error("private SQL"));
  render(await CalendarPage());
  expect(screen.getByRole("alert")).toHaveTextContent(
    "NO SE PUDO ABRIR EL CALENDARIO.",
  );
  expect(
    screen.queryByLabelText("Datos del calendario"),
  ).not.toBeInTheDocument();
  expect(screen.queryByText("private SQL")).not.toBeInTheDocument();
});
