// The revamp has separate marketing and transfer entries. Both are built from
// revamp/ by Vite and deployed to the lynk-web Worker.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFileSync(join(root, relative), "utf8");

test("the revamp has separate marketing and transfer entries", () => {
  for (const file of [
    "revamp/index.html",
    "revamp/transfer.html",
    "revamp/src/marketing/main.jsx",
    "revamp/src/transfer/main.jsx",
  ]) {
    assert.ok(existsSync(join(root, file)), `${file} is missing`);
  }

  assert.ok(read("vite.config.js").includes("marketing"));
  assert.ok(read("vite.config.js").includes("transfer"));
  assert.ok(read("vite.config.js").includes("transferRoutes"));
});

test("the transfer entry has no ad script", () => {
  const transfer = read("revamp/transfer.html");
  assert.equal(transfer.includes("adsbygoogle"), false);
  assert.equal(transfer.includes("pagead2.googlesyndication.com"), false);
  assert.equal(transfer.includes("data-ad-banner"), false);
});

test("the package builds the revamp with Vite", () => {
  const pkg = JSON.parse(read("package.json"));
  assert.equal(pkg.scripts.build, "vite build");
  assert.equal(pkg.scripts.test, "node --test");
  assert.ok(pkg.dependencies.react);
  assert.ok(pkg.dependencies["react-dom"]);
});
