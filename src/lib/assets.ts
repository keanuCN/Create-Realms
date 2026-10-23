import { sql, jsonb } from "./db";
import { mediaUrl } from "./storage";
import { friendlyError } from "./errors";
import type { Asset, AssetKind, AssetStatus, AssetWithUser } from "./types";

interface AssetRow {
  id: string;
  user_id: string;
  kind: AssetKind;
  provider: string;
  model: string;
  status: AssetStatus;
  prompt: string;
  params: Record<string, unknown>;
  provider_task_id: string | null;
  storage_key: string | null;
  poster_key: string | null;
  remote_url: string | null;
  error_code: string | null;
  error_message: string | null;
  duration_seconds: number | null;
  resolution: string | null;
  aspect_ratio: string | null;
  usage: Record<string, unknown> | null;
  is_favorite: boolean;
  is_public: boolean;
  title: string | null;
  created_at: Date;
  updated_at: Date;
  completed_at: Date | null;
  author_name?: string;
  author_username?: string;
  share_token?: string | null;
}

function iso(value: Date | string | null): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export function mapAsset(row: AssetRow): Asset {
  return {
    id: row.id,
    userId: row.user_id,
    kind: row.kind,
    provider: row.provider,
    model: row.model,
    status: row.status,
    prompt: row.prompt,
    params: row.params ?? {},
    providerTaskId: row.provider_task_id,
    storageKey: row.storage_key,
    posterKey: row.poster_key,
    remoteUrl: row.remote_url,
    errorCode: row.error_code,
    errorMessage: row.error_message ? friendlyError(row.error_code, row.error_message) : null,
    durationSeconds: row.duration_seconds,
    resolution: row.resolution,
    aspectRatio: row.aspect_ratio,
    usage: row.usage,
    isFavorite: row.is_favorite,
    isPublic: row.is_public,
    title: row.title,
    createdAt: iso(row.created_at)!,
    updatedAt: iso(row.updated_at)!,
    completedAt: iso(row.completed_at),
  };
}

export function mapAssetWithUser(row: AssetRow): AssetWithUser {
  return {
    ...mapAsset(row),
    authorName: row.author_name ?? "",
    authorUsername: row.author_username ?? "",
    mediaUrl: mediaUrl(row.storage_key),
    shareToken: row.share_token ?? null,
  };
}

const BASE_SELECT = sql`
  SELECT a.*, u.display_name AS author_name, u.username AS author_username,
         s.token AS share_token
  FROM assets a
  JOIN users u ON u.id = a.user_id
  LEFT JOIN shares s ON s.asset_id = a.id
`;

export async function createAsset(input: {
  userId: string;
  kind: AssetKind;
  model: string;
  prompt: string;
  params: Record<string, unknown>;
  provider?: string;
}): Promise<Asset> {
  const rows = await sql<AssetRow[]>`
    INSERT INTO assets (user_id, kind, provider, model, prompt, params, status, next_run_at)
    VALUES (
      ${input.userId}, ${input.kind}, ${input.provider ?? "minimax"},
      ${input.model}, ${input.prompt}, ${jsonb(input.params)},
      'pending', now()
    )
    RETURNING *
  `;
  return mapAsset(rows[0]);
}

export async function getAsset(id: string): Promise<AssetWithUser | null> {
  const rows = await sql<AssetRow[]>`
    ${BASE_SELECT} WHERE a.id = ${id} LIMIT 1
  `;
  return rows[0] ? mapAssetWithUser(rows[0]) : null;
}

export interface ListAssetOptions {
  userId: string;
  role: "admin" | "member";
  scope?: "mine" | "team";
  kind?: AssetKind | "all";
  status?: AssetStatus | "all";
  favorite?: boolean;
  q?: string;
  limit?: number;
  offset?: number;
}

export async function listAssets(opts: ListAssetOptions): Promise<{
  items: AssetWithUser[];
  total: number;
}> {
  const limit = Math.min(Math.max(opts.limit ?? 24, 1), 100);
  const offset = Math.max(opts.offset ?? 0, 0);
  const scopeAll = opts.scope === "team";

  const filters: ReturnType<typeof sql>[] = [
    scopeAll
      ? sql`(a.user_id = ${opts.userId} OR a.is_public = true OR ${opts.role === "admin"})`
      : sql`a.user_id = ${opts.userId}`,
  ];

  if (opts.kind && opts.kind !== "all") {
    filters.push(sql`a.kind = ${opts.kind}`);
  }
  if (opts.status && opts.status !== "all") {
    filters.push(sql`a.status = ${opts.status}`);
  }
  if (opts.favorite) {
    filters.push(sql`a.is_favorite = true`);
  }
  if (opts.q?.trim()) {
    const like = `%${opts.q.trim()}%`;
    filters.push(sql`(a.prompt ILIKE ${like} OR coalesce(a.title, '') ILIKE ${like})`);
  }

  const where = filters.reduce((acc, f, i) => (i === 0 ? f : sql`${acc} AND ${f}`), sql``);

  const rows = await sql<AssetRow[]>`
    ${BASE_SELECT}
    WHERE ${where}
    ORDER BY a.created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;

  const countRows = await sql<{ count: string }[]>`
    SELECT count(*)::text AS count FROM assets a
    JOIN users u ON u.id = a.user_id
    WHERE ${where}
  `;

  return {
    items: rows.map(mapAssetWithUser),
    total: Number(countRows[0]?.count ?? 0),
  };
}

export async function updateAsset(
  id: string,
  patch: Partial<{
    title: string | null;
    isFavorite: boolean;
    isPublic: boolean;
    status: AssetStatus;
    errorMessage: string | null;
    errorCode: string | null;
    attempts: number;
    providerTaskId: string | null;
    storageKey: string | null;
    posterKey: string | null;
    remoteUrl: string | null;
    durationSeconds: number | null;
    resolution: string | null;
    aspectRatio: string | null;
    usage: Record<string, unknown> | null;
  }>,
) {
  const sets: ReturnType<typeof sql>[] = [];
  if (patch.title !== undefined) sets.push(sql`title = ${patch.title}`);
  if (patch.isFavorite !== undefined) sets.push(sql`is_favorite = ${patch.isFavorite}`);
  if (patch.isPublic !== undefined) sets.push(sql`is_public = ${patch.isPublic}`);
  if (patch.status !== undefined) sets.push(sql`status = ${patch.status}`);
  if (patch.errorMessage !== undefined) sets.push(sql`error_message = ${patch.errorMessage}`);
  if (patch.errorCode !== undefined) sets.push(sql`error_code = ${patch.errorCode}`);
  if (patch.attempts !== undefined) sets.push(sql`attempts = ${patch.attempts}`);
  if (patch.providerTaskId !== undefined) sets.push(sql`provider_task_id = ${patch.providerTaskId}`);
  if (patch.storageKey !== undefined) sets.push(sql`storage_key = ${patch.storageKey}`);
  if (patch.posterKey !== undefined) sets.push(sql`poster_key = ${patch.posterKey}`);
  if (patch.remoteUrl !== undefined) sets.push(sql`remote_url = ${patch.remoteUrl}`);
  if (patch.durationSeconds !== undefined) sets.push(sql`duration_seconds = ${patch.durationSeconds}`);
  if (patch.resolution !== undefined) sets.push(sql`resolution = ${patch.resolution}`);
  if (patch.aspectRatio !== undefined) sets.push(sql`aspect_ratio = ${patch.aspectRatio}`);
  if (patch.usage !== undefined) sets.push(sql`usage = ${jsonb(patch.usage)}`);
  if (!sets.length) return;

  const setClause = sets.reduce((acc, s, i) => (i === 0 ? s : sql`${acc}, ${s}`), sql``);
  await sql`
    UPDATE assets SET ${setClause}, updated_at = now() WHERE id = ${id}
  `;
}

export async function markSucceeded(
  id: string,
  input: {
    storageKey: string;
    remoteUrl?: string | null;
    durationSeconds?: number | null;
    resolution?: string | null;
    aspectRatio?: string | null;
    usage?: Record<string, unknown> | null;
  },
) {
  await sql`
    UPDATE assets SET
      status = 'succeeded',
      storage_key = ${input.storageKey},
      remote_url = ${input.remoteUrl ?? null},
      duration_seconds = ${input.durationSeconds ?? null},
      resolution = ${input.resolution ?? null},
      aspect_ratio = ${input.aspectRatio ?? null},
      usage = ${jsonb(input.usage ?? null)},
      completed_at = now(),
      updated_at = now(),
      error_code = NULL,
      error_message = NULL
    WHERE id = ${id}
  `;
}
