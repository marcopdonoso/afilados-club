// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";

import Home from "./page";

test("renders the accessible foundation home without Supabase configuration", () => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");

  render(<Home />);

  expect(screen.getByRole("main")).toBeInTheDocument();
  expect(
    screen.getByRole("heading", { level: 1, name: "AFILADOS CLUB" }),
  ).toBeVisible();
  expect(screen.getByText("Foundation ready.")).toBeVisible();
});
