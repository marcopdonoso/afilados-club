// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import { ClubHeader } from "./club-header";

test("club wordmark returns Home without expanding navigation or exposing role", () => {
  render(<ClubHeader member={{ display_name: "Fixture" }} returnHome />);
  expect(screen.getByRole("link", { name: "AFILADOS CLUB" })).toHaveAttribute(
    "href",
    "/",
  );
  expect(
    screen.getByRole("link", { name: /VOLVER AL INICIO/ }),
  ).toHaveAttribute("href", "/");
  expect(screen.getByRole("banner")).toHaveTextContent("Fixture");
  expect(
    screen.getByRole("button", { name: "SALIR" }).closest("form"),
  ).toHaveAttribute("method", "post");
  expect(screen.queryByText("admin")).not.toBeInTheDocument();
});
