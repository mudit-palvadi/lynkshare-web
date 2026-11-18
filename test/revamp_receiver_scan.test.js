import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { attachToPairedReceiver } from "../revamp/src/transfer/send/paired-receiver.js";
import { isCameraScanSupported } from "../revamp/src/transfer/send/scan-receiver.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(
  join(root, "revamp/src/transfer/send/SendScreen.jsx"),
  "utf8",
);
const scanner = readFileSync(
  join(root, "revamp/src/transfer/send/scan-receiver.js"),
  "utf8",
);

test("attaching to a paired receiver wraps the key for its public key", async () => {
  const calls = [];
  const wrapped = await attachToPairedReceiver({
    api: {
      async attachTransfer(...args) {
        calls.push(["attachTransfer", ...args]);
      },
    },
    pair: { sessionId: "session-1", publicKeyB64: "receiver-key" },
    transferId: "transfer-1",
    key: "file-key",
    accessToken: "access-token",
    wrap: async (args) => {
      calls.push(["wrap", args]);
      return "wrapped-key";
    },
  });

  assert.equal(wrapped, "wrapped-key");
  assert.deepEqual(calls[0], [
    "wrap",
    {
      aesKey: "file-key",
      receiverPublicKeyB64: "receiver-key",
      sessionId: "session-1",
      accessToken: "access-token",
    },
  ]);
  assert.deepEqual(calls[1], [
    "attachTransfer",
    "session-1",
    "transfer-1",
    "wrapped-key",
  ]);
});

test("the scanner decodes receiver links with a camera or jsQR", () => {
  assert.ok(scanner.includes("getUserMedia"));
  assert.ok(scanner.includes("jsQR"));
  assert.ok(scanner.includes("/receive/"));
  assert.equal(isCameraScanSupported(), false);
});

test("the send screen offers receiver QR scanning and attaches after upload", () => {
  assert.ok(source.includes("scanReceiverCode"));
  assert.ok(source.includes("parseReceiverQrLink"));
  assert.ok(source.includes("attachToPairedReceiver"));
  assert.ok(source.includes("Scan their receiver code"));
  assert.ok(source.includes("<video"));
});
