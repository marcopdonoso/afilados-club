// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { redirect } from "next/navigation";

import EntryPage from "@/app/(public)/entrar/page";
import { getCurrentClubAccess } from "@/lib/auth/member";
import { ClubEntry } from "./club-entry";

vi.mock("@/lib/auth/member", () => ({ getCurrentClubAccess: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));

test("entry is branded, Google-only, semantic and has no roster or registration inputs", () => {
  render(<ClubEntry />);
  expect(screen.getByRole("banner")).toHaveTextContent("AFILADOS CLUB");
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
    "ACCESORESTRINGIDO.",
  );
  expect(
    screen.getByText("SOLO PARA EL GRUPO.", { exact: true }),
  ).toBeVisible();
  const description = screen.getByText(
    /^Una temporada entre amigos\.Una puerta bastante selectiva\.$/,
  );
  expect(description).toBeVisible();
  expect(description.querySelectorAll("br")).toHaveLength(1);
  expect(
    screen.getByRole("link", { name: "ENTRAR CON GOOGLE" }),
  ).toHaveAttribute("href", "/auth/google");
  expect(screen.getByRole("link", { name: "ENTRAR CON GOOGLE" })).toBeVisible();
  expect(
    screen.getByText("Sin formularios. Sin contraseñas. Sin infiltrados.", {
      exact: true,
    }),
  ).toBeVisible();
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});

test.each([
  [
    "access",
    "ESA CUENTA NO ESTÁ EN LA LISTA.",
    "Buen intento. Prueba con la cuenta autorizada para el club.",
  ],
  [
    "oauth",
    "ALGO SE TRABÓ EN LA ENTRADA.",
    "Inténtalo otra vez. Si insiste, culpamos a la tecnología.",
  ],
  [
    "logout",
    "NO SE PUDO CERRAR LA SESIÓN.",
    "Tu sesión puede seguir abierta. Intenta salir de nuevo.",
  ],
] as const)(
  "%s errors have safe Spanish copy and a POST logout affordance",
  (error, title, copy) => {
    render(<ClubEntry error={error} hasIdentity />);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(title);
    expect(
      within(alert).getByRole("heading", {
        level: 2,
        name: title,
      }),
    ).toBeVisible();
    expect(within(alert).getByText(copy, { exact: true })).toBeVisible();
    expect(
      screen
        .getByRole("button", { name: "SALIR DE ESTA CUENTA" })
        .closest("form"),
    ).toHaveAttribute("method", "post");
    expect(screen.getByRole("button").closest("form")).toHaveAttribute(
      "action",
      "/auth/logout",
    );
  },
);

test("active member is redirected from entry to private Home", async () => {
  vi.mocked(getCurrentClubAccess).mockResolvedValue({
    member: { id: "fixture", display_name: "Fixture" },
    hasIdentity: true,
  });
  await expect(
    EntryPage({ searchParams: Promise.resolve({}) }),
  ).rejects.toThrow("redirect:/");
  expect(redirect).toHaveBeenCalledWith("/");
});

test("nonmember identity stays at entry with access denial instead of looping", async () => {
  vi.mocked(getCurrentClubAccess).mockResolvedValue({
    member: null,
    hasIdentity: true,
  });
  render(await EntryPage({ searchParams: Promise.resolve({}) }));
  expect(screen.getByRole("alert")).toHaveTextContent(
    "ESA CUENTA NO ESTÁ EN LA LISTA.",
  );
  expect(
    screen.getByRole("button", { name: "SALIR DE ESTA CUENTA" }),
  ).toBeVisible();
});

test("untrusted error text is never reflected as provider HTML", async () => {
  vi.mocked(getCurrentClubAccess).mockResolvedValue({
    member: null,
    hasIdentity: false,
  });
  render(
    await EntryPage({
      searchParams: Promise.resolve({
        error: "<script>private provider data</script>",
      }),
    }),
  );
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(screen.queryByText(/private provider/)).not.toBeInTheDocument();
});

test("failed logout is visible even when the previous session remains active", async () => {
  vi.mocked(getCurrentClubAccess).mockResolvedValue({
    member: { id: "fixture", display_name: "Fixture" },
    hasIdentity: true,
  });
  render(
    await EntryPage({ searchParams: Promise.resolve({ error: "logout" }) }),
  );
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Tu sesión puede seguir abierta.",
  );
});
