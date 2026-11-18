import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { startDirectShare } from "../revamp/src/transfer/send/direct-send.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(
  join(root, "revamp/src/transfer/send/SendScreen.jsx"),
  "utf8",
);

function fakeFile(name, text) {
  const bytes = new TextEncoder().encode(text);
  return {
    name,
    size: bytes.length,
    arrayBuffer: async () => bytes.buffer,
  };
}

function fakeApi(order, created) {
  return {
    async createTransfer(files) {
      order.push("create");
      return {
        transferId: "transfer-1",
        senderSecret: "sender-secret",
        accessToken: "access-token",
        expiresIn: 600,
        files: files.map((file, index) => ({
          fileId: `file-${index}`,
          fileName: file.name,
          uploadUrl: `https://r2.example/${index}`,
        })),
      };
    },
    async completeFile() {
      order.push("complete");
    },
  };
}

test("a delivered direct transfer skips the cloud upload", async () => {
  const order = [];
  const ready = [];
  const statuses = [];
  const result = await startDirectShare({
    files: [fakeFile("note.txt", "hello")],
    key: "0123456789abcdef0123456789abcdef",
    origin: "https://lynkshare.app",
    api: fakeApi(order),
    apiBase: "https://api.lynkshare.app",
    fetch: async () => {
      order.push("upload");
      return { ok: true, status: 200 };
    },
    onReady: (share) => {
      order.push("ready");
      ready.push(share);
    },
    onStatus: (event) => statuses.push(event),
    send: async (args) => {
      order.push(["send", args.sessionId]);
      args.onStatus("p2p-connected");
      args.onStatus("p2p-delivered");
      return true;
    },
  });

  assert.equal(result.delivered, true);
  assert.deepEqual(order, ["create", "ready", ["send", "transfer-1"]]);
  assert.equal(ready[0].transferId, "transfer-1");
  assert.equal(
    ready[0].link,
    "https://lynkshare.app/send/transfer-1#0123456789abcdef0123456789abcdef&a=access-token",
  );
  assert.deepEqual(statuses, ["p2p-connected", "p2p-delivered"]);
});

test("a failed direct attempt uploads the same transfer", async () => {
  const order = [];
  const ready = [];
  const result = await startDirectShare({
    files: [fakeFile("note.txt", "hello")],
    key: "0123456789abcdef0123456789abcdef",
    origin: "https://lynkshare.app",
    api: fakeApi(order),
    apiBase: "https://api.lynkshare.app",
    fetch: async () => {
      order.push("upload");
      return { ok: true, status: 200 };
    },
    onReady: (share) => ready.push(share),
    send: async (args) => {
      order.push(["send", args.sessionId]);
      args.onStatus("p2p-failed:timeout");
      return false;
    },
  });

  assert.equal(result.delivered, false);
  assert.deepEqual(order.slice(0, 3), ["create", ["send", "transfer-1"], "upload"]);
  assert.ok(order.includes("complete"));
  assert.equal(ready[0].transferId, result.session.transferId);
});

test("the send screen offers Direct when the browser supports it", () => {
  assert.ok(source.includes("startDirectShare"));
  assert.ok(source.includes("isP2pSupported"));
  assert.equal(
    source.includes('className="choice" type="button" disabled'),
    false,
  );
});
