import fs from "node:fs/promises";
import { createWriteStream } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import { env } from "./env";

const ROOT = env.mediaDir;

export function mediaPath(key: string): string {
  const normalized = key.replace(/\\/g, "/").replace(/^\/+/, "");
  const full = path.resolve(ROOT, normalized);
  const rootWithSep = ROOT.endsWith(path.sep) ? ROOT : ROOT + path.sep;
  if (full !== ROOT && !full.startsWith(rootWithSep)) {
    throw new Error("invalid media key");
  }
  return full;
}

export async function ensureMediaDir() {
  await fs.mkdir(ROOT, { recursive: true });
}

export async function saveMedia(key: string, data: Buffer | Uint8Array) {
  const full = mediaPath(key);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, data);
  return key;
}

export async function saveMediaStream(key: string, data: ReadableStream<Uint8Array>) {
  const full = mediaPath(key);
  await fs.mkdir(path.dirname(full), { recursive: true });
  try {
    await pipeline(
      Readable.fromWeb(data as unknown as NodeReadableStream<Uint8Array>),
      createWriteStream(full, { flags: "wx" }),
    );
  } catch (error) {
    await fs.rm(full, { force: true }).catch(() => {});
    throw error;
  }
  return key;
}

export async function removeMedia(key: string) {
  await fs.rm(mediaPath(key), { force: true });
}

export async function readMedia(key: string): Promise<Buffer> {
  return fs.readFile(mediaPath(key));
}

export async function statMedia(key: string) {
  return fs.stat(mediaPath(key));
}

export function mediaUrl(key: string | null | undefined): string | null {
  if (!key) return null;
  const encoded = key
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
  return `/api/media/${encoded}`;
}

const EXT_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/heic": "heic",
  "image/svg+xml": "svg",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
};

export function extFromMime(mime: string | null | undefined, fallback = "bin") {
  if (!mime) return fallback;
  const clean = mime.split(";")[0].trim().toLowerCase();
  return EXT_BY_MIME[clean] ?? fallback;
}

export function mimeFromKey(key: string): string {
  const ext = path.extname(key).toLowerCase();
  const map: Record<string, string> = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".mp4": "video/mp4",
    ".mov": "video/quicktime",
    ".webm": "video/webm",
  };
  return map[ext] ?? "application/octet-stream";
}
