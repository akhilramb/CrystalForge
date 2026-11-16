import { test, expect } from "@playwright/test";
test("prediction, discovery and comparison", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Discover better",
  );
  await page
    .getByRole("link", { name: "Predict Material", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Predict voltage", exact: true })
    .click();
  await expect(
    page.getByText("MODEL-PREDICTED ELECTRODE VOLTAGE", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Similar known materials" }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Discovery Studio", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Discover materials", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Your candidate shortlist" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Compare", exact: true })
    .nth(0)
    .click();
  await page
    .getByRole("button", { name: "Compare", exact: true })
    .nth(0)
    .click();
  await page.getByRole("link", { name: /Compare shortlist/ }).click();
  await expect(
    page.getByRole("heading", { name: "Predicted electrode voltage · V" }),
  ).toBeVisible();
});
test("catalog details, structure fallback, exports and model analytics", async ({
  page,
}) => {
  await page.goto("/materials");
  await page
    .getByRole("link", { name: "View material", exact: true })
    .first()
    .click();
  await page.getByRole("tab", { name: "Structure", exact: true }).click();
  await expect(
    page.getByText("Atomic coordinates are not included."),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Economics", exact: true }).click();
  await expect(page.getByText("View cost methodology")).toBeVisible();
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "PDF report" }).click();
  expect((await downloaded).suggestedFilename()).toBe(
    "crystalforge-report.pdf",
  );
  await page.goto("/model");
  await expect(
    page.getByRole("heading", { name: "Evaluated models" }),
  ).toBeVisible();
});
test("mobile routes fit without page overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of [
    "/",
    "/predict",
    "/discover",
    "/materials",
    "/analytics",
    "/history",
    "/saved",
    "/reports",
    "/compare",
  ]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 2,
      ),
    ).toBeTruthy();
  }
});

test("dedicated structure workspace handles unavailable coordinates and retry", async ({ page }) => {
  await page.goto("/materials/cf-00001");
  await page.getByRole("tab", { name: "Structure", exact: true }).click();
  await page.getByRole("link", { name: "Open Dedicated Structure Workspace" }).click();
  await expect(page).toHaveURL(/\/structures\/cf-00001$/);
  await expect(page.getByRole("heading", { name: "Crystal structure workspace" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Structure unavailable" })).toBeVisible();
  const request = page.waitForResponse(/\/api\/materials\/cf-00001\/structure$/);
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  expect((await request).ok()).toBeTruthy();
});

test("structure viewer renders a cell and provenance on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  // A controlled response exercises the browser without upstream credentials.
  await page.route("**/api/materials/cf-00001/structure", (route) => route.fulfill({
    json: {
      available: true,
      material_id: "mp-1236215",
      formula: "CsLiAcO3",
      lattice: [[6, 0, 0], [0, 6, 0], [0, 0, 6]],
      lengths: [6, 6, 6],
      angles: [90, 90, 90],
      volume: 216,
      symmetry: null,
      sites: [{ element: "Cs", position: [0, 0, 0] }],
      source_url: "https://materialsproject.org/materials/mp-1236215",
      provenance: { source: "Materials Project", method: "cache", retrieved_at: "2026-11-16T00:00:00Z" },
    },
  }));
  await page.goto("/structures/cf-00001");
  await expect(page.locator(".viewer canvas")).toBeVisible();
  await expect(page.getByText("Cached Materials Project CIF")).toBeVisible();
  await page.getByLabel("Atom labels").check();
  await page.getByLabel("Unit cell").uncheck();
  await page.getByRole("button", { name: "Reset view" }).click();
  await expect(page.locator(".viewer canvas")).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(392);
});
