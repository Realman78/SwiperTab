import { readFileSync, existsSync, rmSync } from "node:fs";
import { execSync } from "node:child_process";

const target = process.argv[2];
const { version } = JSON.parse(readFileSync("./package.json", "utf8"));

if (target === "firefox" || target === "chrome") {
  const dir = `dist-${target}`;
  const zip = `swipertab-${target}-${version}.zip`;
  if (!existsSync(dir)) {
    console.error(`${dir} not found - run "npm run build:${target}" first`);
    process.exit(1);
  }
  if (existsSync(zip)) rmSync(zip);
  execSync(`cd ${dir} && zip -r ../${zip} .`, { stdio: "inherit" });
  console.log(`Wrote ${zip}`);
} else if (target === "source") {
  const zip = `swipertab-source-${version}.zip`;
  if (existsSync(zip)) rmSync(zip);
  execSync(
    `zip -r ${zip} . -x 'node_modules/*' -x 'dist-*/*' -x '*.zip' -x '.git/*' -x '.vite/*'`,
    { stdio: "inherit" },
  );
  console.log(`Wrote ${zip}`);
} else {
  console.error("Usage: node scripts/package.mjs <firefox|chrome|source>");
  process.exit(1);
}
