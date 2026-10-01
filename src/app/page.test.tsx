// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from "@testing-library/react";
import { hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { season } from "@/features/season/model";
import { SeasonHome } from "@/features/season/season-home";

const midpoint = Date.parse("2026-10-30T00:00:00-04:00");

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

test("renders semantic Home with four static announcements and temporal warmup", () => {
  render(<SeasonHome initialNow={midpoint} />);

  expect(screen.getByRole("banner")).toBeInTheDocument();
  expect(screen.getByRole("main")).toBeInTheDocument();
  expect(
    screen.getByRole("heading", { level: 1, name: "AFILADOS CLUB" }),
  ).toBeVisible();
  expect(screen.getByRole("status")).toHaveTextContent("PRETEMPORADA");
  expect(
    within(screen.getByLabelText("Datos de la temporada")).getByText(
      "PRETEMPORADA",
      { exact: true },
    ),
  ).toBeVisible();
  expect(
    screen.getByRole("progressbar", { name: "NIVEL DE AFILADO" }),
  ).toHaveAttribute("aria-valuenow", "50");
  expect(
    screen.getByText(
      "Tiempo de preparación transcurrido. No mide actividad del grupo.",
    ),
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
    expect(within(articles[index]).getByText("PRÓXIMAMENTE")).toBeVisible();
  }
  expect(screen.queryByRole("link")).not.toBeInTheDocument();
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
  expect(countdown?.querySelectorAll("dd")[1]).toHaveTextContent("22");
  expect(countdown?.querySelectorAll("dd")[3]).toHaveTextContent("59");
  view.unmount();
  expect(vi.getTimerCount()).toBe(0);
});

test.each([
  [season.startsAt, "TEMPORADA ABIERTA", "DÍA 1 DE 24"],
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
