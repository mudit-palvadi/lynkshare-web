import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(
  join(root, "revamp/src/marketing/main.jsx"),
  "utf8",
);

test("the marketing page carries the app link and both transfer actions without a dialog", () => {
  assert.ok(source.includes("Get LynkShare for Android"));
  assert.equal(source.includes("AppPromo"), false);
  assert.equal(source.includes("showModal"), false);
  assert.ok(source.includes('href="/send"'));
  assert.ok(source.includes('href="/receive"'));
});

test("the marketing page states the web limit and no web unlock", () => {
  assert.ok(source.includes("10 MB total"));
  assert.ok(source.includes("no web unlock"));
});

test("the marketing page avoids unsupported claims", () => {
  for (const claim of [
    /iOS app/i,
    /zero[-\s]knowledge/i,
    /100%\s+client-side/i,
    /no server ever sees/i,
    /free tier/i,
  ]) {
    assert.equal(claim.test(source), false, `found ${claim}`);
  }
});

test("recent activity uses the tab store and renders names as text", () => {
  assert.ok(source.includes("new HistoryStore().list()"));
  assert.ok(source.includes("{record.fileNames"));
  assert.equal(source.includes("dangerouslySetInnerHTML"), false);
  assert.equal(source.includes("localStorage"), false);
});
