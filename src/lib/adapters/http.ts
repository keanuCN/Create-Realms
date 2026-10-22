import { ProviderError } from "./types";

export interface RawResponse<T = unknown> {
  ok: boolean;
  status: number;
  text: string;
  json: T | null;
}

/** Low-level request helper: never throws on HTTP status, only on transport. */
export async function rawRequest<T = unknown>(
  url: string,
  init: RequestInit,
  timeoutMs = 120_000,
): Promise<RawResponse<T>> {
  const res = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(timeoutMs),
    cache: "no-store",
  });
  const text = await res.text();
  let json: T | null = null;
  try {
    json = text ? (JSON.parse(text) as T) : null;
  } catch {
    json = null;
  }
  return { ok: res.ok, status: res.status, text, json };
}

export function trimBase(base: string): string {
  return (base || "").replace(/\/+$/, "");
}

/** Send a credential field where the provider wants a header rather than a body. */
export function bearer(key: string): Record<string, string> {
  return key ? { Authorization: `Bearer ${key}` } : {};
}

export function dataUri(frame: { data: Buffer; mime: string }): string {
  return `data:${frame.mime};base64,${frame.data.toString("base64")}`;
}

export function raise(
  provider: string,
  status: number,
  body: unknown,
  fallback: string,
): never {
  const message =
    (body as { error?: { message?: string } })?.error?.message ||
    (body as { message?: string })?.message ||
    fallback;
  throw new ProviderError(message, String(status), status);
}

/** Download a generated file (also understands data: URIs). */
export async function downloadRemote(url: string): Promise<{
  data: Buffer;
  contentType: string;
}> {
  if (url.startsWith("data:")) {
    const match = url.match(/^data:([^;,]+)?(;base64)?,(.*)$/s);
    if (!match) throw new Error("无法解析 data URI");
    const [, mime = "application/octet-stream", isBase64, payload] = match;
    const data = isBase64
      ? Buffer.from(payload, "base64")
      : Buffer.from(decodeURIComponent(payload), "utf8");
    return { data, contentType: mime };
  }

  const res = await fetch(url, { signal: AbortSignal.timeout(300_000) });
  if (!res.ok) throw new Error(`下载生成结果失败 (HTTP ${res.status})`);
  const arrayBuffer = await res.arrayBuffer();
  return {
    data: Buffer.from(arrayBuffer),
    contentType: res.headers.get("content-type") || "application/octet-stream",
  };
}