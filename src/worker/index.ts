import { sql, jsonb } from "../lib/db";
import { env } from "../lib/env";
import { friendlyError } from "../lib/errors";
import {
  createVideoTask,
  downloadRemote,
  generateImages,
  MinimaxError,
  queryVideoTask,
  type VideoRequest,
} from "../lib/minimax";
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

async function submitJob(job: JobRow) {
  if (job.kind === "video") {
    const req: VideoRequest = {
      model: job.model,
      prompt: job.prompt,
      resolution: paramString(job.params, "resolution") || "768P",
      duration: paramNumber(job.params, "duration") || 5,
      ratio: paramString(job.params, "ratio"),
      promptExpansion:
        (paramString(job.params, "promptExpansion") as
          | "disabled"
          | "balanced"
          | "quality"
          | undefined) ?? "balanced",
      firstFrame: await readFrame(job.params, "firstFrame"),
      lastFrame: await readFrame(job.params, "lastFrame"),
    };
    const taskId = await createVideoTask(req);
    await sql`
      UPDATE assets SET provider_task_id = ${taskId}, next_run_at = now() + interval '2 seconds', updated_at = now()
      WHERE id = ${job.id}
    `;
    log(`submitted ${job.kind} ${job.id} -> ${taskId}`);
    return;
  }

  // Image generation is synchronous; run it inside the job.
  const result = await generateImages({
    model: job.model,
    prompt: job.prompt,
    aspectRatio: paramString(job.params, "ratio") || "1:1",
    n: paramNumber(job.params, "n") || 1,
    seed: paramNumber(job.params, "seed"),
    promptOptimizer: job.params.promptOptimizer !== false,
  });

  if (!result.urls.length) {
    throw new MinimaxError("图片生成失败：没有返回结果", "500", 500);
  }

  for (let index = 0; index < result.urls.length; index += 1) {
    const url = result.urls[index];
    const { data, contentType } = await downloadRemote(url);
    const ext = extFromMime(contentType, "png");
    const targetId = index === 0 ? job.id : null;
    const key = storageKeyFor(targetId ?? `${job.id}-${index + 1}`, ext);
    await saveMedia(key, data);

    if (index === 0) {
      await sql`
        UPDATE assets SET
          status = 'succeeded',
          storage_key = ${key},
          remote_url = ${url},
          aspect_ratio = ${paramString(job.params, "ratio") || "1:1"},
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
          ${key}, ${url}, ${paramString(job.params, "ratio") || "1:1"}, now()
        )
      `;
    }
  }
  log(`image ${job.id} generated ${result.urls.length} file(s)`);
}

async function pollJob(job: JobRow) {
  const taskId = job.provider_task_id!;
  const state = await queryVideoTask(taskId);

  if (state.status === "queued" || state.status === "running") {
    await sql`
      UPDATE assets SET locked_at = now(), next_run_at = now() + interval '3 seconds', updated_at = now()
      WHERE id = ${job.id}
    `;
    return;
  }

  if (state.status === "failed" || state.status === "cancelled") {
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
    log(`video ${job.id} failed: ${code} ${state.error?.message ?? ""}`);
    return;
  }

  if (!state.url) {
    throw new MinimaxError("任务成功但没有返回视频地址", "500", 500);
  }

  const { data, contentType } = await downloadRemote(state.url);
  const key = storageKeyFor(job.id, extFromMime(contentType, "mp4"));
  await saveMedia(key, data);

  await sql`
    UPDATE assets SET
      status = 'succeeded',
      storage_key = ${key},
      remote_url = ${state.url},
      duration_seconds = ${state.duration ?? null},
      resolution = ${state.resolution ?? null},
      aspect_ratio = ${state.ratio ?? null},
      usage = ${jsonb(state.usage ?? null)},
      completed_at = now(),
      updated_at = now(),
      error_code = NULL,
      error_message = NULL
    WHERE id = ${job.id}
  `;
  log(`video ${job.id} succeeded (${Math.round(data.length / 1024)} KB)`);
}

async function processJob(job: JobRow) {
  if (job.provider_task_id) {
    await pollJob(job);
  } else {
    await submitJob(job);
  }
}

async function failJob(job: JobRow, error: unknown) {
  const minimaxError = error instanceof MinimaxError ? error : null;
  const code = minimaxError?.code ?? "error";
  const retryable = ["1002", "429", "500", "529", "overloaded"].includes(code);

  if (retryable && job.attempts < MAX_ATTEMPTS) {
    const delay = Math.min(60, 5 * job.attempts);
    await sql`
      UPDATE assets SET
        status = 'pending',
        locked_at = NULL,
        next_run_at = now() + ${`${delay} seconds`}::interval,
        error_code = ${code},
        error_message = ${friendlyError(code, minimaxError?.message)},
        updated_at = now()
      WHERE id = ${job.id}
    `;
    log(`job ${job.id} retry in ${delay}s (${code})`);
    return;
  }

  await sql`
    UPDATE assets SET
      status = 'failed',
      error_code = ${code},
      error_message = ${friendlyError(code, minimaxError?.message ?? (error instanceof Error ? error.message : null))},
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
