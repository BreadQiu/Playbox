const {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
} = require("node:fs");
const { createServer } = require("node:http");
const { extname, join, normalize } = require("node:path");
const { chromium } = require("playwright");

const root = join(process.cwd(), "test-results", "pages");
const siteRoot = join(root, "Playbox");
const port = 4175;
const baseUrl = `http://127.0.0.1:${port}/Playbox`;
const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};

async function main() {
  if (
    !existsSync(join(process.cwd(), "dist", "index.html")) ||
    !existsSync(join(process.cwd(), "dist", "blocky-24", "index.html"))
  ) {
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
      "Content-Type":
        contentTypes[extname(filePath)] ?? "application/octet-stream",
    });
    response.end(readFileSync(filePath));
  });

  await new Promise((resolve) =>
    server.listen(port, "127.0.0.1", resolve),
  );

  const browser = await chromium.launch(
    process.env.CI ? {} : { channel: "msedge" },
  );
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("requestfailed", (request) => {
    errors.push(`${request.url()} failed: ${request.failure()?.errorText}`);
  });

  try {
    await page.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: "拖动数字， 拼出刚好 24。" })
      .waitFor();
    const catalogTitle = await page.title();
    if (catalogTitle !== "Blocky 24") {
      throw new Error(`Unexpected catalog title: ${catalogTitle}`);
    }
    await page.screenshot({
      path: "test-results/screenshots/playbox-catalog.png",
      fullPage: true,
    });
    const gameLink = page.getByRole("link", { name: "打开 Blocky 24" });
    await gameLink.click();
    await page.waitForURL(`${baseUrl}/blocky-24/`);
    await page.locator("[data-card-index]").first().waitFor();

    const gameTitle = await page.title();
    await page.screenshot({
      path: "test-results/screenshots/blocky-24-pages.png",
      fullPage: true,
    });
    await page.getByRole("button", { name: "关闭新手提示" }).click();

    const sourceBox = await page
      .locator('[data-card-index="0"]')
      .boundingBox();
    if (!sourceBox) throw new Error("Missing first game card");
    await page.mouse.move(
      sourceBox.x + sourceBox.width / 2,
      sourceBox.y + sourceBox.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      sourceBox.x + sourceBox.width / 2 + 14,
      sourceBox.y + 20,
      { steps: 5 },
    );

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

    const state = JSON.parse(
      await page.evaluate(() => window.render_game_to_text()),
    );
    if (state.slots.filter(Boolean).length !== 3) {
      throw new Error(`Expected one merge: ${JSON.stringify(state)}`);
    }
    await page.getByRole("button", { name: /静音|开启音效/ }).waitFor();

    await page.setViewportSize({ width: 390, height: 844 });
    const phoneDimensions = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    if (phoneDimensions.scrollWidth > phoneDimensions.clientWidth) {
      throw new Error(`Phone overflow: ${JSON.stringify(phoneDimensions)}`);
    }

    await page.setViewportSize({ width: 820, height: 1180 });
    const ipadDimensions = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    if (ipadDimensions.scrollWidth > ipadDimensions.clientWidth) {
      throw new Error(`iPad overflow: ${JSON.stringify(ipadDimensions)}`);
    }

    await page.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: "test-results/screenshots/playbox-catalog-phone.png",
      fullPage: true,
    });

    if (errors.length > 0) {
      throw new Error(`Production page errors:\n${errors.join("\n")}`);
    }

    console.log(
      JSON.stringify(
        {
          catalogUrl: `${baseUrl}/`,
          gameUrl: `${baseUrl}/blocky-24/`,
          catalogTitle,
          gameTitle,
          cardsAfterMerge: state.slots.filter(Boolean).length,
          audio: state.audio,
          errors,
        },
        null,
        2,
      ),
    );
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
