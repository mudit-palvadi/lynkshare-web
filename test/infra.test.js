import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

test("app-ads.txt publishes the AdMob seller record separately from ads.txt", () => {
  const seller = "google.com, pub-9472143004063972, DIRECT, f08c47fec0942fa0\n";
  const readText = (name) =>
    readFileSync(join(webRoot, name), "utf8").replace(/\r\n/g, "\n");
  assert.equal(readText("app-ads.txt"), seller);
  assert.equal(readText("ads.txt"), seller);
});

test("assetlinks.json binds only the upload and Play signing certificates", () => {
  const parsed = JSON.parse(
    readFileSync(join(webRoot, ".well-known/assetlinks.json"), "utf8"),
  );
  const statement = parsed[0];
  assert.deepEqual(statement.relation, ["delegate_permission/common.handle_all_urls"]);
  assert.equal(statement.target.namespace, "android_app");
  assert.equal(statement.target.package_name, "app.xynix.lynk");
  // Both distribution paths must work; a debug certificate must not be published.
  assert.deepEqual([...statement.target.sha256_cert_fingerprints].sort(), [
    "74:25:40:24:ED:53:EF:1F:A7:8F:00:B7:D1:72:7B:6A:CC:4B:12:B9:20:8D:EB:8D:48:11:58:6C:6C:C8:F0:94",
    "1E:16:7F:D3:94:36:E0:EA:91:95:24:B3:28:51:FC:EA:8A:84:18:85:D4:7C:9B:8B:0A:5F:2F:4D:81:F8:94:D6",
  ].sort());
});

test("the manifest references real icon files with correct sizes", () => {
  const manifest = JSON.parse(
    readFileSync(join(webRoot, "revamp/manifest.webmanifest"), "utf8"),
  );
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.background_color, "#09090b");
  for (const icon of manifest.icons) {
    const file = join(webRoot, "assets", icon.src.replace(/^\//, ""));
    assert.ok(existsSync(file), `missing icon ${icon.src}`);
    const buf = readFileSync(file);
    // PNG signature + IHDR width/height at fixed offsets.
    assert.deepEqual([...buf.subarray(0, 4)], [0x89, 0x50, 0x4e, 0x47]);
    const width = buf.readUInt32BE(16);
    const height = buf.readUInt32BE(20);
    const [declared] = icon.sizes.split("x").map(Number);
    assert.equal(width, declared);
    assert.equal(height, declared);
  }
});

test("the marketing page installs the manifest and every page declares a theme", () => {
  const index = readFileSync(join(webRoot, "revamp/index.html"), "utf8");
  assert.match(index, /rel="manifest" href="\/manifest\.webmanifest"/);
  assert.match(index, /name="theme-color"/);

  for (const page of ["revamp/index.html", "revamp/transfer.html"]) {
    assert.match(
      readFileSync(join(webRoot, page), "utf8"),
      /name="theme-color"/,
      `${page} missing theme-color`,
    );
  }
});
