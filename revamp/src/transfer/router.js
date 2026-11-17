const SEND_PREFIX = "/send/";
const RECEIVE_PREFIX = "/receive/";

function normalizePath(pathname) {
  const path = String(pathname ?? "/");
  if (path.length > 1 && path.endsWith("/")) {
    return path.replace(/\/+$/, "") || "/";
  }
  return path;
}

function decodeId(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return "";
  }
}

export function isLegacyAppPath(pathname) {
  const path = normalizePath(pathname);
  return [
    "/app/send",
    "/app/send.html",
    "/app/receive",
    "/app/receive.html",
  ].includes(path);
}

/**
 * Maps the current URL to the transfer document's screen. The worker rewrites
 * the transfer paths to transfer.html, so this parser never guesses an id
 * from a marketing path.
 */
export function parseTransferRoute(pathname, hash = "") {
  const path = normalizePath(pathname);

  if (path === "/") return { kind: "marketing" };
  if (path === "/send") return { kind: "send" };
  if (path === "/receive") return { kind: "receive" };
  if (isLegacyAppPath(path)) return { kind: "legacy", path };

  if (path.startsWith(SEND_PREFIX)) {
    const transferId = decodeId(path.slice(SEND_PREFIX.length));
    if (!transferId) return { kind: "send" };
    return { kind: "share", transferId };
  }

  if (path.startsWith(RECEIVE_PREFIX)) {
    const sessionId = decodeId(path.slice(RECEIVE_PREFIX.length));
    if (!sessionId) return { kind: "receive" };
    if (!String(hash).startsWith("#pk=")) {
      return { kind: "error", reason: "not-a-transfer-link" };
    }
    const params = new URLSearchParams(String(hash).slice(1));
    const publicKey = params.get("pk") ?? "";
    if (!publicKey) return { kind: "error", reason: "missing-pk" };
    return {
      kind: "pairing",
      sessionId,
      publicKey,
      version: params.get("v") === "2" ? 2 : 1,
    };
  }

  return { kind: "not-found" };
}
