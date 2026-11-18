import {
  decryptFileBytes,
  isNotReadyError,
  safeFileName,
  waitForTransferReady,
} from "../../engine/index.js";

export async function loadTransferMetadata({ api, transferId, accessToken }) {
  return api.getTransferMetadata(transferId, accessToken);
}

/**
 * Fetches every download URL, decrypts each file and hands it to `save`.
 * The key never leaves this call stack.
 */
export async function downloadShare({
  api,
  transferId,
  accessToken,
  key,
  version = 1,
  fetch = globalThis.fetch.bind(globalThis),
  save,
  onProgress = () => {},
  waitForReady = false,
  onWait = () => {},
  readyTimeoutMs,
}) {
  let files;
  try {
    files = await api.getDownloadUrls(transferId, accessToken);
  } catch (err) {
    if (!waitForReady || !isNotReadyError(err)) throw err;
    onWait();
    await waitForTransferReady({
      api,
      transferId,
      accessToken,
      timeoutMs: readyTimeoutMs,
      onWait,
    });
    files = await api.getDownloadUrls(transferId, accessToken);
  }

  const saved = [];

  for (let i = 0; i < files.length; i += 1) {
    const file = files[i];
    onProgress({
      progress: i / files.length,
      label: `Downloading ${file.fileName}…`,
    });
    const response = await fetch(file.downloadUrl);
    if (!response.ok) {
      throw new Error(`download failed (${response.status})`);
    }
    const packed = new Uint8Array(await response.arrayBuffer());
    const plain = await decryptFileBytes({ version, key, packed });
    const name = safeFileName(file.fileName);
    await save({ name, bytes: plain });
    saved.push(name);
  }

  onProgress({ progress: 1, label: "Saved" });
  return saved;
}
