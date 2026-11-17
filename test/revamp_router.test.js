import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isLegacyAppPath,
  parseTransferRoute,
} from "../revamp/src/transfer/router.js";

test("marketing and empty tool routes stay distinct", () => {
  assert.deepEqual(parseTransferRoute("/"), { kind: "marketing" });
  assert.deepEqual(parseTransferRoute("/send"), { kind: "send" });
  assert.deepEqual(parseTransferRoute("/receive"), { kind: "receive" });
  assert.deepEqual(parseTransferRoute("/send/"), { kind: "send" });
  assert.deepEqual(parseTransferRoute("/receive/"), { kind: "receive" });
});

test("a send link is a receive screen, not the send form", () => {
  assert.deepEqual(parseTransferRoute("/send/abc123"), {
    kind: "share",
    transferId: "abc123",
  });
});

test("a pairing fragment is not parsed as a file key", () => {
  assert.deepEqual(
    parseTransferRoute("/receive/session-1", "#pk=public-key&v=2"),
    {
      kind: "pairing",
      sessionId: "session-1",
      publicKey: "public-key",
      version: 2,
    },
  );
  assert.equal(
    parseTransferRoute("/receive/session-1", "#pk=").kind,
    "error",
  );
});

test("a receive id without pk is not a transfer link", () => {
  assert.deepEqual(parseTransferRoute("/receive/session-1"), {
    kind: "error",
    reason: "not-a-transfer-link",
  });
});

test("legacy app paths are marked for the server redirect", () => {
  for (const path of [
    "/app/send",
    "/app/send.html",
    "/app/receive",
    "/app/receive.html",
  ]) {
    assert.equal(isLegacyAppPath(path), true);
    assert.equal(parseTransferRoute(path).kind, "legacy");
  }
});

test("unknown paths do not become a transfer id", () => {
  assert.deepEqual(parseTransferRoute("/nope"), { kind: "not-found" });
  assert.deepEqual(parseTransferRoute("/sendish/abc"), { kind: "not-found" });
});
