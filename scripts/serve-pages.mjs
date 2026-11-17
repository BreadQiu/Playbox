import { createServer } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";

const root = resolve(process.cwd(), "dist");
const port = Number(process.env.PORT ?? 4176);
const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};

if (!existsSync(join(root, "index.html"))) {
  console.error("Missing dist/index.html. Run npm run build first.");
  process.exit(1);
}

const server = createServer((request, response) => {
  const pathname = decodeURIComponent(
    (request.url ?? "/").split("?")[0],
  );
  const relativePath =
    pathname === "/" || pathname.endsWith("/")
      ? `${pathname}index.html`
      : pathname;
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

server.listen(port, "127.0.0.1", () => {
  console.log(`Playbox preview: http://127.0.0.1:${port}/`);
});
