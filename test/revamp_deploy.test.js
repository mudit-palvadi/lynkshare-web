import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (name) => readFileSync(join(root, name), "utf8");

test("Wrangler points the existing lynk-web Worker at dist", () => {
  const config = JSON.parse(read("wrangler.jsonc"));
  assert.equal(config.name, "lynk-web");
  assert.equal(config.assets.directory, "./dist");
  // Rewriting /about to /about.html would loop if Workers also canonicalizes
  // /about.html back to /about, so HTML handling stays off.
  assert.equal(config.assets.html_handling, "none");
});

test("the deployed headers keep the site on HTTPS and the key realm strict", () => {
  const headers = read("revamp/_headers");
  assert.ok(headers.includes("Strict-Transport-Security: max-age=31536000"));
  assert.ok(headers.includes("Permissions-Policy: camera=(self)"));
  assert.ok(headers.includes("script-src 'self'"));
  assert.equal(headers.includes("googlesyndication"), false);
  assert.equal(headers.includes("unsafe-eval"), false);
  assert.ok(headers.includes("connect-src 'self' https://api.lynkshare.app"));
  assert.ok(headers.includes("frame-ancestors 'none'"));
});

test("the built redirects keep the clean content URLs", () => {
  const redirects = read("revamp/_redirects");
  assert.ok(redirects.includes("/ /index.html 200"));
  assert.ok(redirects.includes("/index.html / 301"));
  assert.ok(redirects.includes("/about /about.html 200"));
  assert.ok(redirects.includes("/faq /faq.html 200"));
  assert.ok(redirects.includes("/guides/web-vs-app-limits /guides/web-vs-app-limits.html 200"));
  assert.ok(redirects.includes("/app/send /send 301"));
});

test("the web repository now carries GPL-3.0", () => {
  const license = read("LICENSE");
  assert.match(license, /GNU GENERAL PUBLIC LICENSE/);
  assert.match(license, /Version 3, 29 June 2007/);
});
