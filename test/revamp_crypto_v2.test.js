import { test } from "node:test";
import assert from "node:assert/strict";
import {
  decryptFileBytes,
  decryptWithGcm,
  encryptWithGcm,
  encryptWithIvPrefix,
  generateGcmKey,
} from "../revamp/src/engine/index.js";

test("version 2 wraps a 12-byte nonce and decrypts the same bytes", async () => {
  const key = generateGcmKey();
  const plain = new TextEncoder().encode("hello version two");
  const packed = await encryptWithGcm(plain, key);

  assert.equal(packed.length, plain.length + 12 + 16);
  const recovered = await decryptWithGcm(packed, key);
  assert.deepEqual(recovered, plain);
});

test("a wrong version-2 key fails closed", async () => {
  const packed = await encryptWithGcm(
    new TextEncoder().encode("secret"),
    generateGcmKey(),
  );
  await assert.rejects(
    decryptWithGcm(packed, generateGcmKey()),
    /operation failed|decrypt/i,
  );
});

test("the file-cipher dispatcher keeps version 1 working", async () => {
  const key = "0123456789abcdef0123456789abcdef";
  const plain = new TextEncoder().encode("legacy");
  const packed = await encryptWithIvPrefix(plain, key);
  const recovered = await decryptFileBytes({ version: 1, key, packed });
  assert.deepEqual(recovered, plain);
});

test("the file-cipher dispatcher reads version 2", async () => {
  const key = generateGcmKey();
  const plain = new TextEncoder().encode("new format");
  const packed = await encryptWithGcm(plain, key);
  const recovered = await decryptFileBytes({ version: 2, key, packed });
  assert.deepEqual(recovered, plain);
});

test("a version-2 key is base64url without padding", () => {
  const key = generateGcmKey();
  assert.match(key, /^[A-Za-z0-9_-]+$/);
  assert.equal(key.includes("="), false);
  assert.equal(key.length, 43);
});
