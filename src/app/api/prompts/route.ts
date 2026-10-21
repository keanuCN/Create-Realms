import { z } from "zod";
import { requireApiUser, ok, fail, handleApiError } from "@/lib/http";
import { createPrompt, listPrompts } from "@/lib/prompts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createSchema = z.object({
  title: z.string().trim().min(1, "请填写标题").max(80),
  content: z.string().trim().min(1, "请填写提示词内容").max(7000),
  tags: z.array(z.string().trim().max(24)).max(8).optional(),
  kind: z.enum(["video", "image", "any"]).optional(),
  isShared: z.boolean().optional(),
});

export async function GET(req: Request) {
  try {
    const user = await requireApiUser();
    const url = new URL(req.url);
    const scope = url.searchParams.get("scope") === "shared" ? "shared" : "mine";
    const kind = (url.searchParams.get("kind") || "any") as "video" | "image" | "any";
    const q = url.searchParams.get("q") || undefined;
    const items = await listPrompts({ userId: user.id, scope, kind, q });
    return ok({ items });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireApiUser();
    const parsed = createSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message || "参数错误", 400);
    }
    const input = parsed.data;
    const item = await createPrompt({
      userId: user.id,
      title: input.title,
      content: input.content,
      tags: input.tags ?? [],
      kind: input.kind ?? "any",
      isShared: input.isShared ?? false,
    });
    return ok({ item }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
