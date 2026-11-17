const KEY_BYTES = 32;
const NONCE_BYTES = 12;
const TAG_BYTES = 16;

function decodeBase64Url(value) {
  const normalized = String(value).replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

function encodeBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function importKey(keyString) {
  const keyBytes = decodeBase64Url(keyString);
  if (keyBytes.length !== KEY_BYTES) {
    throw new Error("a version-2 key must decode to exactly 32 bytes");
  }
  return crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptWithGcm(plainBytes, keyString) {
  const key = await importKey(keyString);
  const nonce = crypto.getRandomValues(new Uint8Array(NONCE_BYTES));
  const sealed = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: nonce, tagLength: 128 },
      key,
      plainBytes,
    ),
  );
  const out = new Uint8Array(NONCE_BYTES + sealed.length);
  out.set(nonce, 0);
  out.set(sealed, NONCE_BYTES);
  return out;
}

export async function decryptWithGcm(packedBytes, keyString) {
  const packed = new Uint8Array(packedBytes);
  if (packed.length < NONCE_BYTES + TAG_BYTES) {
    throw new Error("version-2 ciphertext is too short");
  }
  const key = await importKey(keyString);
  const nonce = packed.subarray(0, NONCE_BYTES);
  const sealed = packed.subarray(NONCE_BYTES);
  return new Uint8Array(
    await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: nonce, tagLength: 128 },
      key,
      sealed,
    ),
  );
}

export function generateGcmKey() {
  return encodeBase64Url(crypto.getRandomValues(new Uint8Array(KEY_BYTES)));
}
