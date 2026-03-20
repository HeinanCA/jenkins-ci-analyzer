import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const key = process.env["TIG_ENCRYPTION_KEY"];
  if (!key) {
    throw new Error("TIG_ENCRYPTION_KEY environment variable is required");
  }
  const keyBuffer = Buffer.from(key, "utf-8");
  if (keyBuffer.length < 32) {
    throw new Error("TIG_ENCRYPTION_KEY must be at least 32 characters");
  }
  return keyBuffer.subarray(0, 32);
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

export function decryptCredentials(
  encrypted: EncryptedCredentials,
): PlainCredentials {
  const key = getEncryptionKey();
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
