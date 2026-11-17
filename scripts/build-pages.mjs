import { cpSync, mkdirSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const root = process.cwd();
const dist = join(root, "dist");

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });
cpSync(join(root, "site"), dist, { recursive: true });

const npmCommand =
  process.platform === "win32"
    ? (process.env.ComSpec ?? "cmd.exe")
    : "npm";
const npmArguments =
  process.platform === "win32"
    ? [
        "/d",
        "/s",
        "/c",
        "npm run build --workspace @playbox/blocky-24",
      ]
    : ["run", "build", "--workspace", "@playbox/blocky-24"];
const result = spawnSync(
  npmCommand,
  npmArguments,
  {
    cwd: root,
    env: process.env,
    stdio: "inherit",
  },
);

if (result.error) {
  throw result.error;
}
if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
