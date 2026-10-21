import { randomUUID } from "node:crypto";
import { requireApiUser, ok, fail, handleApiError } from "@/lib/http";
import { sql } from "@/lib/db";
import { extFromMime, mediaUrl, saveMedia } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 20 * 1024 * 1024;

export async function POST(req: Request) {
  try {
    const user = await requireApiUser();
    const form = await req.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return fail("没有收到文件", 400);
    }
    if (!file.type.startsWith("image/")) {
      return fail("只支持上传图片（PNG / JPG / WEBP）", 400);
    }
    if (file.size > MAX_BYTES) {
      return fail("图片不能超过 20MB", 400);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = extFromMime(file.type, "png");
    const key = `uploads/${user.id}/${randomUUID()}.${ext}`;
    await saveMedia(key, buffer);

    const rows = await sql<{ id: string }[]>`
      INSERT INTO uploads (user_id, filename, mime, size, storage_key)
      VALUES (${user.id}, ${file.name}, ${file.type}, ${file.size}, ${key})
      RETURNING id
    `;

    return ok(
      {
        id: rows[0].id,
        key,
        url: mediaUrl(key),
        name: file.name,
        mime: file.type,
        size: file.size,
      },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error);
  }
}
