import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const SCRYPT_SALT = "tig-credential-vault-v1";
const SCRYPT_KEYLEN = 32;
const SCRYPT_COST = 16384;

let _derivedKey: Buffer | null = null;
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

function getEncryptionKey(): Buffer {
  if (_derivedKey) return _derivedKey;
  // Derive a proper 256-bit key using scrypt instead of raw truncation
  _derivedKey = scryptSync(getRawKey(), SCRYPT_SALT, SCRYPT_KEYLEN, {
    N: SCRYPT_COST,
    r: 8,
    p: 1,
  });
  return _derivedKey;
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
}

export interface PlainCredentials {
  readonly username: string;
  readonly token: string;
}

export function encryptCredentials(
  credentials: PlainCredentials,
): EncryptedCredentials {
  const key = getEncryptionKey();
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

  return {
    username: encrypted.username,
    token: decrypted,
  };
}

export function decryptCredentials(
  encrypted: EncryptedCredentials,
): PlainCredentials {
  // Try derived key first (new encryption)
  try {
    return decryptWithKey(encrypted, getEncryptionKey());
  } catch {
    // Fall back to legacy raw-truncated key for pre-migration data
    return decryptWithKey(encrypted, getLegacyKey());
  }
}
