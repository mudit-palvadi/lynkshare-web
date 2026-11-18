import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildDeliveryLink,
  buildReceiverLink,
  readReceiverAttachment,
  startReceiverPairing,
} from "../revamp/src/transfer/receive/receiver-pairing.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(
  join(root, "revamp/src/transfer/receive/ReceiveScreen.jsx"),
  "utf8",
);

test("the receiver link carries the public key in the fragment", () => {
  assert.equal(
    buildReceiverLink({
      origin: "https://lynkshare.app/",
      sessionId: "session-1",
      publicKeyB64: "public-key",
    }),
    "https://lynkshare.app/receive/session-1#pk=public-key",
  );
  assert.equal(
    buildReceiverLink({
      origin: "https://lynkshare.app",
      sessionId: "session-1",
      publicKeyB64: "public-key",
      version: 2,
    }),
    "https://lynkshare.app/receive/session-1#pk=public-key&v=2",
  );
});

test("starting a receiver pairing creates a session and a key pair", async () => {
  const calls = [];
  const api = {
    async createReceiverSession() {
      calls.push("createReceiverSession");
      return { sessionId: "session-1", status: "waiting", expiresIn: 600 };
    },
  };
  const pairing = await startReceiverPairing({
    api,
    origin: "https://lynkshare.app",
    generateKeyPair: async () => ({
      publicKeyB64: "public-key",
      privateKeySeed: new Uint8Array([1, 2, 3]),
    }),
    version: 2,
  });

  assert.deepEqual(calls, ["createReceiverSession"]);
  assert.equal(pairing.sessionId, "session-1");
  assert.equal(pairing.expiresIn, 600);
  assert.equal(pairing.publicKeyB64, "public-key");
  assert.equal(
    pairing.link,
    "https://lynkshare.app/receive/session-1#pk=public-key&v=2",
  );
  assert.equal(pairing.privateKeySeed.length, 3);
});

test("an unattached receiver session yields no delivery", async () => {
  const delivery = await readReceiverAttachment({
    api: {
      async getReceiverSession() {
        return { status: "waiting", transferId: null, wrappedKey: null };
      },
    },
    sessionId: "session-1",
    privateKeySeed: new Uint8Array([1]),
    unwrap: async () => {
      throw new Error("must not unwrap before attach");
    },
  });
  assert.equal(delivery, null);
});

test("an attached receiver session unwraps the key and token", async () => {
  const calls = [];
  const delivery = await readReceiverAttachment({
    api: {
      async getReceiverSession(sessionId) {
        calls.push(["session", sessionId]);
        return {
          status: "attached",
          transferId: "transfer-1",
          wrappedKey: "wrapped",
        };
      },
    },
    sessionId: "session-1",
    privateKeySeed: new Uint8Array([1]),
    unwrap: async (args) => {
      calls.push(["unwrap", args.sessionId, args.wrappedBase64]);
      return { aesKey: "key", accessToken: "token" };
    },
  });

  assert.deepEqual(calls, [
    ["session", "session-1"],
    ["unwrap", "session-1", "wrapped"],
  ]);
  assert.deepEqual(delivery, {
    transferId: "transfer-1",
    aesKey: "key",
    accessToken: "token",
  });
});

test("the delivery link is the normal transfer link", () => {
  assert.equal(
    buildDeliveryLink({
      origin: "https://lynkshare.app",
      transferId: "transfer-1",
      aesKey: "key",
      accessToken: "token",
    }),
    "https://lynkshare.app/send/transfer-1#key&a=token",
  );
});

test("the receive screen renders the receiver QR and keeps the key in memory", () => {
  assert.ok(source.includes("QRCodeSVG"));
  assert.ok(source.includes("startReceiverPairing"));
  assert.ok(source.includes("readReceiverAttachment"));
  assert.equal(source.includes("localStorage"), false);
  assert.equal(source.includes("sessionStorage"), false);
  assert.equal(source.includes("dangerouslySetInnerHTML"), false);
});
