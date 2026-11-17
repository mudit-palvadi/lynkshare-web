import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { takeBootFragment } from "../revamp/src/engine/boot.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

test("the boot bridge is single use", () => {
  const target = {
    __lynkBootTake() {
      delete target.__lynkBootTake;
      return "https://lynkshare.app/send/id#key";
    },
  };

  assert.equal(takeBootFragment(target), "https://lynkshare.app/send/id#key");
  assert.equal(takeBootFragment(target), "");
});

test("the classic boot script scrubs the fragment before the module runs", () => {
  const source = readFileSync(join(root, "revamp/boot.js"), "utf8");
  assert.ok(source.includes("window.location.href"));
  assert.ok(source.includes('clean.hash = ""'));
  assert.ok(source.includes("history.replaceState"));
  assert.ok(source.includes("__lynkBootTake"));
  assert.ok(source.includes("delete window.__lynkBootTake"));
});
