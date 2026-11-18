import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (name) => readFileSync(join(root, name), "utf8");

test("marketing carries canonical, social and structured metadata", () => {
  const html = read("revamp/index.html");
  assert.ok(html.includes('rel="canonical"'));
  assert.ok(html.includes('property="og:title"'));
  assert.ok(html.includes('property="og:description"'));
  assert.ok(html.includes('name="twitter:card"'));
  assert.ok(html.includes('"@type": "SoftwareApplication"'));
  assert.ok(html.includes('"operatingSystem": "Web, Android"'));
  assert.ok(html.includes('"@type": "FAQPage"'));
  assert.equal(/iOS/.test(html), false);
});

test("the transfer document never uses a file name in its social card", () => {
  const html = read("revamp/transfer.html");
  assert.ok(html.includes('property="og:title"'));
  assert.ok(html.includes('property="og:description"'));
  assert.ok(html.includes('name="twitter:card"'));
  assert.equal(html.includes("file_name"), false);
  assert.equal(html.includes("fileName"), false);
});

test("the transfer document points at the API origin", () => {
  const html = read("revamp/transfer.html");
  assert.ok(
    html.includes(
      'name="lynk-api-base" content="https://api.lynkshare.app"',
    ),
  );
});

test("id routes get noindex from the edge, not a static marketing meta", () => {
  const transfer = read("revamp/transfer.html");
  assert.equal(transfer.includes('name="robots"'), false);
});
