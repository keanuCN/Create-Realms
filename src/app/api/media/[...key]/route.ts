import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import { stat } from "node:fs/promises";
import { getCurrentUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { mediaPath, mimeFromKey } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Ctx {
  params: Promise<{ key: string[] }>;
}

async function shareAllows(token: string, storageKey: string) {
  const rows = await sql<{ id: string }[]>`
    SELECT s.id FROM shares s
    JOIN assets a ON a.id = s.asset_id
    WHERE s.token = ${token}
      AND a.storage_key = ${storageKey}
      AND (s.expires_at IS NULL OR s.expires_at > now())
    LIMIT 1
  `;
  return rows.length > 0;
}

export async function GET(req: Request, ctx: Ctx) {
  const { key } = await ctx.params;
  const storageKey = key.join("/");
  const url = new URL(req.url);
  const token = url.searchParams.get("share");

  let allowed = Boolean(await getCurrentUser());
  if (!allowed && token) {
    allowed = await shareAllows(token, storageKey);
  }
  if (!allowed) {
    return new Response("Unauthorized", { status: 401 });
  }

  let fileStat;
  try {
    fileStat = await stat(mediaPath(storageKey));
  } catch {
    return new Response("Not found", { status: 404 });
  }

  const contentType = mimeFromKey(storageKey);
  const range = req.headers.get("range");

  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    if (match) {
      const start = match[1] ? Number(match[1]) : 0;
      const end = match[2] ? Math.min(Number(match[2]), fileStat.size - 1) : fileStat.size - 1;
      if (start >= fileStat.size || start > end) {
        return new Response(null, {
          status: 416,
          headers: { "Content-Range": `bytes */${fileStat.size}` },
        });
      }
      const stream = createReadStream(mediaPath(storageKey), { start, end });
      return new Response(Readable.toWeb(stream) as unknown as ReadableStream, {
        status: 206,
        headers: {
          "Content-Type": contentType,
          "Content-Length": String(end - start + 1),
          "Content-Range": `bytes ${start}-${end}/${fileStat.size}`,
          "Accept-Ranges": "bytes",
          "Cache-Control": "private, max-age=86400",
        },
      });
    }
  }

  const stream = createReadStream(mediaPath(storageKey));
  return new Response(Readable.toWeb(stream) as unknown as ReadableStream, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(fileStat.size),
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, max-age=86400",
    },
  });
}
