// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { season } from "@/features/season/model";
import { SeasonHome } from "@/features/season/season-home";

// Isolate the season clock from Next Link's unrelated prefetch timers.
vi.mock("next/link", () => ({
  default: (props: ComponentProps<"a">) => <a {...props} />,
}));

const midpoint = Date.parse("2026-10-30T00:00:00-04:00");

test("member Home adds only display identity and accessible POST logout", () => {
  render(
    <SeasonHome initialNow={midpoint} member={{ display_name: "Marco" }} />,
  );
  expect(screen.getByRole("banner")).toHaveTextContent("Marco");
  const button = screen.getByRole("button", { name: "SALIR" });
  expect(button.closest("form")).toHaveAttribute("action", "/auth/logout");
  expect(button.closest("form")).toHaveAttribute("method", "post");
  expect(screen.getAllByRole("article")).toHaveLength(4);
  expect(screen.queryByText("admin")).not.toBeInTheDocument();
  expect(screen.queryByRole("img")).not.toBeInTheDocument();
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(midpoint);
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: query === "(prefers-reduced-motion)",
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

test("renders semantic Home with only Afiladero and Calendar linked and temporal warmup", () => {
  render(<SeasonHome initialNow={midpoint} />);

  expect(screen.getByRole("banner")).toBeInTheDocument();
  expect(screen.getByRole("main")).toBeInTheDocument();
  expect(
    screen.getByRole("heading", { level: 1, name: "AFILADOS CLUB" }),
  ).toBeVisible();
  expect(screen.getByRole("status")).toHaveTextContent("PRETEMPORADA");
  const board = screen.getByLabelText("Datos de la temporada");
  expect(
    within(board).getByText("PRETEMPORADA", { exact: true }),
  ).toBeVisible();
  expect(
    Array.from(board.querySelectorAll("dt"), (term) => term.textContent),
  ).toEqual(["ESTADO", "APERTURA", "CIERRE", "VENTANA"]);
  expect(
    within(board).getByText("APERTURA").nextElementSibling,
  ).toHaveTextContent(/^28 NOV07:25$/);
  expect(
    within(board).getByText("CIERRE").nextElementSibling,
  ).toHaveTextContent(/^21 DIC07:25$/);
  expect(
    screen.getByRole("progressbar", { name: "NIVEL DE AFILADO" }),
  ).toHaveAttribute("aria-valuenow", "50");
  expect(
    screen.getByText("El grupo debería empezar a organizarse."),
  ).toBeVisible();
  const articles = screen.getAllByRole("article");
  expect(articles).toHaveLength(4);
  for (const [index, title] of [
    "EL AFILADERO",
    "CALENDARIO",
    "JUEGOS",
    "SEASON RECAP",
  ].entries()) {
    expect(
      within(articles[index]).getByRole("heading", { name: title }),
    ).toBeVisible();
  }
  expect(screen.queryByText("PRÓXIMAMENTE")).not.toBeInTheDocument();
  expect(screen.getByText("EL PROGRAMA ESTÁ EN PREPARACIÓN.")).toBeVisible();
  expect(screen.getByRole("link", { name: /EL AFILADERO/ })).toHaveAttribute(
    "href",
    "/afiladero",
  );
  expect(screen.getByRole("link", { name: "CALENDARIO" })).toHaveAttribute(
    "href",
    "/calendario",
  );
  expect(within(screen.getByRole("main")).getAllByRole("link")).toHaveLength(2);
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
  expect(screen.getByRole("contentinfo")).toHaveTextContent(
    "ES UNA TEMPORADA.",
  );
  expect(
    document.querySelector(".countdown")?.closest("[aria-live]"),
  ).toBeNull();
});

test("ticks from actual absolute time and cleans up its only interval", () => {
  const view = render(<SeasonHome initialNow={midpoint} />);
  const countdown = screen
    .getByRole("region", { name: "Temporada 2026" })
    .querySelector(".countdown");
  expect(countdown).toHaveTextContent("29");
  expect(vi.getTimerCount()).toBe(1);
  act(() => {
    vi.setSystemTime(midpoint + 3_600_000);
    vi.advanceTimersByTime(1_000);
  });
  expect(countdown?.querySelectorAll("dd")[1]).toHaveTextContent("06");
  expect(countdown?.querySelectorAll("dd")[3]).toHaveTextContent("59");
  view.unmount();
  expect(vi.getTimerCount()).toBe(0);
});

test.each([
  [season.startsAt, "TEMPORADA ABIERTA", "DÍA 1 DE 23"],
  [season.endsAt, "TEMPORADA CERRADA", "NOS VEMOS EN 2027"],
] as const)(
  "automatically crosses boundary %s without a reload",
  (boundary, label, headline) => {
    vi.setSystemTime(boundary - 1_000);
    render(<SeasonHome initialNow={boundary - 1_000} />);
    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(screen.getByRole("status")).toHaveTextContent(label);
    expect(
      screen.getByText(
        (_content, element) =>
          element?.tagName === "P" && element.textContent === headline,
      ),
    ).toBeVisible();
    expect(
      within(screen.getByLabelText("Datos de la temporada")).getByText(label, {
        exact: true,
      }),
    ).toBeVisible();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  },
);

test("departure remains live without rendering a nonexistent Day 24", () => {
  const now = Date.parse("2026-12-21T07:24:59-04:00");
  vi.setSystemTime(now);
  render(<SeasonHome initialNow={now} />);
  expect(screen.getByRole("status")).toHaveTextContent("TEMPORADA ABIERTA");
  expect(screen.getByText("DÍA DE SALIDA")).toBeVisible();
  expect(document.querySelector(".phase-headline")).not.toHaveTextContent(
    /DÍA 24|DÍA DE 23/,
  );
});

test("each Home instance has an independent clock lifetime", () => {
  const first = render(<SeasonHome initialNow={midpoint} />);
  const second = render(<SeasonHome initialNow={midpoint} />);
  expect(vi.getTimerCount()).toBe(2);
  first.unmount();
  expect(vi.getTimerCount()).toBe(1);
  second.unmount();
  expect(vi.getTimerCount()).toBe(0);
});

test("hydrates the serialized server time before reconciling a different browser time", async () => {
  const initialNow = season.startsAt - 1_000;
  const container = document.createElement("div");
  container.innerHTML = renderToString(<SeasonHome initialNow={initialNow} />);
  expect(container).toHaveTextContent("PRETEMPORADA");
  document.body.appendChild(container);
  vi.setSystemTime(season.endsAt);
  const errors: unknown[] = [];
  const consoleError = vi
    .spyOn(console, "error")
    .mockImplementation((...args) => errors.push(args));
  let root: Root | undefined;
  try {
    await act(async () => {
      root = hydrateRoot(container, <SeasonHome initialNow={initialNow} />, {
        onRecoverableError: (error) => errors.push(error),
      });
    });
    expect(within(container).getByRole("status")).toHaveTextContent(
      "TEMPORADA CERRADA",
    );
    expect(container).toHaveTextContent("NOS VEMOS EN 2027");
    expect(errors).toEqual([]);
  } finally {
    act(() => root?.unmount());
    container.remove();
    consoleError.mockRestore();
  }
  expect(vi.getTimerCount()).toBe(0);
});
