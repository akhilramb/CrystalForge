import { expect, test } from "@playwright/test";

test("theme persists across routes and reloads with reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const toggle = page.getByRole("button", { name: "Dark mode" });
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await toggle.click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator(".hero-inner h1")).toHaveCSS("animation-name", "none");
  await page.getByRole("link", { name: "View materials" }).click();
  await expect(page).toHaveURL(/\/materials$/);
  await page.reload();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await page.goto("/login");
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await toggle.click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});
