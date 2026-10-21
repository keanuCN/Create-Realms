"use client";

export interface ApiErrorShape {
  error?: string;
  code?: string;
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      ...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...(init?.headers ?? {}),
    },
    credentials: "same-origin",
  });

  const text = await res.text();
  const data = text ? (JSON.parse(text) as T & ApiErrorShape) : ({} as T & ApiErrorShape);

  if (!res.ok) {
    throw new Error(data?.error || `请求失败 (HTTP ${res.status})`);
  }
  return data as T;
}
