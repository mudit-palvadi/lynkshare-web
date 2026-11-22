import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  attachSenderCode,
  readSenderJoin,
} from "../revamp/src/transfer/send/sender-code.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(
  join(root, "revamp/src/transfer/send/SendScreen.jsx"),
  "utf8",
);

test("a sender session with no receiver yields no join", async () => {
  const join = await readSenderJoin({
    api: {
      async getSenderSession() {
        return { receiverPk: null };
      },
    },
    sessionId: "session-1",
  });
  assert.equal(join, null);
});

test("a joined receiver is reported with its key check", async () => {
  const join = await readSenderJoin({
    api: {
      async getSenderSession(sessionId) {
        assert.equal(sessionId, "session-1");
        return { receiverPk: "receiver-key" };
      },
    },
    sessionId: "session-1",
    fingerprint: async (key) => `check:${key}`,
  });
  assert.deepEqual(join, {
    receiverPk: "receiver-key",
    fingerprint: "check:receiver-key",
  });
});

test("the sender wraps the key and attaches it with the transfer mode", async () => {
  const calls = [];
  const wrapped = await attachSenderCode({
    api: {
      async attachSenderKey(...args) {
        calls.push(["attachSenderKey", ...args]);
      },
    },
    session: { sessionId: "session-1", senderSecret: "sender-secret" },
    transferId: "transfer-1",
    key: "file-key",
    accessToken: "access-token",
    mode: "p2p",
    receiverPk: "receiver-key",
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
    "attachSenderKey",
    "session-1",
    "transfer-1",
    "wrapped-key",
    "p2p",
    "sender-secret",
  ]);
});

test("the sender attaches the key as soon as a receiver joins", () => {
  assert.ok(source.includes("createSenderSession"));
  assert.ok(source.includes("readSenderJoin"));
  assert.ok(source.includes("attachSenderCode"));
  assert.equal(source.includes('status: "joined"'), false);
  assert.equal(source.includes("Share with this device"), false);
  assert.equal(source.includes("Not this device"), false);
  assert.equal((source.match(/attachSenderCode\(\{/g) ?? []).length, 1);
  assert.match(
    source,
    /if \(join\) \{[\s\S]*?status: "attaching"[\s\S]*?attachSenderCode\(\{/,
  );
  assert.ok(source.includes("cancelSenderSession"));
});

test("the code panel keeps the key check as information, not a gate", () => {
  assert.ok(source.includes("{codeSession.code}"));
  assert.ok(source.includes("Key check"));
  assert.ok(source.includes('status: "attached"'));
  assert.ok(source.includes("A device joined — sharing the key…"));
  assert.ok(source.includes("Receiver joined — files unlocked."));
});
