import { sql } from "./db";
import { mediaUrl } from "./storage";
import type { AssetWithUser, AssetKind, AssetStatus } from "./types";

interface SharedRow {
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
  author_name: string;
  author_username: string;
  share_token: string;
}

export async function getAssetByShareToken(token: string): Promise<
  (AssetWithUser & { mediaUrlPublic: string | null }) | null
> {
  const rows = await sql<SharedRow[]>`
    SELECT a.*, u.display_name AS author_name, u.username AS author_username, s.token AS share_token
    FROM shares s
    JOIN assets a ON a.id = s.asset_id
    JOIN users u ON u.id = a.user_id
    WHERE s.token = ${token}
      AND (s.expires_at IS NULL OR s.expires_at > now())
      AND a.status = 'succeeded'
    LIMIT 1
  `;
  const row = rows[0];
  if (!row) return null;

  const base = mediaUrl(row.storage_key);
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
    errorMessage: row.error_message,
    durationSeconds: row.duration_seconds,
    resolution: row.resolution,
    aspectRatio: row.aspect_ratio,
    usage: row.usage,
    isFavorite: row.is_favorite,
    isPublic: row.is_public,
    title: row.title,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    completedAt: row.completed_at ? row.completed_at.toISOString() : null,
    authorName: row.author_name,
    authorUsername: row.author_username,
    mediaUrl: base,
    shareToken: token,
    mediaUrlPublic: base ? `${base}?share=${encodeURIComponent(token)}` : null,
  };
}
