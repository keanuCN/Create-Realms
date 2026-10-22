import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { env } from "./env";

const PREFIX = "v1$";
let cachedKey: Buffer | null = null;

function encryptionKey(): Buffer {
  if (!cachedKey) {
    cachedKey = scryptSync(env.appSecret, "aigc-studio-provider-keys", 32, {
      N: 16384,
      r: 8,
      p: 1,
      maxmem: 64 * 1024 * 1024,
    });
  }
  return cachedKey;
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return (
    PREFIX +
    [iv, tag, encrypted].map((buffer) => buffer.toString("base64")).join(".")
  );
}

export function decryptSecret(payload: string | null | undefined): string | null {
  if (!payload) return null;
  if (!payload.startsWith(PREFIX)) return null;
  try {
    const parts = payload.slice(PREFIX.length).split(".");
    if (parts.length !== 3) return null;
    const [iv, tag, data] = parts.map((part) => Buffer.from(part, "base64"));
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(data), decipher.final()]);
    return plain.toString("utf8");
  } catch {
    return null;
  }
}

/** Show only enough of a key to recognise it; never return the full value. */
export function maskSecret(plain: string | null | undefined): string | null {
  if (!plain) return null;
  if (plain.length <= 10) return "••••••••";
  return `${plain.slice(0, 6)}••••••••${plain.slice(-4)}`;
}