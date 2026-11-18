import { test } from "node:test";
import assert from "node:assert/strict";
import { createCloudShare } from "../revamp/src/transfer/send/cloud-send.js";
import { decryptWithGcm } from "../revamp/src/engine/crypto-v2.js";

function fakeFile(name, text) {
  const bytes = new TextEncoder().encode(text);
  return {
    name,
    size: bytes.length,
    arrayBuffer: async () => bytes.buffer,
  };
}

test("cloud send encrypts, uploads, completes and returns the link", async () => {
  const key = "0123456789abcdef0123456789abcdef";
  const calls = [];
  const created = {
    transferId: "transfer-1",
    senderSecret: "sender-secret",
    accessToken: "access-token",
    expiresIn: 600,
    files: [
      {
        fileId: "file-1",
        fileName: "note.txt",
        uploadUrl: "https://r2.example/upload",
      },
    ],
  };
  const api = {
    async createTransfer(files) {
      calls.push(["createTransfer", files]);
      return created;
    },
    async completeFile(transferId, fileId, senderSecret) {
      calls.push(["completeFile", transferId, fileId, senderSecret]);
    },
  };
  const fetch = async (url, options) => {
    calls.push(["upload", url, options]);
    return { ok: true, status: 200 };
  };
  const progress = [];

  const share = await createCloudShare({
    files: [fakeFile("note.txt", "hello")],
    key,
    version: 1,
    origin: "https://lynkshare.app",
    api,
    fetch,
    onProgress: (event) => progress.push(event),
  });

  assert.equal(share.transferId, "transfer-1");
  assert.equal(share.expiresIn, 600);
  assert.equal(share.fileNames[0], "note.txt");
  assert.equal(share.totalSize, 5);
  assert.equal(
    share.link,
    `https://lynkshare.app/send/transfer-1#${key}&a=access-token`,
  );

  const create = calls.find((call) => call[0] === "createTransfer");
  assert.equal(create[1].length, 1);
  assert.equal(create[1][0].name, "note.txt");
  assert.equal(create[1][0].size, 32);

  const upload = calls.find((call) => call[0] === "upload");
  assert.equal(upload[1], created.files[0].uploadUrl);
  assert.equal(upload[2].method, "PUT");
  assert.equal(upload[2].headers["Content-Type"], "application/octet-stream");
  assert.ok(upload[2].body instanceof Uint8Array);

  assert.deepEqual(
    calls.find((call) => call[0] === "completeFile"),
    ["completeFile", "transfer-1", "file-1", "sender-secret"],
  );
  assert.equal(progress.at(-1).phase, "done");
  assert.equal(progress.at(-1).progress, 1);
});

test("cloud send writes version 2 with a prefixed key and AES-GCM", async () => {
  const keyBody = "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8";
  const created = {
    transferId: "transfer-2",
    senderSecret: "sender-secret",
    accessToken: "access-token",
    expiresIn: 600,
    files: [
      {
        fileId: "file-1",
        fileName: "note.txt",
        uploadUrl: "https://r2.example/upload",
      },
    ],
  };
  let uploadBody;
  const api = {
    async createTransfer(files) {
      assert.equal(files[0].size, 5 + 28);
      return created;
    },
    async completeFile() {},
  };
  const fetch = async (_url, options) => {
    uploadBody = options.body;
    return { ok: true, status: 200 };
  };

  const share = await createCloudShare({
    files: [fakeFile("note.txt", "hello")],
    key: keyBody,
    version: 2,
    origin: "https://lynkshare.app",
    api,
    fetch,
  });

  assert.equal(
    share.link,
    `https://lynkshare.app/send/transfer-2#2.${keyBody}&a=access-token`,
  );
  assert.equal(share.key, `2.${keyBody}`);
  assert.equal(uploadBody.length, 5 + 28);
  assert.equal(
    new TextDecoder().decode(await decryptWithGcm(uploadBody, keyBody)),
    "hello",
  );
});
