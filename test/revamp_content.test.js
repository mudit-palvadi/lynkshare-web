import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (name) => readFileSync(join(root, "revamp", name), "utf8");

const pages = [
  "about.html",
  "how-it-works.html",
  "faq.html",
  "privacy.html",
  "guides.html",
  "guides/direct-vs-cloud.html",
  "guides/cross-device-transfer.html",
  "guides/receive-on-iphone.html",
  "guides/sender-qr-vs-receiver-qr.html",
  "guides/expired-link.html",
  "guides/web-vs-app-limits.html",
];

function text(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

test("every content page has metadata, a header slot and real copy", () => {
  for (const page of pages) {
    const html = read(page);
    assert.match(html, /<title>[^<]+<\/title>/, `${page} has no title`);
    assert.match(html, /name="description"/, `${page} has no description`);
    assert.match(html, /rel="canonical"/, `${page} has no canonical`);
    assert.ok(html.includes("<!-- SITE_HEADER -->"), `${page} has no header slot`);
    assert.ok(html.includes("<!-- SITE_FOOTER -->"), `${page} has no footer slot`);
    const minimum = page === "guides.html" ? 500 : 1200;
    assert.ok(text(html).length > minimum, `${page} is too thin`);
  }
});

test("the guides hub links every guide that exists", () => {
  const hub = read("guides.html");
  for (const path of [
    "/guides/direct-vs-cloud",
    "/guides/cross-device-transfer",
    "/guides/receive-on-iphone",
    "/guides/sender-qr-vs-receiver-qr",
    "/guides/expired-link",
    "/guides/web-vs-app-limits",
  ]) {
    assert.ok(hub.includes(`href="${path}"`), `hub is missing ${path}`);
  }
});

test("the FAQ answers the free and retention questions", () => {
  const faq = read("faq.html");
  assert.ok(faq.includes("Is LynkShare free?"));
  assert.ok(faq.includes("completely free"));
  assert.ok(faq.includes("deleted within 24 hours"));
  assert.ok(faq.includes("no iOS app"));
  assert.equal(/Can I self-host it\?/.test(faq), false);
});

test("cross-device copy is not framed as Android to laptop", () => {
  const guide = read("guides/cross-device-transfer.html");
  assert.equal(/Android to laptop/i.test(guide), false);
  assert.ok(guide.includes("two laptops"));
  assert.ok(guide.includes("two phones"));
  assert.ok(guide.includes("no iOS app"));
});

test("the content set does not add help, terms, security or contact pages", () => {
  for (const page of pages) {
    const html = read(page);
    for (const path of ['href="/help"', 'href="/terms"', 'href="/security"', 'href="/contact"']) {
      assert.equal(html.includes(path), false, `${page} links ${path}`);
    }
  }
});

test("the new redirects map clean content URLs", () => {
  const redirects = read("_redirects");
  for (const path of [
    "/about",
    "/how-it-works",
    "/faq",
    "/privacy",
    "/guides",
    "/guides/direct-vs-cloud",
    "/guides/cross-device-transfer",
    "/guides/receive-on-iphone",
    "/guides/sender-qr-vs-receiver-qr",
    "/guides/expired-link",
    "/guides/web-vs-app-limits",
  ]) {
    assert.ok(redirects.includes(`${path} `), `missing redirect for ${path}`);
  }
});

test("the sitemap lists the content and guide pages", () => {
  const sitemap = read("sitemap.xml");
  for (const path of [
    "/about",
    "/how-it-works",
    "/faq",
    "/privacy",
    "/guides",
    "/guides/direct-vs-cloud",
    "/guides/cross-device-transfer",
    "/guides/receive-on-iphone",
    "/guides/sender-qr-vs-receiver-qr",
    "/guides/expired-link",
    "/guides/web-vs-app-limits",
  ]) {
    assert.ok(
      sitemap.includes(`https://lynkshare.app${path}</loc>`),
      `sitemap is missing ${path}`,
    );
  }
});
