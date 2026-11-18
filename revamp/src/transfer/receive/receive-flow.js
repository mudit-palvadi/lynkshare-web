import { receiveViaP2p, safeFileName } from "../../engine/index.js";

/**
 * A single direct-receive attempt. Resolves with the files that were handed
 * to the browser and a status, and can be cancelled by the page.
 *
 * Only the connection is timed out. Once a peer connects, the transfer is
 * allowed to finish; the engine has its own protocol timeouts.
 */
export function receiveDirectOnce({
  apiBase,
  transferId,
  accessToken,
  aesKey,
  expectedFiles,
  expectedBytes,
  connectionTimeoutMs = 30_000,
  onStatus = () => {},
  onProgress = () => {},
  onSave = () => {},
  receive = receiveViaP2p,
}) {
  const names = [];
  let connected = false;
  let settled = false;
  let cleanup;
  let timer;
  let resolvePromise;

  const promise = new Promise((resolve) => {
    resolvePromise = resolve;
  });

  const finish = (status, reason = "") => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    try {
      cleanup?.();
    } catch {
      // The engine is already closing its own resources.
    }
    resolvePromise({ status, reason, names: [...names], connected });
  };

  timer = setTimeout(() => {
    finish(connected ? "timeout" : "unavailable");
  }, connectionTimeoutMs);

  cleanup = receive({
    apiBase,
    transferId,
    aesKey,
    accessToken,
    expectedFiles,
    expectedBytes,
    onStatus: (event, info) => {
      if (
        event === "p2p-connected" ||
        event === "p2p-header" ||
        event === "p2p-progress"
      ) {
        connected = true;
        clearTimeout(timer);
      }
      if (event === "p2p-progress") {
        onProgress({
          received: info?.received ?? 0,
          expected: info?.expected ?? 0,
        });
      }
      if (typeof event === "string" && event.startsWith("p2p-failed")) {
        finish("failed", event);
      }
      onStatus(event, info);
    },
    onFileSaved: (plaintext, name) => {
      const safe = safeFileName(name);
      onSave({ name: safe, bytes: plaintext });
      names.push(safe);
      return true;
    },
    onComplete: () => finish("delivered"),
  });

  if (settled) {
    try {
      cleanup?.();
    } catch {
      // The engine is already closing its own resources.
    }
  }

  return {
    promise,
    cancel: () => finish("cancelled"),
  };
}
