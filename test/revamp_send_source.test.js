import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(
  join(root, "revamp/src/transfer/send/SendScreen.jsx"),
  "utf8",
);

test("the send screen does not store the key or link in web storage", () => {
  assert.equal(source.includes("localStorage"), false);
  assert.equal(source.includes("sessionStorage"), false);
});

test("file names are rendered as React text, never raw HTML", () => {
  assert.equal(source.includes("dangerouslySetInnerHTML"), false);
  assert.ok(source.includes("{file.name}"));
});

test("the send screen uses the shared validation and encryption engine", () => {
  assert.ok(source.includes("validateSelection"));
  assert.ok(source.includes("encryptWithIvPrefix"));
  assert.ok(source.includes("createTransfer"));
  assert.ok(source.includes("buildSendLink"));
});

test("the copy action reads the link from memory, not a visible field", () => {
  assert.ok(source.includes("navigator.clipboard.writeText(result.link)"));
  assert.equal(source.includes("href={result.link}"), false);
  assert.equal(source.includes("{result.link}</"), false);
});
