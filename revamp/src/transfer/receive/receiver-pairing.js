import {
  buildSendLink,
  generateReceiverKeyPair,
  unwrapDelivery,
} from "../../engine/index.js";

export const PAIRING_POLL_MS = 2000;

export function buildReceiverLink({
  origin,
  sessionId,
  publicKeyB64,
  version = 1,
}) {
  const base = String(origin ?? "").replace(/\/+$/, "");
  // Keep v=1 until every scanner strips the flag. The current Android parser
  // treats the whole fragment after pk= as the key.
  const flag = version === 2 ? "&v=2" : "";
  return `${base}/receive/${encodeURIComponent(sessionId)}#pk=${publicKeyB64}${flag}`;
}

export function buildDeliveryLink({
  origin,
  transferId,
  aesKey,
  accessToken,
}) {
  return buildSendLink(
    String(origin ?? "").replace(/\/+$/, ""),
    transferId,
    aesKey,
    accessToken,
  );
}

/**
 * Creates a receiver session and the ephemeral key pair that the sender will
 * wrap the file key for. The private seed is returned to the caller and must
 * stay in memory; the QR link carries only the public key.
 */
export async function startReceiverPairing({
  api,
  origin,
  generateKeyPair = generateReceiverKeyPair,
  version = 1,
}) {
  const session = await api.createReceiverSession();
  const receiver = await generateKeyPair();
  return {
    sessionId: session.sessionId,
    expiresIn: session.expiresIn,
    publicKeyB64: receiver.publicKeyB64,
    privateKeySeed: receiver.privateKeySeed,
    link: buildReceiverLink({
      origin,
      sessionId: session.sessionId,
      publicKeyB64: receiver.publicKeyB64,
      version,
    }),
  };
}

/**
 * One poll of the receiver session. Returns null while the sender has not
 * attached the transfer, and the unwrapped delivery once it has.
 */
export async function readReceiverAttachment({
  api,
  sessionId,
  privateKeySeed,
  unwrap = unwrapDelivery,
}) {
  const session = await api.getReceiverSession(sessionId);
  if (
    session.status !== "attached" ||
    !session.wrappedKey ||
    !session.transferId
  ) {
    return null;
  }

  const delivery = await unwrap({
    wrappedBase64: session.wrappedKey,
    privateKeySeed,
    sessionId,
  });
  return {
    transferId: session.transferId,
    aesKey: delivery.aesKey,
    accessToken: delivery.accessToken,
  };
}
