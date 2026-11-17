import { decryptWithIvPrefix } from "#engine/crypto.js";
import { decryptWithGcm } from "./crypto-v2.js";

export async function decryptFileBytes({ version, key, packed }) {
  if (version === 2) return decryptWithGcm(packed, key);
  return decryptWithIvPrefix(packed, key);
}
