import {
  LynkApi,
  buildSendLink,
  encryptedSize,
  encryptWithGcm,
  encryptWithIvPrefix,
  generateGcmKey,
  resolveApiBase,
} from "../../engine/index.js";

export function generateLegacyKey() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function encryptSelection({
  files,
  key,
  version = 1,
  onProgress = () => {},
}) {
  const encrypted = [];
  for (let i = 0; i < files.length; i += 1) {
    const file = files[i];
    onProgress({
      phase: "encrypting",
      progress: (i / files.length) * 0.25,
      label: `Encrypting ${file.name}…`,
    });
    const plain = new Uint8Array(await file.arrayBuffer());
    encrypted.push({
      name: file.name,
      size: encryptedSize(file.size, version),
      blob:
        version === 2
          ? await encryptWithGcm(plain, key)
          : await encryptWithIvPrefix(plain, key),
    });
  }
  return encrypted;
}

export async function createTransferSession({
  api,
  encrypted,
  onProgress = () => {},
}) {
  onProgress({
    phase: "uploading",
    progress: 0.25,
    label: "Creating the transfer…",
  });
  return api.createTransfer(
    encrypted.map((item) => ({
      name: item.name,
      size: item.blob.length,
      type: "application/octet-stream",
    })),
  );
}

export function buildShare({ session, key, origin, files, version = 1 }) {
  const linkKey = version === 2 ? `2.${key}` : key;
  return {
    link: buildSendLink(
      origin,
      session.transferId,
      linkKey,
      session.accessToken,
    ),
    key: linkKey,
    transferId: session.transferId,
    senderSecret: session.senderSecret,
    accessToken: session.accessToken,
    expiresIn: session.expiresIn,
    fileNames: files.map((file) => file.name),
    totalSize: files.reduce((sum, file) => sum + file.size, 0),
  };
}

export async function uploadEncrypted({
  api,
  fetch = globalThis.fetch.bind(globalThis),
  encrypted,
  session,
  onProgress = () => {},
}) {
  for (let i = 0; i < session.files.length; i += 1) {
    const target = session.files[i];
    onProgress({
      phase: "uploading",
      progress: 0.25 + (i / session.files.length) * 0.75,
      label: `Uploading ${target.fileName}…`,
    });
    const response = await fetch(target.uploadUrl, {
      method: "PUT",
      body: encrypted[i].blob,
      headers: { "Content-Type": "application/octet-stream" },
    });
    if (!response.ok) throw new Error(`upload failed (${response.status})`);
    await api.completeFile(
      session.transferId,
      target.fileId,
      session.senderSecret,
    );
    onProgress({
      phase: "uploading",
      progress: 0.25 + ((i + 1) / session.files.length) * 0.75,
      label: `Uploaded ${target.fileName}`,
    });
  }
  onProgress({ phase: "done", progress: 1, label: "Link ready" });
}

/**
 * Encrypts every file, creates the transfer, uploads the ciphertext to the
 * presigned URLs and returns the share link. The link is returned to the
 * caller and never written to storage by this module.
 */
export async function createCloudShare({
  files,
  version = 2,
  key = version === 2 ? generateGcmKey() : generateLegacyKey(),
  origin = globalThis.window?.location?.origin ?? "",
  api = new LynkApi({ baseUrl: resolveApiBase() }),
  fetch = globalThis.fetch.bind(globalThis),
  onProgress = () => {},
}) {
  const encrypted = await encryptSelection({
    files,
    key,
    version,
    onProgress,
  });
  const session = await createTransferSession({ api, encrypted, onProgress });
  await uploadEncrypted({ api, fetch, encrypted, session, onProgress });
  return buildShare({ session, key, origin, files, version });
}
