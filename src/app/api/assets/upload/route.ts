import { randomUUID } from "node:crypto";
import path from "node:path";
import { requireApiUser, ok, fail, handleApiError } from "@/lib/http";
import { jsonb, sql } from "@/lib/db";
import { removeMedia, saveMediaStream } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 300 * 1024 * 1024;
const VIDEO_TYPES: Record<string, { ext: string; mime: string }> = {
  ".mp4": { ext: "mp4", mime: "video/mp4" },
  ".mov": { ext: "mov", mime: "video/quicktime" },
  ".webm": { ext: "webm", mime: "video/webm" },
};

export async function POST(req: Request) {
  let storageKey: string | null = null;
  try {
    const user = await requireApiUser();
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return fail("视频上传失败，请检查文件大小和网络后重试", 400);
    }

    const file = form.get("file");
    if (!(file instanceof File)) return fail("请选择要上传的视频", 400);
    if (file.size === 0) return fail("视频文件为空", 400);
    if (file.size > MAX_BYTES) return fail("视频不能超过 300MB", 400);

    const extension = path.extname(file.name).toLowerCase();
    const videoType = VIDEO_TYPES[extension];
    if (!videoType) return fail("仅支持 MP4、MOV 和 WebM 视频", 400);
    const detectedMime = file.type.toLowerCase();
    if (
      detectedMime &&
      detectedMime !== videoType.mime &&
      detectedMime !== "application/octet-stream"
    ) {
      return fail("视频格式与文件扩展名不一致，请重新选择视频", 400);
    }

    const sourceName = String(form.get("sourceName") || "").trim();
    if (!sourceName) return fail("请填写视频来源", 400);
    if (sourceName.length > 100) return fail("来源名称不能超过 100 个字符", 400);

    const sourceUrlInput = String(form.get("sourceUrl") || "").trim();
    let sourceUrl: string | null = null;
    if (sourceUrlInput) {
      if (sourceUrlInput.length > 2048) return fail("来源链接不能超过 2048 个字符", 400);
      try {
        const parsedUrl = new URL(sourceUrlInput);
        if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") {
          return fail("来源链接仅支持 http 或 https 地址", 400);
        }
        sourceUrl = parsedUrl.toString();
      } catch {
        return fail("请输入有效的来源链接", 400);
      }
    }

    const titleInput = String(form.get("title") || "").trim();
    if (titleInput.length > 120) return fail("作品标题不能超过 120 个字符", 400);
    const originalFilename = file.name.slice(0, 255);
    const title = titleInput || path.basename(file.name, extension).slice(0, 120);
    const prompt = `外部视频上传 · 来源：${sourceName}`;
    storageKey = `assets/uploads/${user.id}/${randomUUID()}.${videoType.ext}`;

    await saveMediaStream(storageKey, file.stream());
    const rows = await sql<{ id: string }[]>`
      INSERT INTO assets (
        user_id, kind, provider, model, status, prompt, params, storage_key,
        is_public, title, completed_at, updated_at
      )
      VALUES (
        ${user.id}, 'video', 'upload', 'uploaded-video', 'succeeded', ${prompt},
        ${jsonb({ sourceName, sourceUrl, originalFilename, uploaded: true })},
        ${storageKey}, true, ${title}, now(), now()
      )
      RETURNING id
    `;

    return ok({ id: rows[0].id, title }, { status: 201 });
  } catch (error) {
    if (storageKey) await removeMedia(storageKey).catch(() => {});
    return handleApiError(error);
  }
}
