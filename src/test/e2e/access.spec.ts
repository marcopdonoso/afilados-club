import { expect, test } from "@playwright/test";

for (const viewport of [
  { name: "phone", width: 390, height: 844 },
  { name: "desktop", width: 1440, height: 900 },
]) {
  test(`anonymous private root becomes branded entry at ${viewport.name} dimensions`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport);
    const errors: string[] = [];
    const external: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("request", (request) => {
      if (new URL(request.url()).hostname !== "127.0.0.1")
        external.push(request.url());
    });
    const response = await page.goto("/");
    expect(response?.status()).toBe(200);
    await expect(page).toHaveURL(/\/entrar$/);
    await expect(page).toHaveTitle("Afilados Club — Temporada 2026");
    await expect(page.getByRole("banner")).toContainText("AFILADOS CLUB");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "ACCESORESTRINGIDO.",
    );
    await expect(
      page.getByText("SOLO PARA EL GRUPO.", { exact: true }),
    ).toBeVisible();
    await expect(page.locator(".entry-description")).toHaveText(
      "Una temporada entre amigos.Una puerta bastante selectiva.",
    );
    await expect(page.locator(".entry-description br")).toHaveCount(1);
    await expect(page.locator(".entry-note")).toHaveText(
      "Sin formularios. Sin contraseñas. Sin infiltrados.",
    );
    const google = page.getByRole("link", {
      name: "ENTRAR CON GOOGLE",
      exact: true,
    });
    await expect(google).toBeVisible();
    await expect(google).toHaveAttribute("href", "/auth/google");
    await expect(page.getByRole("article")).toHaveCount(0);
    await expect(page.getByRole("textbox")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "SALIR" })).toHaveCount(0);
    await google.focus();
    await expect(google).toBeFocused();
    await expect(page.locator("html")).toHaveAttribute("lang", "es");
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      "content",
      /La sede de una temporada entre amigos/,
    );
    await page.evaluate(() => document.fonts.ready);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    expect(errors).toEqual([]);
    expect(external).toEqual([]);
    await page.screenshot({
      path: testInfo.outputPath(`entry-${viewport.name}.png`),
      fullPage: true,
      scale: "css",
      animations: "disabled",
    });
  });
}

test("safe errors never reflect provider input and anonymous callback fails locally", async ({
  page,
}) => {
  await page.goto("/entrar?error=access");
  await expect(
    page
      .getByRole("main")
      .getByRole("alert")
      .getByRole("heading", { level: 2 }),
  ).toHaveText("ESA CUENTA NO ESTÁ EN LA LISTA.");
  await expect(
    page.getByRole("main").getByRole("alert").locator("p"),
  ).toHaveText("Buen intento. Prueba con la cuenta autorizada para el club.");
  await page.goto(
    "/auth/callback?error=access_denied&error_description=private-provider-detail",
  );
  await expect(page).toHaveURL(/\/entrar\?error=oauth$/);
  await expect(
    page
      .getByRole("main")
      .getByRole("alert")
      .getByRole("heading", { level: 2 }),
  ).toHaveText("ALGO SE TRABÓ EN LA ENTRADA.");
  await expect(
    page.getByRole("main").getByRole("alert").locator("p"),
  ).toHaveText("Inténtalo otra vez. Si insiste, culpamos a la tecnología.");
  await expect(page.getByText("private-provider-detail")).toHaveCount(0);
});

test("logout rejects GET and cross-origin POST rather than mutating a session", async ({
  request,
}) => {
  expect((await request.get("/auth/logout")).status()).toBe(405);
  expect(
    (
      await request.post("/auth/logout", {
        headers: { origin: "https://evil.example" },
      })
    ).status(),
  ).toBe(403);
});
