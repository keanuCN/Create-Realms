import { getAdapter, ProviderError } from "../lib/adapters";
import type { AdapterContext } from "../lib/adapters/types";
import { sql, jsonb } from "../lib/db";
import { env } from "../lib/env";
import { friendlyError } from "../lib/errors";
import { getAdapterContext } from "../lib/providers";
import { ensureMediaDir, extFromMime, readMedia, saveMedia } from "../lib/storage";
import type { AssetKind, AssetStatus } from "../lib/types";

interface JobRow {
  id: string;
  user_id: string;
  kind: AssetKind;
  provider: string;
  model: string;
  status: AssetStatus;
  prompt: string;
  params: Record<string, unknown>;
  provider_task_id: string | null;
  attempts: number;
  created_at: Date;
}

const MAX_ATTEMPTS = 6;

/** 错误码 → 是否值得重试 */
const RETRYABLE = new Set([
  "1002", // MiniMax 限流
  "429",
  "500",
  "529",
  "overloaded",
  "SystemThrottling",
  "TooManyRequests",
  "QuotaExceeded",
  "RequestTimeout",
  "InternalServiceFailure",
]);

let running = true;

function log(...args: unknown[]) {
  console.log(new Date().toISOString(), "[worker]", ...args);
}

async function claimNext(): Promise<JobRow | null> {
  const rows = await sql<JobRow[]>`
    WITH picked AS (
      SELECT id FROM assets
      WHERE (
        (status = 'pending' AND next_run_at <= now() AND attempts < ${MAX_ATTEMPTS})
        OR (status = 'running' AND next_run_at <= now())
      )
      ORDER BY created_at ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    UPDATE assets a SET
      status = 'running',
      locked_at = now(),
      next_run_at = now() + interval '30 seconds',
      updated_at = now(),
      attempts = a.attempts + CASE
        WHEN a.status = 'pending' AND a.provider_task_id IS NULL THEN 1
        ELSE 0
      END
    FROM picked
    WHERE a.id = picked.id
    RETURNING a.id, a.user_id, a.kind, a.provider, a.model, a.status,
              a.prompt, a.params, a.provider_task_id, a.attempts, a.created_at
  `;
  return rows[0] ?? null;
}

function paramString(params: Record<string, unknown>, key: string) {
  const value = params[key];
  return typeof value === "string" ? value : undefined;
}

function paramNumber(params: Record<string, unknown>, key: string) {
  const value = params[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function storageKeyFor(id: string, ext: string) {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `assets/${yyyy}/${mm}/${id}.${ext}`;
}

async function readFrame(
  params: Record<string, unknown>,
  key: string,
): Promise<{ data: Buffer; mime: string } | null> {
  const storageKey = paramString(params, `${key}Key`);
  if (!storageKey) return null;
  const mime = paramString(params, `${key}Mime`) || "image/png";
  return { data: await readMedia(storageKey), mime };
}

/** 主体/风格参考图（参考生视频） */
async function readReferences(
  params: Record<string, unknown>,
): Promise<{ data: Buffer; mime: string }[]> {
  const list = params.references;
  if (!Array.isArray(list)) return [];
  const frames: { data: Buffer; mime: string }[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const entry = item as { key?: unknown; mime?: unknown };
    if (typeof entry.key !== "string") continue;
    frames.push({
      data: await readMedia(entry.key),
      mime: typeof entry.mime === "string" ? entry.mime : "image/png",
    });
  }
  return frames;
}

function paramBoolean(params: Record<string, unknown>, key: string) {
  const value = params[key];
  return typeof value === "boolean" ? value : undefined;
}

function requireAdapter(job: JobRow) {
  const adapter = getAdapter(job.provider);
  if (!adapter) {
    throw new ProviderError(`供应商「${job.provider}」的适配器未接入`, "no_adapter", 500);
  }
  return adapter;
}

/** 下载全部图片并落库：第一张写回当前作业，其余作为兄弟作品入库。 */
async function finalizeImages(job: JobRow, urls: string[], ratio: string) {
  let succeeded = 0;
  for (let index = 0; index < urls.length; index += 1) {
    const url = urls[index];
    const { data, contentType } = await downloadRemoteFile(url);
    const ext = extFromMime(contentType, "jpg");
    const targetId = index === 0 ? job.id : null;
    const key = storageKeyFor(targetId ?? `${job.id}-${index + 1}`, ext);
    await saveMedia(key, data);
    succeeded += 1;

    if (index === 0) {
      await sql`
        UPDATE assets SET
          status = 'succeeded',
          storage_key = ${key},
          remote_url = ${url.startsWith("data:") ? null : url},
          aspect_ratio = ${ratio},
          completed_at = now(),
          updated_at = now(),
          error_code = NULL,
          error_message = NULL
        WHERE id = ${job.id}
      `;
    } else {
      await sql`
        INSERT INTO assets (
          user_id, kind, provider, model, status, prompt, params,
          storage_key, remote_url, aspect_ratio, completed_at
        ) VALUES (
          ${job.user_id}, 'image', ${job.provider}, ${job.model}, 'succeeded',
          ${job.prompt}, ${jsonb(job.params)},
          ${key}, ${url.startsWith("data:") ? null : url}, ${ratio}, now()
        )
      `;
    }
  }
  log(`image ${job.id} generated ${succeeded} file(s) via ${job.provider}`);
}

async function downloadRemoteFile(url: string) {
  const { downloadRemote } = await import("../lib/adapters/http");
  return downloadRemote(url);
}

async function finalizeVideo(
  job: JobRow,
  result: {
    url?: string;
    data?: Buffer;
    contentType?: string;
    resolution?: string;
    duration?: number;
    ratio?: string;
    usage?: Record<string, unknown>;
  },
) {
  const downloaded = result.data
    ? { data: result.data, contentType: result.contentType || "video/mp4" }
    : result.url
      ? await downloadRemoteFile(result.url)
      : null;
  if (!downloaded) {
    throw new ProviderError("任务已完成但没有返回视频内容", "no_output", 500);
  }

  const key = storageKeyFor(job.id, extFromMime(downloaded.contentType, "mp4"));
  await saveMedia(key, downloaded.data);

  await sql`
    UPDATE assets SET
      status = 'succeeded',
      storage_key = ${key},
      remote_url = ${result.url?.startsWith("data:") ? null : result.url ?? null},
      duration_seconds = ${result.duration ?? null},
      resolution = ${result.resolution ?? null},
      aspect_ratio = ${result.ratio ?? null},
      usage = ${jsonb(result.usage ?? null)},
      completed_at = now(),
      updated_at = now(),
      error_code = NULL,
      error_message = NULL
    WHERE id = ${job.id}
  `;
  log(`video ${job.id} succeeded via ${job.provider} (${Math.round(downloaded.data.length / 1024)} KB)`);
}

async function submitJob(job: JobRow) {
  const adapter = requireAdapter(job);
  const ctx: AdapterContext = await getAdapterContext(job.provider, job.user_id);

  if (job.kind === "video") {
    if (!adapter.submitVideo) {
      throw new ProviderError(`${adapter.label} 暂不支持视频生成`, "unsupported", 500);
    }
    const result = await adapter.submitVideo(ctx, {
      model: job.model,
      prompt: job.prompt,
      resolution: paramString(job.params, "resolution"),
      duration: paramNumber(job.params, "duration"),
      ratio: paramString(job.params, "ratio"),
      seed: paramNumber(job.params, "seed"),
      audio: paramBoolean(job.params, "audio"),
      promptOptimizer: paramBoolean(job.params, "promptOptimizer"),
      promptExpansion: paramString(job.params, "promptExpansion") as
        | "disabled"
        | "balanced"
        | "quality"
        | undefined,
      firstFrame: await readFrame(job.params, "firstFrame"),
      lastFrame: await readFrame(job.params, "lastFrame"),
      referenceImages: await readReferences(job.params),
    });

    if (result.data || result.url) {
      await finalizeVideo(job, result);
      return;
    }

    if (!result.taskId) {
      throw new ProviderError("供应商未返回任务 ID 或视频结果", "empty", 200);
    }

    await sql`
      UPDATE assets SET provider_task_id = ${result.taskId}, next_run_at = now() + interval '3 seconds', updated_at = now()
      WHERE id = ${job.id}
    `;
    log(`submitted video ${job.id} via ${job.provider} -> ${result.taskId}`);
    return;
  }

  if (!adapter.submitImage) {
    throw new ProviderError(`${adapter.label} 暂不支持图片生成`, "unsupported", 500);
  }

  const result = await adapter.submitImage(ctx, {
    model: job.model,
    prompt: job.prompt,
    ratio: paramString(job.params, "ratio"),
    resolution: paramString(job.params, "resolution"),
    n: paramNumber(job.params, "n"),
    seed: paramNumber(job.params, "seed"),
    promptOptimizer: job.params.promptOptimizer !== false,
    referenceImage: await readFrame(job.params, "firstFrame"),
  });

  const ratio = paramString(job.params, "ratio") || "1:1";

  if (result.urls?.length) {
    await finalizeImages(job, result.urls, ratio);
    return;
  }

  if (result.taskId) {
    await sql`
      UPDATE assets SET provider_task_id = ${result.taskId}, next_run_at = now() + interval '4 seconds', updated_at = now()
      WHERE id = ${job.id}
    `;
    log(`submitted image ${job.id} via ${job.provider} -> ${result.taskId}`);
    return;
  }

  throw new ProviderError("图片生成没有返回结果", "empty", 200);
}

async function pollJob(job: JobRow) {
  const adapter = requireAdapter(job);
  const ctx = await getAdapterContext(job.provider, job.user_id);
  const taskId = job.provider_task_id!;

  const state =
    job.kind === "video"
      ? await (adapter.pollVideo?.(ctx, taskId) ??
          Promise.reject(new ProviderError("该供应商不支持视频查询", "unsupported", 500)))
      : await (adapter.pollImage?.(ctx, taskId) ??
          Promise.reject(new ProviderError("该供应商不支持图片查询", "unsupported", 500)));

  if (state.status === "queued" || state.status === "running") {
    await sql`
      UPDATE assets SET locked_at = now(), next_run_at = now() + interval '4 seconds', updated_at = now()
      WHERE id = ${job.id}
    `;
    return;
  }

  if (state.status === "cancelled") {
    await sql`
      UPDATE assets SET status = 'cancelled', updated_at = now(), completed_at = now()
      WHERE id = ${job.id}
    `;
    return;
  }

  if (state.status === "failed") {
    const code = state.error?.code ?? "failed";
    await sql`
      UPDATE assets SET
        status = 'failed',
        error_code = ${code},
        error_message = ${friendlyError(code, state.error?.message)},
        completed_at = now(),
        updated_at = now()
      WHERE id = ${job.id}
    `;
    log(`${job.kind} ${job.id} failed via ${job.provider}: ${code} ${state.error?.message ?? ""}`);
    return;
  }

  if (job.kind === "image") {
    const urls = state.urls?.length ? state.urls : state.url ? [state.url] : [];
    if (!urls.length) {
      throw new ProviderError("任务已完成但没有返回图片地址", "no_output", 500);
    }
    await finalizeImages(job, urls, paramString(job.params, "ratio") || "1:1");
    return;
  }

  await finalizeVideo(job, state);
}

async function processJob(job: JobRow) {
  if (job.provider_task_id) {
    await pollJob(job);
  } else {
    await submitJob(job);
  }
}

async function failJob(job: JobRow, error: unknown) {
  const providerError = error instanceof ProviderError ? error : null;
  const code = providerError?.code ?? "error";
  const attempts = job.attempts + 1;

  if (RETRYABLE.has(code) && attempts < MAX_ATTEMPTS) {
    const delay = Math.min(60, 5 * attempts);
    await sql`
      UPDATE assets SET
        status = 'pending',
        attempts = ${attempts},
        locked_at = NULL,
        next_run_at = now() + ${`${delay} seconds`}::interval,
        error_code = ${code},
        error_message = ${friendlyError(code, providerError?.message)},
        updated_at = now()
      WHERE id = ${job.id}
    `;
    log(`job ${job.id} retry in ${delay}s (${code}, attempt ${attempts})`);
    return;
  }

  await sql`
    UPDATE assets SET
      status = 'failed',
      error_code = ${code},
      error_message = ${friendlyError(
        code,
        providerError?.message ?? (error instanceof Error ? error.message : null),
      )},
      completed_at = now(),
      updated_at = now()
    WHERE id = ${job.id}
  `;
  log(`job ${job.id} failed: ${code}`, error);
}

async function recoverStale() {
  const rows = await sql`
    UPDATE assets SET
      status = 'failed',
      error_code = 'timeout',
      error_message = '任务超时（长时间无响应），请重试',
      completed_at = now(),
      updated_at = now()
    WHERE status = 'running' AND locked_at < now() - interval '30 minutes'
    RETURNING id
  `;
  if (rows.length) log(`recovered ${rows.length} stale job(s)`);
}

async function heartbeat() {
  await sql`
    INSERT INTO system_status (key, value, updated_at)
    VALUES ('worker', ${jsonb({ alive: true, pid: process.pid })}, now())
    ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = now()
  `;
}

async function tick() {
  await heartbeat();
  for (let i = 0; i < Math.max(1, env.minimax.concurrency); i += 1) {
    if (!running) return;
    const job = await claimNext();
    if (!job) return;
    try {
      await processJob(job);
    } catch (error) {
      await failJob(job, error);
    }
  }
}

async function main() {
  await ensureMediaDir();
  log(
    `started (mock=${env.minimax.mock ? "on" : "off"}, concurrency=${env.minimax.concurrency}, poll=${env.minimax.pollMs}ms)`,
  );

  const timer = setInterval(() => {
    recoverStale().catch((error) => log("recoverStale error", error));
  }, 60_000);

  while (running) {
    try {
      await tick();
    } catch (error) {
      log("tick error", error);
    }
    await new Promise((resolve) =>
      setTimeout(resolve, Math.max(500, env.minimax.pollMs)),
    );
  }

  clearInterval(timer);
  await sql.end({ timeout: 5 });
  log("stopped");
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    log(`received ${signal}, shutting down`);
    running = false;
  });
}

main().catch(async (error) => {
  console.error("[worker] fatal", error);
  process.exitCode = 1;
  await sql.end({ timeout: 3 }).catch(() => {});
});
