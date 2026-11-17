import { test } from "node:test";
import assert from "node:assert/strict";
import {
  encryptWithGcm,
  encryptWithIvPrefix,
  generateGcmKey,
} from "../revamp/src/engine/index.js";
import {
  downloadShare,
  loadTransferMetadata,
} from "../revamp/src/transfer/receive/share-receive.js";

test("the share receive path decrypts and saves the original bytes", async () => {
  const key = "0123456789abcdef0123456789abcdef";
  const packed = await encryptWithIvPrefix(
    new TextEncoder().encode("hello"),
    key,
  );
  const calls = [];
  const api = {
    async getDownloadUrls(transferId, accessToken) {
      calls.push(["downloads", transferId, accessToken]);
      return [
        {
          fileId: "file-1",
          fileName: "note.txt",
          downloadUrl: "https://r2.example/file",
        },
      ];
    },
  };
  const fetch = async (url) => {
    calls.push(["fetch", url]);
    return {
      ok: true,
      status: 200,
      arrayBuffer: async () => packed.buffer,
    };
  };
  const saved = [];

  const names = await downloadShare({
    api,
    transferId: "transfer-1",
    accessToken: "access-token",
    key,
    fetch,
    save: async (file) => saved.push(file),
  });

  assert.deepEqual(names, ["note.txt"]);
  assert.equal(calls[0][0], "downloads");
  assert.equal(calls[1][1], "https://r2.example/file");
  assert.equal(saved[0].name, "note.txt");
  assert.equal(new TextDecoder().decode(saved[0].bytes), "hello");
});

test("the share receive path reads a version-2 file", async () => {
  const key = generateGcmKey();
  const packed = await encryptWithGcm(
    new TextEncoder().encode("new format"),
    key,
  );
  const api = {
    async getDownloadUrls() {
      return [
        {
          fileId: "file-2",
          fileName: "new.txt",
          downloadUrl: "https://r2.example/new",
        },
      ];
    },
  };
  const saved = [];
  const names = await downloadShare({
    api,
    transferId: "transfer-2",
    accessToken: "token",
    key,
    version: 2,
    fetch: async () => ({
      ok: true,
      status: 200,
      arrayBuffer: async () => packed.buffer,
    }),
    save: async (file) => saved.push(file),
  });

  assert.deepEqual(names, ["new.txt"]);
  assert.equal(new TextDecoder().decode(saved[0].bytes), "new format");
});

test("metadata is loaded with the access token", async () => {
  const api = {
    async getTransferMetadata(transferId, accessToken) {
      return { transferId, accessToken, status: "ready", files: [] };
    },
  };
  const metadata = await loadTransferMetadata({
    api,
    transferId: "transfer-1",
    accessToken: "access-token",
  });
  assert.equal(metadata.transferId, "transfer-1");
  assert.equal(metadata.accessToken, "access-token");
});
