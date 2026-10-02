import { expect, test, type Page } from "@playwright/test";

async function openHomeFixture(page: Page) {
  // Next normally inlines its environment flags; Vite only renders components.
  await page.addInitScript(() => {
    if (location.origin === "http://127.0.0.1:3200") {
      Object.defineProperty(window, "process", {
        value: { env: {} },
        configurable: true,
      });
    }
  });
  // Reuse actual production CSS/native fonts, but render only a test component.
  // This proves UI behavior, never Google sign-in or private-route authorization.
  await page.goto("/entrar");
  const shell = await page.evaluate(() => ({
    className: document.documentElement.className,
    styles: Array.from(
      document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'),
      (link) => new URL(link.href).pathname,
    ),
  }));
  await page.goto("http://127.0.0.1:3200");
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
              reject(new Error("Production stylesheet failed to load"));
            document.head.append(link);
          }),
      ),
    );
    await document.fonts.ready;
  }, shell);
}

const viewports = [
  { name: "phone", width: 390, height: 844 },
  { name: "desktop", width: 1440, height: 900 },
  { name: "tablet", width: 768, height: 1024 },
] as const;

for (const viewport of viewports) {
  test(`test-only member Home preserves UI at ${viewport.name} dimensions`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height,
    });
    const errors: string[] = [];
    const externalRequests: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("request", (request) => {
      if (new URL(request.url()).hostname !== "127.0.0.1") {
        externalRequests.push(request.url());
      }
    });

    await openHomeFixture(page);
    expect(errors).toEqual([]);
    await expect(page).toHaveTitle("Season Home component fixture");
    await expect(page.getByRole("banner")).toContainText("Marco");
    await expect(page.getByRole("button", { name: "SALIR" })).toHaveAttribute(
      "type",
      "submit",
    );
    await expect(page.getByRole("main")).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 1, name: "AFILADOS CLUB" }),
    ).toBeVisible();
    await expect(
      page.getByRole("region", { name: "Temporada 2026" }),
    ).toBeVisible();
    await expect(page.getByRole("status")).toHaveText(
      /^(PRETEMPORADA|TEMPORADA ABIERTA|TEMPORADA CERRADA)$/,
    );
    await expect(page.getByRole("article")).toHaveCount(4);
    await expect(
      page.getByRole("main").getByRole("link", { name: /EL AFILADERO/ }),
    ).toHaveAttribute("href", "/afiladero");
    await expect(page.getByRole("main").getByRole("link")).toHaveCount(1);
    await expect(
      page.getByRole("article").getByRole("heading", { level: 3 }),
    ).toHaveText(["EL AFILADERO", "CALENDARIO", "JUEGOS", "SEASON RECAP"]);
    await expect(page.getByText("PRÓXIMAMENTE", { exact: true })).toHaveCount(
      0,
    );
    await expect(
      page.getByText("EL PROGRAMA ESTÁ EN PREPARACIÓN.", { exact: true }),
    ).toBeVisible();
    await expect(page.locator('meta[name="viewport"]')).toHaveAttribute(
      "content",
      "width=device-width, initial-scale=1",
    );
    await expect(page.locator("html")).toHaveAttribute("lang", "es");
    await page.evaluate(() => document.fonts.ready);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    expect(errors).toEqual([]);
    expect(externalRequests).toEqual([]);

    await page.screenshot({
      path: testInfo.outputPath(`${viewport.name}-viewport.png`),
      scale: "css",
      animations: "disabled",
    });
    await page.screenshot({
      path: testInfo.outputPath(`${viewport.name}-full.png`),
      fullPage: true,
      scale: "css",
      animations: "disabled",
    });
  });
}

test("test-only member Home transitions through both phase edges", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.setViewportSize({ width: 390, height: 844 });
  // Only the fixture's browser clock is controlled; no fake auth session exists.
  await page.clock.setFixedTime(new Date("2026-11-27T23:59:59-04:00"));
  await openHomeFixture(page);
  await expect(page.getByRole("status")).toHaveText("PRETEMPORADA");
  await expect(
    page
      .getByLabel("Datos de la temporada")
      .getByText("PRETEMPORADA", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "100",
  );
  await expect(page.locator(".warmup > p")).toHaveText("TEMPORADA ABIERTA.");
  await page.clock.setFixedTime(new Date("2026-11-28T00:00:00-04:00"));
  await expect(page.getByRole("status")).toHaveText("TEMPORADA ABIERTA");
  await expect(
    page
      .getByLabel("Datos de la temporada")
      .getByText("TEMPORADA ABIERTA", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("DÍA 1 DE 24", { exact: true })).toBeVisible();
  await expect(page.getByRole("progressbar")).toHaveCount(0);
  await page.clock.setFixedTime(new Date("2026-12-21T00:00:00-04:00"));
  await expect(page.getByText("DÍA 24 DE 24", { exact: true })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: testInfo.outputPath("live-phone-full.png"),
    fullPage: true,
    scale: "css",
    animations: "disabled",
  });
  await page.clock.setFixedTime(new Date("2026-12-22T00:00:00-04:00"));
  await expect(page.getByRole("status")).toHaveText("TEMPORADA CERRADA");
  await expect(
    page
      .getByLabel("Datos de la temporada")
      .getByText("TEMPORADA CERRADA", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("NOS VEMOS EN 2027", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("closed-phone-full.png"),
    fullPage: true,
    scale: "css",
    animations: "disabled",
  });
  expect(errors).toEqual([]);
});

test("reduced motion disables both CSS and reactive phase animation", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.clock.setFixedTime(new Date("2026-10-30T00:00:00-04:00"));
  await openHomeFixture(page);
  await expect(page.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "50",
  );
  expect(
    await page
      .locator(".warmup-track > div")
      .evaluate((element) => getComputedStyle(element).transitionDuration),
  ).toBe("0s");
  await page.clock.setFixedTime(new Date("2026-12-22T00:00:00-04:00"));
  await expect(page.getByRole("status")).toHaveText("TEMPORADA CERRADA");
  expect(
    await page.evaluate(
      () =>
        document
          .getAnimations()
          .filter((animation) => animation.playState === "running").length,
    ),
  ).toBe(0);
  expect(
    await page
      .locator(".season-readout")
      .evaluate((element) => getComputedStyle(element).transform),
  ).toBe("none");
});
