// Guards product claims that the website must not make. The web app and the
// Android app are the products; there is no iOS app, and the server does store
// session metadata and ciphertext even though it never receives the file key.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFileSync(join(root, relative), "utf8");

const pages = ["index.html", "app/send.html", "app/receive.html"];

const forbidden = [
  /iOS app/i,
  /"operatingSystem"\s*:\s*"[^"]*iOS/,
  /zero mathematical visibility/i,
  /zero[-\s]knowledge/i,
  /100%\s+client-side/i,
  /free tier/i,
  /no server ever sees/i,
];

test("the website does not claim an iOS app or absolute server invisibility", () => {
  for (const page of pages) {
    const content = read(page);
    for (const claim of forbidden) {
      assert.equal(
        claim.test(content),
        false,
        `${page} still makes the claim ${claim}`,
      );
    }
  }
});

test("the structured data lists web and Android only", () => {
  const index = read("index.html");
  assert.match(index, /"operatingSystem"\s*:\s*"Web, Android"/);
  assert.equal(index.includes('"operatingSystem": "Web, Android, iOS"'), false);
});
