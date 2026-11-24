import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSendLink } from "../js/core/link_builder.js";
import { parseSendLink } from "../js/core/link_parser.js";

const BASE = "https://lynkshare.app";
const TRANSFER_ID = "_s8CuT1G6vCi";
const AES_KEY = "d314956182fd0af22a4797f4a1f2d4e7";
const ACCESS_TOKEN = "mVLh-Cw6JtD560wetHFf6kH3n0wl3w0H96qHm38KCOw";

test("a share link carries the transfer id, the key and the access token", () => {
  const link = buildSendLink(BASE, TRANSFER_ID, AES_KEY, ACCESS_TOKEN);

  assert.equal(link, `${BASE}/send/${TRANSFER_ID}#${AES_KEY}&a=${ACCESS_TOKEN}`);

  const parsed = parseSendLink(new URL(link));
  assert.equal(parsed.transferId, TRANSFER_ID);
  assert.equal(parsed.aesKey, AES_KEY);
  assert.equal(parsed.accessToken, ACCESS_TOKEN);
});

test("a share link without an access token has no capability marker", () => {
  const link = buildSendLink(BASE, TRANSFER_ID, AES_KEY, "");

  assert.equal(link, `${BASE}/send/${TRANSFER_ID}#${AES_KEY}`);
  assert.ok(!link.includes("&a="));
  assert.equal(parseSendLink(new URL(link)).accessToken, "");
});
