import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const SALT_LENGTH = 16;
const LEGACY_SALT = "tig-credential-vault-v1";
const SCRYPT_KEYLEN = 32;
const SCRYPT_COST = 16384;
const KEY_CACHE_MAX = 256;

const keyCache = new Map<string, Buffer>();
let _legacyKey: Buffer | null = null;

function getRawKey(): string {
  const key = process.env["TIG_ENCRYPTION_KEY"];
  if (!key) {
    throw new Error("TIG_ENCRYPTION_KEY environment variable is required");
  }
  if (key.length < 32) {
    throw new Error("TIG_ENCRYPTION_KEY must be at least 32 characters");
  }
  return key;
}

function deriveKey(salt: string): Buffer {
  const cached = keyCache.get(salt);
  if (cached) return cached;

  if (keyCache.size >= KEY_CACHE_MAX) {
    const firstKey = keyCache.keys().next().value as string;
    keyCache.delete(firstKey);
  }

  const derived = scryptSync(getRawKey(), salt, SCRYPT_KEYLEN, {
    N: SCRYPT_COST,
    r: 8,
    p: 1,
  });
  keyCache.set(salt, derived);
  return derived;
}

/** Legacy key for backwards-compatible decryption of pre-migration data */
function getLegacyKey(): Buffer {
  if (_legacyKey) return _legacyKey;
  _legacyKey = Buffer.from(getRawKey(), "utf-8").subarray(0, 32);
  return _legacyKey;
}

export interface EncryptedCredentials {
  readonly username: string;
  readonly tokenEncrypted: string;
  readonly tokenIv: string;
  readonly tokenTag: string;
  readonly tokenSalt?: string; // Absent on legacy records
}

export interface PlainCredentials {
  readonly username: string;
  readonly token: string;
}

export function encryptCredentials(
  credentials: PlainCredentials,
): EncryptedCredentials {
  const salt = randomBytes(SALT_LENGTH).toString("base64");
  const key = deriveKey(salt);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(credentials.token, "utf-8", "base64");
  encrypted += cipher.final("base64");
  const tag = cipher.getAuthTag();

  return {
    username: credentials.username,
    tokenEncrypted: encrypted,
    tokenIv: iv.toString("base64"),
    tokenTag: tag.toString("base64"),
    tokenSalt: salt,
  };
}

function decryptWithKey(
  encrypted: EncryptedCredentials,
  key: Buffer,
): PlainCredentials {
  const iv = Buffer.from(encrypted.tokenIv, "base64");
  const tag = Buffer.from(encrypted.tokenTag, "base64");
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(encrypted.tokenEncrypted, "base64", "utf-8");
  decrypted += decipher.final("utf-8");

  return { username: encrypted.username, token: decrypted };
}

export function decryptCredentials(
  encrypted: EncryptedCredentials,
): PlainCredentials {
  // Per-record salt: derive key from stored salt
  if (encrypted.tokenSalt) {
    return decryptWithKey(encrypted, deriveKey(encrypted.tokenSalt));
  }

  // Legacy: try static scrypt salt, then raw-truncated key
  try {
    return decryptWithKey(encrypted, deriveKey(LEGACY_SALT));
  } catch {
    return decryptWithKey(encrypted, getLegacyKey());
  }
}
