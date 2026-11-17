export const FILE_CIPHER_V2_PREFIX = "2.";

/**
 * Splits a fragment key into its file-cipher version and the raw key body.
 * Version 1 keys are the existing 32-character hex strings. Version 2 keys
 * start with "2." and carry a base64url body.
 */
export function parseFileCipherVersion(rawKey) {
  const key = String(rawKey ?? "").trim();
  if (key.startsWith(FILE_CIPHER_V2_PREFIX)) {
    return {
      version: 2,
      key: key.slice(FILE_CIPHER_V2_PREFIX.length),
    };
  }
  return { version: 1, key };
}

/**
 * Parses a URL fragment into the file-cipher version, key body and optional
 * access token. The token stays after the key as `&a=...`.
 */
export function parseFileFragment(fragment) {
  const raw = String(fragment ?? "").replace(/^#/, "");
  const [keyPart, ...rest] = raw.split("&");
  const params = new URLSearchParams(rest.join("&"));
  return {
    ...parseFileCipherVersion(keyPart),
    accessToken: params.get("a") ?? "",
  };
}
