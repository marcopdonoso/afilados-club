import { expect, test, type Page } from "@playwright/test";

async function openFixture(page: Page, query = "") {
  await page.addInitScript(() => {
    if (location.origin === "http://127.0.0.1:3200")
      Object.defineProperty(window, "process", {
        value: { env: {} },
        configurable: true,
      });
  });
  await page.goto("/entrar");
  const shell = await page.evaluate(() => ({
    className: document.documentElement.className,
    styles: Array.from(
      document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'),
      (link) => new URL(link.href).pathname,
    ),
  }));
  await page.goto(`http://127.0.0.1:3200/calendario.html${query}`);
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

test("anonymous calendar uses existing entry guard and public Google entry", async ({
  page,
}) => {
  await page.goto("/calendario");
  await expect(page).toHaveURL(/\/entrar$/);
  await expect(
    page.getByRole("link", { name: "ENTRAR CON GOOGLE", exact: true }),
  ).toHaveAttribute("href", "/auth/google");
  await expect(page.getByLabel("Datos del calendario")).toHaveCount(0);
});

for (const viewport of [
  { name: "phone", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 900 },
] as const) {
  test(`component-only calendar empty/populated/day form at ${viewport.name}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: "reduce" });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await openFixture(page, "?empty");
    await expect(page).toHaveTitle("Calendar component fixture");
    await expect(page.getByLabel("Datos del calendario")).toContainText(
      "EN CALENDARIO0CONFIRMADAS0DÍAS LIBRES23",
    );
    await expect(
      page.getByRole("heading", {
        name: "EL CALENDARIO ESTÁ DEMASIADO LIMPIO.",
      }),
    ).toBeVisible();
    const days = page.locator(".calendar-day");
    await expect(days).toHaveCount(23);
    await expect(days.first()).toHaveAttribute("aria-label", "SÁB 28 NOV");
    await expect(days.last()).toHaveAttribute("aria-label", "DOM 20 DIC");
    await expect(page.getByText("LIBRE", { exact: true })).toHaveCount(23);
    expect(
      await page
        .locator(".calendario-grid")
        .evaluate(
          (element) =>
            getComputedStyle(element).gridTemplateColumns.split(" ").length,
        ),
    ).toBe(
      viewport.name === "desktop" ? 7 : viewport.name === "tablet" ? 3 : 1,
    );
    await noOverflow(page);
    await page.screenshot({
      path: testInfo.outputPath(`${viewport.name}-calendar-empty.png`),
      fullPage: true,
      animations: "disabled",
      scale: "css",
    });
    const opener = page.getByRole("button", {
      name: "+ Agendar 5 DIC",
      exact: true,
    });
    expect((await opener.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await opener.click();
    const dialog = page.getByRole("dialog", { name: "AGENDAR ACTIVIDAD" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel("Fecha de inicio")).toHaveValue(
      "2026-12-05",
    );
    await expect(dialog.getByLabel("Fecha de fin")).toHaveValue("2026-12-05");
    await expect(dialog.getByLabel("Fecha de inicio")).toHaveAttribute(
      "max",
      "2026-12-20",
    );
    await expect(dialog.getByLabel("Fecha de fin")).toHaveAttribute(
      "max",
      "2026-12-21",
    );
    const bounds = (await dialog.boundingBox())!;
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.y).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height);
    await dialog.getByLabel("Categoría").selectOption("camping");
    await dialog
      .getByLabel("Título", { exact: true })
      .fill("Camping de prueba");
    await dialog.getByLabel("Hora de inicio (opcional)").fill("22:00");
    await dialog.getByLabel("Fecha de fin").fill("2026-12-06");
    await dialog.getByLabel("Hora de fin (opcional)").fill("02:00");
    const submit = dialog.getByRole("button", {
      name: "PONER EN EL CALENDARIO",
    });
    await submit.focus();
    await page.keyboard.press("Tab");
    await expect(
      dialog.getByRole("button", { name: "Cerrar diálogo" }),
    ).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(submit).toBeFocused();
    await noOverflow(page);
    await page.screenshot({
      path: testInfo.outputPath(`${viewport.name}-calendar-dialog.png`),
      animations: "disabled",
      scale: "css",
    });
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(opener).toBeFocused();
    await openFixture(page);
    await expect(page.getByLabel("Datos del calendario")).toContainText(
      "EN CALENDARIO3CONFIRMADAS2DÍAS LIBRES19",
    );
    await expect(page.getByRole("article")).toHaveCount(5);
    await expect(
      page.locator(".activity-status", { hasText: "CANCELADO" }),
    ).toBeVisible();
    await expect(page.locator('[aria-current="date"]')).toHaveAttribute(
      "datetime",
      "2026-12-05",
    );
    await expect(page.getByText("CONTINÚA", { exact: true })).toHaveCount(1);
    await noOverflow(page);
    expect(
      await page.evaluate(
        () =>
          document
            .getAnimations()
            .filter((animation) => animation.playState === "running").length,
      ),
    ).toBe(0);
    await page.screenshot({
      path: testInfo.outputPath(`${viewport.name}-calendar-populated.png`),
      fullPage: true,
      animations: "disabled",
      scale: "css",
    });
    expect(errors).toEqual([]);
  });
}

test("component-only validation/pending/cancel/reinstate/delete remains accessible", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openFixture(page, "?pending");
  await page
    .getByRole("button", { name: "AGENDAR ACTIVIDAD", exact: true })
    .click();
  const form = page.getByRole("dialog");
  await form.getByRole("button", { name: "PONER EN EL CALENDARIO" }).click();
  await expect(form.getByLabel("Categoría")).toBeFocused();
  await expect(form.getByLabel("Categoría")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await page.keyboard.press("Escape");
  const card = page.getByRole("article").filter({
    has: page.getByRole("heading", { name: "Parrillada inaugural" }),
  });
  await card.getByRole("button", { name: "EDITAR", exact: true }).click();
  const edit = page.getByRole("dialog", { name: "EDITAR ACTIVIDAD" });
  await edit.getByLabel("Estado").selectOption("cancelled");
  await edit.getByRole("button", { name: "PONER EN EL CALENDARIO" }).click();
  await expect(
    edit.getByRole("button", { name: "PONER EN EL CALENDARIO" }),
  ).toBeDisabled();
  await expect(edit.getByRole("status")).toHaveText("GUARDANDO ACTIVIDAD…");
  await expect(edit).not.toBeVisible();
  await expect(card.locator(".activity-status")).toHaveText("CANCELADO");
  await expect(page.getByLabel("Datos del calendario")).toContainText(
    "DÍAS LIBRES20",
  );
  await card.getByRole("button", { name: "EDITAR", exact: true }).click();
  await edit.getByLabel("Estado").selectOption("confirmed");
  await edit.getByRole("button", { name: "PONER EN EL CALENDARIO" }).click();
  await expect(edit).not.toBeVisible();
  await expect(card.locator(".activity-status")).toHaveText("CONFIRMADO");
  await card.getByRole("button", { name: "ELIMINAR", exact: true }).click();
  const confirmation = page.getByRole("dialog", {
    name: "¿ELIMINAR ESTA ACTIVIDAD?",
  });
  await expect(confirmation).toHaveAccessibleDescription(
    "Si el plan simplemente murió, conviene marcarlo como CANCELADO. Elimina solo si esta entrada no debería existir.",
  );
  await confirmation.getByRole("button", { name: "CANCELAR" }).click();
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: "ELIMINAR", exact: true }).click();
  await confirmation
    .getByRole("button", { name: "ELIMINAR", exact: true })
    .click();
  await expect(card).toHaveCount(0);
  await noOverflow(page);
});

test("component-only idea promotion uses editable snapshot, fixed origin, no date or vote gate", async ({
  page,
}) => {
  await openFixture(page, "?ideas");
  await page.getByRole("button", { name: "AGENDAR", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "AGENDAR ACTIVIDAD" });
  await expect(dialog.getByLabel("Fecha de inicio")).toHaveValue("");
  await expect(dialog.getByLabel("Título", { exact: true })).toHaveValue(
    "Camping en Toro Toro",
  );
  await expect(dialog.getByText("ORIGEN: EL AFILADERO")).toBeVisible();
  await dialog.getByLabel("Título", { exact: true }).fill("Snapshot distinto");
  await dialog.getByLabel("Fecha de inicio").fill("2026-12-05");
  await dialog.getByRole("button", { name: "PONER EN EL CALENDARIO" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "AGENDAR", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "EN CALENDARIO · 5 DIC" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Camping en Toro Toro" }),
  ).toBeVisible();
});
