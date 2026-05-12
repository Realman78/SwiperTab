import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const [, , target, ...viteArgs] = process.argv;

if (target !== "firefox" && target !== "chrome") {
  console.error("Usage: node scripts/vite-target.mjs <firefox|chrome> <vite args...>");
  process.exit(1);
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");
const viteBin = path.resolve(rootDir, "node_modules", "vite", "bin", "vite.js");

const child = spawn(process.execPath, [viteBin, ...viteArgs], {
  cwd: rootDir,
  env: { ...process.env, TARGET: target },
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});

