import { keyFingerprint, wrapKey } from "../../engine/index.js";

/**
 * One poll of a sender session. Returns the receiver's public key and its
 * fingerprint once a device has joined, otherwise null.
 */
export async function readSenderJoin({
  api,
  sessionId,
  fingerprint = keyFingerprint,
}) {
  const view = await api.getSenderSession(sessionId);
  if (!view.receiverPk) return null;
  return {
    receiverPk: view.receiverPk,
    fingerprint: await fingerprint(view.receiverPk),
  };
}

/**
 * Wraps the file key for the joined device and attaches it to the sender
 * session. The server never sees the file key or the access token.
 */
export async function attachSenderCode({
  api,
  session,
  transferId,
  key,
  accessToken,
  mode,
  receiverPk,
  wrap = wrapKey,
}) {
  const wrappedKey = await wrap({
    aesKey: key,
    receiverPublicKeyB64: receiverPk,
    sessionId: session.sessionId,
    accessToken,
  });
  await api.attachSenderKey(
    session.sessionId,
    transferId,
    wrappedKey,
    mode,
    session.senderSecret,
  );
  return wrappedKey;
}
