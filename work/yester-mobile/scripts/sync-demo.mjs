// Export the same app that Metro bundles for Android into the Pages checkout.
import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const app = fileURLToPath(new URL("../", import.meta.url));
const demo = fileURLToPath(new URL("../../github-pages/yester/", import.meta.url));
const build = mkdtempSync(join(tmpdir(), "yester-web-"));
try {
  execFileSync(join(app, "node_modules/.bin/expo"), [
    "export", "--platform", "web", "--output-dir", build, "--max-workers", "3"
  ], { cwd: app, stdio: "inherit", env: { ...process.env, CI: "1" } });
  mkdirSync(demo, { recursive: true });
  for (const name of ["assets", "_expo", "index.html"]) {
    cpSync(join(build, name), join(demo, name), { recursive: true });
  }
  // Keep published content-hashed assets addressable for cached HTML and open tabs.
} finally {
  rmSync(build, { recursive: true, force: true });
}
