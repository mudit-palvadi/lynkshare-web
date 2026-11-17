import { test } from "node:test";
import assert from "node:assert/strict";
import { createCloudShare } from "../revamp/src/transfer/send/cloud-send.js";

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
