import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (name) => readFileSync(join(root, name), "utf8");

test("the Android app prompt is a dialog that can be closed", () => {
  const promo = read("revamp/src/components/AppPromo.jsx");
  assert.ok(promo.includes("showModal"));
  assert.ok(promo.includes("Get LynkShare for Android"));
  assert.ok(promo.includes("Get it on Google Play"));
  assert.ok(promo.includes("Continue on the web"));
});

test("the app prompt appears after a receive is saved, not on the landing page", () => {
  const share = read("revamp/src/transfer/receive/ShareScreen.jsx");
  const savedTitle = share.indexOf('title="Saved."');
  const promo = share.indexOf("<AppPromo />");
  assert.ok(savedTitle >= 0);
  assert.ok(promo > savedTitle);

  const marketing = read("revamp/src/marketing/main.jsx");
  assert.equal(marketing.includes("AppPromo"), false);
  assert.equal(marketing.includes("showModal"), false);
});
