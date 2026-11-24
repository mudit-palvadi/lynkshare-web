import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { toWebSocketUrl } from "../js/core/p2p_session.js";

test("the transfer document uses the public TLS signaling endpoint", () => {
  const html = readFileSync(new URL("../revamp/transfer.html", import.meta.url), "utf8");
  const base = html.match(/name="lynk-api-base" content="([^"]+)"/)?.[1];
  assert.equal(base, "https://api.lynkshare.app");
  assert.equal(
    toWebSocketUrl(base, "contract-room"),
    "wss://api.lynkshare.app/ws/signaling/contract-room",
  );
});

test("signaling room ids cannot change the endpoint path or query", () => {
  const url = new URL(toWebSocketUrl("https://api.lynkshare.app", "room/other?token=secret#x"));
  assert.equal(url.pathname, "/ws/signaling/room%2Fother%3Ftoken%3Dsecret%23x");
  assert.equal(url.search, "");
  assert.equal(url.hash, "");
});
