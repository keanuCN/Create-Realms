import { sql } from "./db";
import type { PromptTemplate } from "./types";

interface PromptRow {
  id: string;
  user_id: string;
  title: string;
  content: string;
  tags: string[];
  kind: "video" | "image" | "any";
  is_shared: boolean;
  use_count: number;
  created_at: Date;
  updated_at: Date;
  author_name?: string;
}

function map(row: PromptRow): PromptTemplate {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    content: row.content,
    tags: row.tags ?? [],
    kind: row.kind,
    isShared: row.is_shared,
    useCount: row.use_count,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    authorName: row.author_name,
  };
}

export async function listPrompts(opts: {
  userId: string;
  scope: "mine" | "shared";
  kind?: "video" | "image" | "any";
  q?: string;
}): Promise<PromptTemplate[]> {
  const conditions = [
    opts.scope === "mine"
      ? sql`p.user_id = ${opts.userId}`
      : sql`(p.is_shared = true OR p.user_id = ${opts.userId})`,
  ];
  if (opts.kind && opts.kind !== "any") {
    conditions.push(sql`(p.kind = ${opts.kind} OR p.kind = 'any')`);
  }
  if (opts.q?.trim()) {
    const like = `%${opts.q.trim()}%`;
    conditions.push(
      sql`(p.title ILIKE ${like} OR p.content ILIKE ${like} OR EXISTS (SELECT 1 FROM unnest(p.tags) t WHERE t ILIKE ${like}))`,
    );
  }
  const where = conditions.reduce(
    (acc, c, i) => (i === 0 ? c : sql`${acc} AND ${c}`),
    sql``,
  );

  const rows = await sql<PromptRow[]>`
    SELECT p.*, u.display_name AS author_name
    FROM prompt_templates p
    JOIN users u ON u.id = p.user_id
    WHERE ${where}
    ORDER BY p.use_count DESC, p.created_at DESC
  `;
  return rows.map(map);
}

export async function createPrompt(input: {
  userId: string;
  title: string;
  content: string;
  tags: string[];
  kind: "video" | "image" | "any";
  isShared: boolean;
}): Promise<PromptTemplate> {
  const rows = await sql<PromptRow[]>`
    INSERT INTO prompt_templates (user_id, title, content, tags, kind, is_shared)
    VALUES (${input.userId}, ${input.title}, ${input.content}, ${input.tags}, ${input.kind}, ${input.isShared})
    RETURNING *
  `;
  return map(rows[0]);
}

export async function updatePrompt(
  id: string,
  userId: string,
  patch: Partial<{
    title: string;
    content: string;
    tags: string[];
    kind: "video" | "image" | "any";
    isShared: boolean;
  }>,
): Promise<boolean> {
  const sets: ReturnType<typeof sql>[] = [];
  if (patch.title !== undefined) sets.push(sql`title = ${patch.title}`);
  if (patch.content !== undefined) sets.push(sql`content = ${patch.content}`);
  if (patch.tags !== undefined) sets.push(sql`tags = ${patch.tags}`);
  if (patch.kind !== undefined) sets.push(sql`kind = ${patch.kind}`);
  if (patch.isShared !== undefined) sets.push(sql`is_shared = ${patch.isShared}`);
  if (!sets.length) return false;
  const setClause = sets.reduce((acc, s, i) => (i === 0 ? s : sql`${acc}, ${s}`), sql``);
  const rows = await sql`
    UPDATE prompt_templates SET ${setClause}, updated_at = now()
    WHERE id = ${id} AND user_id = ${userId} RETURNING id
  `;
  return rows.length > 0;
}

export async function deletePrompt(id: string, userId: string): Promise<boolean> {
  const rows = await sql`
    DELETE FROM prompt_templates WHERE id = ${id} AND user_id = ${userId} RETURNING id
  `;
  return rows.length > 0;
}

export async function incrementPromptUse(id: string, userId: string) {
  await sql`
    UPDATE prompt_templates SET use_count = use_count + 1
    WHERE id = ${id} AND (is_shared = true OR user_id = ${userId})
  `;
}
