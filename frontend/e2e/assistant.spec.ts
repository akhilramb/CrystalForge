import { test, expect } from "@playwright/test";

test("assistant explains when its server key is not configured", async ({ page }) => {
  await page.route("**/api/assistant/status", (route) =>
    route.fulfill({ json: { configured: false } }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Open research assistant" }).click();
  await expect(page.getByRole("dialog", { name: "CrystalForge Research Assistant" })).toBeVisible();
  await expect(page.getByText(/add GEMINI_API_KEY to Render/i)).toBeVisible();
  await expect(page.getByLabel("Ask the research assistant")).toBeDisabled();
});

test("assistant includes the current catalog material and renders answer sources", async ({ page }) => {
  await page.route("**/api/assistant/status", (route) =>
    route.fulfill({ json: { configured: true } }),
  );
  let receivedMaterialId: string | undefined;
  await page.route("**/api/assistant/chat", async (route) => {
    receivedMaterialId = route.request().postDataJSON().material_id;
    await route.fulfill({
      json: {
        answer: "This value is model-predicted and should be independently validated.",
        material_id: "cf-00001",
        sources: [{ label: "Catalog record cf-00001", href: "/materials/cf-00001" }],
      },
    });
  });
  await page.goto("/materials/cf-00001");
  await page.getByRole("button", { name: "Open research assistant" }).click();
  await page.getByLabel("Ask the research assistant").fill("Explain this material");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByText(/model-predicted and should be independently validated/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Catalog record cf-00001" })).toHaveAttribute("href", "/materials/cf-00001");
  expect(receivedMaterialId).toBe("cf-00001");
});

test("assistant launcher and panel fit on a small mobile screen", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.route("**/api/assistant/status", (route) =>
    route.fulfill({ json: { configured: false } }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Open research assistant" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(362);
});
