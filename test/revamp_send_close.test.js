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

test("the send result avoids implementation details", () => {
  assert.equal(source.includes("The key stays in the link fragment"), false);
  assert.equal(
    source.includes("Waiting for the receiver to enter this code"),
    false,
  );
});

test("the sender can close the session after confirming", () => {
  assert.ok(source.includes("Close this session for everyone?"));
  assert.ok(source.includes("Keep open"));
  assert.ok(source.includes("cancelTransfer"));
  assert.ok(source.includes("cancelSenderSession"));
  assert.ok(source.includes('resetSendForm("Session closed.")'));
});
