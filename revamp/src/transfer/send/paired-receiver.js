import { wrapKey } from "../../engine/index.js";

/**
 * Wraps the file key for a receiver that showed its QR, then attaches the
 * transfer to that receiver session. The server never sees the file key.
 */
export async function attachToPairedReceiver({
  api,
  pair,
  transferId,
  key,
  accessToken,
  wrap = wrapKey,
}) {
  const wrappedKey = await wrap({
    aesKey: key,
    receiverPublicKeyB64: pair.publicKeyB64,
    sessionId: pair.sessionId,
    accessToken,
  });
  await api.attachTransfer(pair.sessionId, transferId, wrappedKey);
  return wrappedKey;
}
