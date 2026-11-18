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

test("the send result renders the code and polling state", () => {
  assert.ok(source.includes("createSenderSession"));
  assert.ok(source.includes("readSenderJoin"));
  assert.ok(source.includes("attachSenderCode"));
  assert.ok(source.includes("{codeSession.code}"));
  assert.ok(source.includes("Key check"));
});

test("the sender confirms the receiver before wrapping the code key", () => {
  assert.ok(source.includes('status: "joined"'));
  assert.ok(source.includes("Share with this device"));
  assert.ok(source.includes("Not this device"));
  assert.equal((source.match(/attachSenderCode\(\{/g) ?? []).length, 1);
  assert.ok(source.includes("cancelSenderSession"));
});
