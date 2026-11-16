import { expect, test } from "@playwright/test";

test("opens directly into a playable 24-point board", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "24点" })).toBeVisible();
  await expect(page.getByTestId("timer")).toHaveText(/^00:0[0-2]$/);
  await expect(page.locator("[data-card-index]")).toHaveCount(4);
  await expect(page.getByRole("button", { name: "撤销" })).toBeVisible();
  await expect(page.getByRole("button", { name: "重来本题" })).toBeVisible();
  await expect(page.getByRole("button", { name: "换一题" })).toBeVisible();
  await expect(page.getByRole("button", { name: "设置" })).toBeVisible();
  await expect(page.getByRole("button", { name: /声音/ })).toHaveCount(0);
});

test("opens settings with range and unsolvable choices", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "设置" }).click();

  await expect(page.getByRole("dialog", { name: "游戏设置" })).toBeVisible();
  await expect(page.getByLabel("1-9")).toBeChecked();
  await expect(page.getByLabel("允许出现无解题目")).not.toBeChecked();
  await expect(page.getByRole("button", { name: "应用并换题" })).toBeVisible();
});

for (const viewport of [
  { name: "phone", width: 390, height: 844 },
  { name: "ipad", width: 820, height: 1180 },
  { name: "desktop", width: 1440, height: 900 },
]) {
  test(`${viewport.name} board has no horizontal overflow`, async ({ page }) => {
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height,
    });
    await page.goto("/");

    const dimensions = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));

    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
    await expect(page.locator("[data-card-index]")).toHaveCount(4);
  });
}
