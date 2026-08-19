// Emits a loadable unpacked directory and a store zip per browser:
//   dist/<browser>/                                 -> load unpacked / temporary add-on
//   dist/putio-webextension-<browser>-<version>.zip -> store upload
//
// package.json `version` is the single version source; it is stamped into
// each emitted manifest.json here. The tracked src/manifest.*.json files
// intentionally carry no version field.
//
// Requires the external `zip` binary on PATH (preinstalled on macOS and
// ubuntu-latest CI runners).
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = path.join(root, "src");
const distDir = path.join(root, "dist");

const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const browsers = ["chrome", "firefox"];

fs.rmSync(distDir, { recursive: true, force: true });

for (const browser of browsers) {
  const outDir = path.join(distDir, browser);
  fs.mkdirSync(outDir, { recursive: true });

  for (const entry of fs.readdirSync(srcDir)) {
    if (/^manifest\..+\.json$/.test(entry)) {
      continue;
    }

    fs.cpSync(path.join(srcDir, entry), path.join(outDir, entry), {
      recursive: true,
    });
  }

  const manifestPath = path.join(srcDir, `manifest.${browser}.json`);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  manifest.version = pkg.version;
  fs.writeFileSync(path.join(outDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);

  const zipName = `putio-webextension-${browser}-${pkg.version}.zip`;
  const zip = spawnSync("zip", ["-qr", path.join("..", zipName), "."], {
    cwd: outDir,
    stdio: "inherit",
  });

  if (zip.error?.code === "ENOENT") {
    console.error("`zip` binary not found on PATH; install it and re-run `pnpm run build`");
    process.exit(1);
  }

  if (zip.error || zip.status !== 0) {
    console.error(`zip failed for ${browser}:`, zip.error ?? `exit ${zip.status}`);
    process.exit(1);
  }

  console.log(`built dist/${browser}/ and dist/${zipName}`);
}
