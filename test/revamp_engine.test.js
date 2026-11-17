import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseFileCipherVersion,
  parseFileFragment,
} from "../revamp/src/engine/format.js";

test("a legacy 32-character key stays version 1", () => {
  const value = parseFileCipherVersion("0123456789abcdef0123456789abcdef");
  assert.equal(value.version, 1);
  assert.equal(value.key, "0123456789abcdef0123456789abcdef");
});

test("a 2. key is version 2 and the marker is removed", () => {
  const key = "2.abcDEF0123456789-_abcDEF0123456789-_abcDEF0";
  const value = parseFileCipherVersion(key);
  assert.equal(value.version, 2);
  assert.equal(value.key, key.slice(2));
});

test("the fragment keeps the access token after the key", () => {
  const value = parseFileFragment(
    "#0123456789abcdef0123456789abcdef&a=access-token",
  );
  assert.equal(value.version, 1);
  assert.equal(value.key, "0123456789abcdef0123456789abcdef");
  assert.equal(value.accessToken, "access-token");
});

test("a version 2 fragment parses its token", () => {
  const value = parseFileFragment("#2.key-body&a=token");
  assert.deepEqual(value, {
    version: 2,
    key: "key-body",
    accessToken: "token",
  });
});

test("missing fragments degrade to an empty version 1 key", () => {
  assert.deepEqual(parseFileFragment(""), {
    version: 1,
    key: "",
    accessToken: "",
  });
});
