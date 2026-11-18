import { sendViaP2p } from "../../engine/index.js";
import {
  buildShare,
  createTransferSession,
  encryptSelection,
  generateLegacyKey,
  uploadEncrypted,
} from "./cloud-send.js";

/**
 * Encrypts and creates the server transfer, publishes the link through
 * `onReady`, then tries the direct channel. A failed direct attempt uploads
 * the same ciphertext under the same transfer, so the link already shown to
 * the receiver keeps working.
 */
export async function startDirectShare({
  files,
  key = generateLegacyKey(),
  origin,
  api,
  apiBase,
  fetch = globalThis.fetch.bind(globalThis),
  onProgress = () => {},
  onStatus = () => {},
  onReady = () => {},
  send = sendViaP2p,
}) {
  const encrypted = await encryptSelection({ files, key, onProgress });
  const session = await createTransferSession({ api, encrypted, onProgress });
  const share = buildShare({ session, key, origin, files });
  onReady(share);

  const delivered = await send({
    apiBase,
    sessionId: session.transferId,
    files: encrypted,
    accessToken: session.accessToken,
    aesKey: key,
    onStatus,
  });

  if (!delivered) {
    onProgress({
      phase: "uploading",
      progress: 0.25,
      label: "Uploading the cloud copy…",
    });
    await uploadEncrypted({ api, fetch, encrypted, session, onProgress });
  }

  return { delivered, session, share };
}
