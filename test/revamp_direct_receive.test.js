import { test } from "node:test";
import assert from "node:assert/strict";
import { encryptWithIvPrefix } from "../revamp/src/engine/index.js";
import { receiveDirectOnce } from "../revamp/src/transfer/receive/receive-flow.js";
import { downloadShare } from "../revamp/src/transfer/receive/share-receive.js";

test("a direct receive saves sanitized names and completes", async () => {
  const saved = [];
  const statuses = [];
  const attempt = receiveDirectOnce({
    apiBase: "https://api.lynkshare.app",
    transferId: "transfer-1",
    accessToken: "token",
    aesKey: "key",
    expectedFiles: 1,
    receive: ({ onStatus, onFileSaved, onComplete }) => {
      onStatus("p2p-connected");
      onStatus("p2p-header", { name: "../note.txt" });
      onFileSaved(new Uint8Array([1, 2]), "../note.txt");
      onStatus("p2p-progress", { received: 2, expected: 2 });
      onComplete();
      return () => {};
    },
    onStatus: (event) => statuses.push(event),
    onSave: (file) => saved.push(file),
  });

  const result = await attempt.promise;
  assert.equal(result.status, "delivered");
  assert.deepEqual(result.names, ["note.txt"]);
  assert.equal(saved[0].name, "note.txt");
  assert.deepEqual(saved[0].bytes, new Uint8Array([1, 2]));
  assert.deepEqual(statuses, [
    "p2p-connected",
    "p2p-header",
    "p2p-progress",
  ]);
});

test("a failed direct receive reports the files it already saved", async () => {
  const attempt = receiveDirectOnce({
    apiBase: "https://api.lynkshare.app",
    transferId: "transfer-1",
    accessToken: "token",
    aesKey: "key",
    expectedFiles: 2,
    receive: ({ onStatus, onFileSaved }) => {
      onStatus("p2p-connected");
      onFileSaved(new Uint8Array([1]), "first.txt");
      onStatus("p2p-failed:confirmation-timeout");
      return () => {};
    },
  });

  const result = await attempt.promise;
  assert.equal(result.status, "failed");
  assert.equal(result.connected, true);
  assert.deepEqual(result.names, ["first.txt"]);
});

test("a direct receive that never connects times out", async () => {
  const attempt = receiveDirectOnce({
    apiBase: "https://api.lynkshare.app",
    transferId: "transfer-1",
    accessToken: "token",
    aesKey: "key",
    expectedFiles: 1,
    connectionTimeoutMs: 5,
    receive: () => () => {},
  });

  const result = await attempt.promise;
  assert.equal(result.status, "unavailable");
  assert.equal(result.connected, false);
});

test("cancelling a direct receive stops it without starting the cloud", async () => {
  let cleaned = false;
  const attempt = receiveDirectOnce({
    apiBase: "https://api.lynkshare.app",
    transferId: "transfer-1",
    accessToken: "token",
    aesKey: "key",
    expectedFiles: 1,
    receive: () => () => {
      cleaned = true;
    },
  });

  attempt.cancel();
  const result = await attempt.promise;
  assert.equal(result.status, "cancelled");
  assert.equal(cleaned, true);
});

test("the cloud path waits for a sender that is still uploading", async () => {
  const key = "0123456789abcdef0123456789abcdef";
  const packed = await encryptWithIvPrefix(
    new TextEncoder().encode("hello"),
    key,
  );
  const calls = [];
  let downloads = 0;
  const api = {
    async getDownloadUrls() {
      downloads += 1;
      calls.push(["downloads", downloads]);
      if (downloads === 1) {
        const err = new Error("not ready");
        err.status = 409;
        throw err;
      }
      return [
        {
          fileId: "file-1",
          fileName: "note.txt",
          downloadUrl: "https://r2.example/file",
        },
      ];
    },
    async getTransferMetadata() {
      calls.push(["metadata"]);
      return { status: "ready", files: [] };
    },
  };
  const saved = [];
  const names = await downloadShare({
    api,
    transferId: "transfer-1",
    accessToken: "token",
    key,
    waitForReady: true,
    onWait: () => calls.push(["wait"]),
    fetch: async () => ({
      ok: true,
      status: 200,
      arrayBuffer: async () => packed.buffer,
    }),
    save: async (file) => saved.push(file),
  });

  assert.deepEqual(names, ["note.txt"]);
  assert.deepEqual(calls, [
    ["downloads", 1],
    ["wait"],
    ["metadata"],
    ["downloads", 2],
  ]);
  assert.equal(new TextDecoder().decode(saved[0].bytes), "hello");
});
