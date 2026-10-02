import { copyFileSync, mkdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const output = resolve(root, "dist");
rmSync(output, { recursive: true, force: true });
// Only ship public assets; repository files and local secrets stay out of dist.
for (const file of ["index.html", "404.html", "_headers", "src/css/index.css",
  "src/js/index.js", "src/js/solver.mjs", "src/favicon/icon.svg"]) {
  const destination = resolve(output, file);
  mkdirSync(dirname(destination), { recursive: true });
  copyFileSync(resolve(root, file), destination);
}
