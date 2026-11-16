const { mkdirSync } = require("node:fs");
const { chromium } = require("playwright");

const outputDir = "test-results/screenshots";

async function holdDrag(page, sourceIndex, targetIndex, operator) {
  const source = page.locator(`[data-card-index="${sourceIndex}"]`);
  const sourceBox = await source.boundingBox();
  if (!sourceBox) throw new Error("Missing source card");

  await page.mouse.move(
    sourceBox.x + sourceBox.width / 2,
    sourceBox.y + sourceBox.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    sourceBox.x + sourceBox.width / 2 + 20,
    sourceBox.y + sourceBox.height / 2 + 12,
    { steps: 5 },
  );

  const target = page.locator(
    `[data-target-index="${targetIndex}"][data-operator="${operator}"]`,
  );
  const targetBox = await target.boundingBox();
  if (!targetBox) throw new Error("Missing operator target");
  await page.mouse.move(
    targetBox.x + targetBox.width / 2,
    targetBox.y + targetBox.height / 2,
    { steps: 8 },
  );
}

async function drag(page, sourceIndex, targetIndex, operator) {
  await holdDrag(page, sourceIndex, targetIndex, operator);
  await page.mouse.up();
}

async function main() {
  mkdirSync(outputDir, { recursive: true });
  const browser = await chromium.launch({ channel: "msedge" });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("http://127.0.0.1:4173/?puzzle=6,2,8,4");
  await holdDrag(page, 0, 1, "-");
  await page.screenshot({ path: `${outputDir}/drag-phone.png` });
  await page.mouse.up();
  await page.screenshot({
    path: `${outputDir}/merged-phone.png`,
    fullPage: true,
  });

  await page.goto("http://127.0.0.1:4173/?puzzle=6,6,6,6");
  await drag(page, 0, 1, "×");
  await drag(page, 2, 3, "+");
  await drag(page, 1, 3, "-");
  await page.screenshot({
    path: `${outputDir}/victory-phone.png`,
    fullPage: true,
  });

  await page.goto("http://127.0.0.1:4173/?puzzle=1,1,1,1");
  await drag(page, 0, 1, "+");
  await drag(page, 2, 3, "+");
  await drag(page, 1, 3, "+");
  await page.screenshot({
    path: `${outputDir}/failure-phone.png`,
    fullPage: true,
  });

  console.log(
    JSON.stringify({
      errors,
      state: await page.evaluate(() => window.render_game_to_text()),
    }),
  );
  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
