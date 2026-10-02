import { expect, test, type Page } from "@playwright/test";

async function openBoardFixture(page: Page, query = "") {
  // Supply Next Link's build-time flags only inside this isolated Vite renderer.
  await page.addInitScript(() => {
    if (location.origin === "http://127.0.0.1:3200") {
      Object.defineProperty(window, "process", {
        value: { env: {} },
        configurable: true,
      });
    }
  });
  await page.goto("/entrar");
  const shell = await page.evaluate(() => ({
    className: document.documentElement.className,
    styles: Array.from(
      document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'),
      (link) => new URL(link.href).pathname,
    ),
  }));
  await page.goto(`http://127.0.0.1:3200/afiladero.html${query}`);
  await page.evaluate(async ({ className, styles }) => {
    document.documentElement.className = className;
    await Promise.all(
      styles.map(
        (href) =>
          new Promise<void>((resolve, reject) => {
            const link = document.createElement("link");
            link.rel = "stylesheet";
            link.href = href;
            link.onload = () => resolve();
            link.onerror = () =>
              reject(new Error("Production CSS unavailable"));
            document.head.append(link);
          }),
      ),
    );
    await document.fonts.ready;
  }, shell);
}

async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
}

test("anonymous Afiladero denies private content and preserves Google entry link", async ({
  page,
}) => {
  await page.goto("/afiladero");
  await expect(page).toHaveURL(/\/entrar$/);
  await expect(
    page.getByRole("link", { name: "ENTRAR CON GOOGLE", exact: true }),
  ).toHaveAttribute("href", "/auth/google");
  await expect(page.getByRole("article")).toHaveCount(0);
  await expect(
    page.getByText("MESA DE OPERACIONES", { exact: true }),
  ).toHaveCount(0);
});

for (const viewport of [
  { name: "phone", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 900 },
] as const) {
  test(`component-only Afiladero empty/populated/form at ${viewport.name}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await openBoardFixture(page, "?empty");
    expect(errors).toEqual([]);
    await expect(page).toHaveTitle("Afiladero component fixture");
    await expect(
      page.getByRole("heading", { name: "TODAVÍA NO HAY NADA QUE DISCUTIR." }),
    ).toBeVisible();
    await expect(page.getByLabel("Datos del Afiladero")).toContainText(
      "IDEAS0VOTOS0MIEMBROS2",
    );
    expect(
      await page
        .getByRole("button", { name: "PROPONER LA PRIMERA IDEA" })
        .evaluate((element) => getComputedStyle(element).color),
    ).toBe("rgb(17, 18, 16)");
    await noOverflow(page);
    await page.screenshot({
      path: testInfo.outputPath(`${viewport.name}-empty.png`),
      fullPage: true,
      animations: "disabled",
      scale: "css",
    });

    const opener = page.getByRole("button", {
      name: "PROPONER LA PRIMERA IDEA",
    });
    await opener.click();
    const dialog = page.getByRole("dialog", { name: "PROPONER IDEA" });
    await expect(dialog).toBeVisible();
    expect(
      await dialog.evaluate((element) =>
        element.contains(document.activeElement),
      ),
    ).toBe(true);
    const bounds = await dialog.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height);
    await page.keyboard.press("Shift+Tab");
    expect(
      await dialog.evaluate((element) =>
        element.contains(document.activeElement),
      ),
    ).toBe(true);
    await dialog.getByLabel("Categoría").selectOption("camping");
    await dialog
      .getByLabel("Título", { exact: true })
      .fill("  Camping en Toro Toro  ");
    await dialog
      .getByLabel("Descripción (opcional)")
      .fill("Una noche, parrilla, cero señal y decisiones cuestionables.");
    await dialog.getByRole("button", { name: "LANZAR AL AFILADERO" }).focus();
    await expect(
      dialog.getByRole("button", { name: "LANZAR AL AFILADERO" }),
    ).toBeFocused();
    await noOverflow(page);
    await page.screenshot({
      path: testInfo.outputPath(`${viewport.name}-form-focus.png`),
      animations: "disabled",
      scale: "css",
    });
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(opener).toBeFocused();

    await openBoardFixture(page, "?pending");
    await expect(page.getByRole("article")).toHaveCount(3);
    await expect(page.getByLabel("Datos del Afiladero")).toContainText(
      "IDEAS3VOTOS2MIEMBROS2",
    );
    await noOverflow(page);
    await page.screenshot({
      path: testInfo.outputPath(`${viewport.name}-populated.png`),
      fullPage: true,
      animations: "disabled",
      scale: "css",
    });
    const card = page.getByRole("article").filter({
      has: page.getByRole("heading", { name: "Camping en Toro Toro" }),
    });
    const maybe = card.getByRole("button", { name: /PUEDE SER 1/ });
    expect((await maybe.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await maybe.click();
    await expect(card.getByRole("button", { name: /PASO 0/ })).toBeDisabled();
    await expect(card.getByRole("status")).toHaveText("REGISTRANDO VOTO…");
    await expect(
      card.getByRole("button", { name: /PUEDE SER 2/ }),
    ).toHaveAttribute("aria-pressed", "true");
    await card.getByRole("button", { name: /PUEDE SER 2/ }).click();
    await expect(
      card.getByRole("button", { name: /PUEDE SER 1/ }),
    ).toHaveAttribute("aria-pressed", "false");
    await expect(
      card.getByRole("button", { name: /ME AFILO 0/ }),
    ).toHaveAttribute("aria-pressed", "false");
    expect(errors).toEqual([]);
  });
}

test("component-only form validation/edit/delete and vote failure stay accessible", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openBoardFixture(page, "?error&pending");
  const card = page.getByRole("article").filter({
    has: page.getByRole("heading", { name: "Camping en Toro Toro" }),
  });
  await card.getByRole("button", { name: /ME AFILO 1/ }).click();
  await expect(card.getByRole("alert")).toHaveText(
    "ESE VOTO NO ENTRÓ. Inténtalo nuevamente.",
  );
  await expect(
    card.getByRole("button", { name: /ME AFILO 1/ }),
  ).toHaveAttribute("aria-pressed", "true");
  await card.getByRole("button", { name: "EDITAR" }).click();
  const edit = page.getByRole("dialog", { name: "EDITAR IDEA" });
  await expect(edit.getByLabel("Título", { exact: true })).toHaveValue(
    "Camping en Toro Toro",
  );
  await edit.getByLabel("Título", { exact: true }).fill("ab");
  await edit.getByRole("button", { name: "GUARDAR CAMBIOS" }).click();
  await expect(edit.getByLabel("Título", { exact: true })).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await expect(edit.getByLabel("Título", { exact: true })).toBeFocused();
  await expect(
    edit.getByText("El título debe tener entre 3 y 80 caracteres."),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(card.getByRole("button", { name: "EDITAR" })).toBeFocused();
  await card.getByRole("button", { name: "ELIMINAR" }).click();
  const confirmation = page.getByRole("dialog", {
    name: "¿Eliminar esta idea?",
  });
  await expect(confirmation).toHaveAttribute("aria-describedby");
  await confirmation.getByRole("button", { name: "CANCELAR" }).click();
  await expect(card).toBeVisible();
  await expect(card.getByRole("button", { name: "ELIMINAR" })).toBeFocused();
  expect(
    await page.evaluate(
      () =>
        document
          .getAnimations()
          .filter((animation) => animation.playState === "running").length,
    ),
  ).toBe(0);
});
