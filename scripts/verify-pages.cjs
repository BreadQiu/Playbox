const { cpSync, existsSync, mkdirSync, readFileSync, rmSync } = require("node:fs");
const { createServer } = require("node:http");
const { extname, join, normalize } = require("node:path");
const { chromium } = require("playwright");

const root = join(process.cwd(), "test-results", "pages");
const siteRoot = join(root, "24-game");
const contentTypes = {
  ".css": "text/css",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};

async function main() {
  if (!existsSync(join(process.cwd(), "dist", "index.html"))) {
    throw new Error("Run npm run build before verify:pages");
  }

  rmSync(root, { recursive: true, force: true });
  mkdirSync(siteRoot, { recursive: true });
  cpSync(join(process.cwd(), "dist"), siteRoot, { recursive: true });

  const server = createServer((request, response) => {
    const requestPath = decodeURIComponent(
      (request.url ?? "/").split("?")[0],
    );
    const relativePath =
      requestPath === "/" || requestPath.endsWith("/")
        ? `${requestPath}index.html`
        : requestPath;
    const filePath = normalize(join(root, relativePath));
    if (!filePath.startsWith(root) || !existsSync(filePath)) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }
    response.writeHead(200, {
      "Content-Type": contentTypes[extname(filePath)] ?? "application/octet-stream",
    });
    response.end(readFileSync(filePath));
  });

  await new Promise((resolve) => server.listen(4175, "127.0.0.1", resolve));

  const browser = await chromium.launch({ channel: "msedge" });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("requestfailed", (request) => {
    errors.push(`${request.url()} failed: ${request.failure()?.errorText}`);
  });

  await page.goto("http://127.0.0.1:4175/24-game/");
  await page.locator("[data-card-index]").first().waitFor();

  const sourceBox = await page
    .locator('[data-card-index="0"]')
    .boundingBox();
  if (!sourceBox) throw new Error("Missing first card");
  await page.mouse.move(
    sourceBox.x + sourceBox.width / 2,
    sourceBox.y + sourceBox.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(sourceBox.x + sourceBox.width / 2 + 14, sourceBox.y + 20, {
    steps: 5,
  });

  const targetBox = await page
    .locator('[data-target-index="1"][data-operator="+"]')
    .boundingBox();
  if (!targetBox) throw new Error("Missing operator target");
  await page.mouse.move(
    targetBox.x + targetBox.width / 2,
    targetBox.y + targetBox.height / 2,
    { steps: 8 },
  );
  await page.mouse.up();

  await page.screenshot({
    path: "test-results/screenshots/production-pages.png",
    fullPage: true,
  });

  const state = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
  await browser.close();
  await new Promise((resolve) => server.close(resolve));

  if (errors.length > 0) {
    throw new Error(`Production page errors:\n${errors.join("\n")}`);
  }
  if (state.slots.filter(Boolean).length !== 3) {
    throw new Error(`Expected one merge, received ${JSON.stringify(state)}`);
  }

  console.log(
    JSON.stringify({
      url: "http://127.0.0.1:4175/24-game/",
      cardsAfterMerge: state.slots.filter(Boolean).length,
      errors,
    }),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
