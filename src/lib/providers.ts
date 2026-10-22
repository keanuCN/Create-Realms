import { sql } from "./db";
import { env } from "./env";
import { decryptSecret, encryptSecret, maskSecret } from "./secrets";

export interface ProviderSpec {
  id: string;
  label: string;
  vendor: string;
  status: "ready" | "planned";
  /** What it can generate with this provider. */
  capability: string;
  defaultBase: string;
  docsUrl: string;
  keyPlaceholder: string;
  note: string;
}

export const PROVIDERS: ProviderSpec[] = [
  {
    id: "minimax",
    label: "MiniMax 海螺",
    vendor: "MiniMax",
    status: "ready",
    capability: "视频（H3 / H3 Max）+ 图片（image-01）",
    defaultBase: "https://api.minimax.cn",
    docsUrl: "https://platform.minimax.cn/user-center/basic-information/interface-key",
    keyPlaceholder: "sk-cp-...",
    note: "当前已接入。国际站请把 Base URL 改成 https://api.minimax.io",
  },
  {
    id: "volcengine-ark",
    label: "即梦 / 豆包（火山方舟）",
    vendor: "字节跳动",
    status: "planned",
    capability: "视频（Seedance）+ 图片（Seedream）",
    defaultBase: "https://ark.cn-beijing.volces.com/api/v3",
    docsUrl: "https://console.volcengine.com/ark",
    keyPlaceholder: "填入方舟 API Key",
    note: "Key 可以先存着；等适配器接入后自动生效，无需再改配置。",
  },
  {
    id: "kling",
    label: "可灵 AI",
    vendor: "快手",
    status: "planned",
    capability: "视频（可灵 1.6 / 2.x）",
    defaultBase: "https://api-beijing.klingai.com",
    docsUrl: "https://app.klingai.com/cn/dev/document-api",
    keyPlaceholder: "AccessKey / SecretKey",
    note: "待接入。",
  },
  {
    id: "openai",
    label: "OpenAI",
    vendor: "OpenAI",
    status: "planned",
    capability: "图片（gpt-image）+ 视频（Sora）",
    defaultBase: "https://api.openai.com/v1",
    docsUrl: "https://platform.openai.com/api-keys",
    keyPlaceholder: "sk-...",
    note: "待接入。",
  },
  {
    id: "google",
    label: "Google AI",
    vendor: "Google",
    status: "planned",
    capability: "图片（Imagen）+ 视频（Veo）",
    defaultBase: "https://generativelanguage.googleapis.com",
    docsUrl: "https://aistudio.google.com/apikey",
    keyPlaceholder: "AIza...",
    note: "待接入。",
  },
  {
    id: "runway",
    label: "Runway",
    vendor: "Runway",
    status: "planned",
    capability: "视频（Gen 系列）",
    defaultBase: "https://api.dev.runwayml.com/v1",
    docsUrl: "https://dev.runwayml.com",
    keyPlaceholder: "key_...",
    note: "待接入。",
  },
];

export function getProviderSpec(id: string): ProviderSpec | undefined {
  return PROVIDERS.find((item) => item.id === id);
}

interface ProviderRow {
  provider: string;
  api_key_enc: string | null;
  api_base: string | null;
  enabled: boolean;
  updated_at: Date;
  last_check_at: Date | null;
  last_check_ok: boolean | null;
  last_check_message: string | null;
}

export interface ProviderRuntime {
  provider: string;
  apiKey: string;
  apiBase: string;
  enabled: boolean;
  source: "database" | "env" | "none";
}

const CACHE_TTL_MS = 15_000;
const runtimeCache = new Map<string, { value: ProviderRuntime; at: number }>();
let seeded = false;

function envFallback(provider: string): { apiKey: string; apiBase: string } {
  if (provider === "minimax") {
    return { apiKey: env.minimax.apiKey, apiBase: env.minimax.apiBase };
  }
  return { apiKey: "", apiBase: "" };
}

function invalidate(provider?: string) {
  if (provider) runtimeCache.delete(provider);
  else runtimeCache.clear();
}

/** Move an existing env-configured key into the database once, so the UI shows it. */
async function seedFromEnv() {
  if (seeded) return;
  seeded = true;
  try {
    const rows = await sql<{ provider: string }[]>`
      SELECT provider FROM provider_configs
    `;
    const known = new Set(rows.map((row) => row.provider));
    for (const spec of PROVIDERS) {
      const fallback = envFallback(spec.id);
      if (known.has(spec.id) || !fallback.apiKey) continue;
      await sql`
        INSERT INTO provider_configs (provider, api_key_enc, api_base, enabled)
        VALUES (${spec.id}, ${encryptSecret(fallback.apiKey)}, ${fallback.apiBase || spec.defaultBase}, true)
        ON CONFLICT (provider) DO NOTHING
      `;
      console.log(`[providers] imported ${spec.id} key from environment`);
    }
    if (known.size !== PROVIDERS.length) invalidate();
  } catch (error) {
    console.error("[providers] seed failed", error);
  }
}

export async function getProviderRuntime(provider: string): Promise<ProviderRuntime> {
  const cached = runtimeCache.get(provider);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.value;

  await seedFromEnv();
  const spec = getProviderSpec(provider);
  const fallback = envFallback(provider);

  let value: ProviderRuntime;
  try {
    const rows = await sql<ProviderRow[]>`
      SELECT * FROM provider_configs WHERE provider = ${provider} LIMIT 1
    `;
    const row = rows[0];
    const dbKey = decryptSecret(row?.api_key_enc);
    if (dbKey) {
      value = {
        provider,
        apiKey: dbKey,
        apiBase: (row?.api_base || spec?.defaultBase || fallback.apiBase || "").replace(/\/+$/, ""),
        enabled: row?.enabled ?? true,
        source: "database",
      };
    } else {
      value = {
        provider,
        apiKey: fallback.apiKey,
        apiBase: (row?.api_base || fallback.apiBase || spec?.defaultBase || "").replace(/\/+$/, ""),
        enabled: row?.enabled ?? true,
        source: fallback.apiKey ? "env" : "none",
      };
    }
  } catch (error) {
    console.error("[providers] read failed", error);
    value = {
      provider,
      apiKey: fallback.apiKey,
      apiBase: fallback.apiBase || spec?.defaultBase || "",
      enabled: true,
      source: fallback.apiKey ? "env" : "none",
    };
  }

  runtimeCache.set(provider, { value, at: Date.now() });
  return value;
}

export async function isProviderReady(provider: string): Promise<boolean> {
  const runtime = await getProviderRuntime(provider);
  return runtime.enabled && Boolean(runtime.apiKey);
}

export interface ProviderView extends ProviderSpec {
  configured: boolean;
  enabled: boolean;
  maskedKey: string | null;
  apiBase: string;
  source: "database" | "env" | "none";
  updatedAt: string | null;
  lastCheckAt: string | null;
  lastCheckOk: boolean | null;
  lastCheckMessage: string | null;
}

export async function listProviderViews(): Promise<ProviderView[]> {
  await seedFromEnv();
  const rows = await sql<ProviderRow[]>`SELECT * FROM provider_configs`;
  const byId = new Map(rows.map((row) => [row.provider, row]));

  return PROVIDERS.map((spec) => {
    const row = byId.get(spec.id);
    const key = decryptSecret(row?.api_key_enc) || envFallback(spec.id).apiKey || "";
    const source: ProviderView["source"] = row?.api_key_enc
      ? "database"
      : envFallback(spec.id).apiKey
        ? "env"
        : "none";
    return {
      ...spec,
      configured: Boolean(key),
      enabled: row?.enabled ?? true,
      maskedKey: maskSecret(key),
      apiBase: row?.api_base || envFallback(spec.id).apiBase || spec.defaultBase,
      source,
      updatedAt: row?.updated_at ? row.updated_at.toISOString() : null,
      lastCheckAt: row?.last_check_at ? row.last_check_at.toISOString() : null,
      lastCheckOk: row?.last_check_ok ?? null,
      lastCheckMessage: row?.last_check_message ?? null,
    };
  });
}

export async function saveProviderConfig(
  provider: string,
  input: { apiKey?: string; apiBase?: string; enabled?: boolean },
  userId: string,
): Promise<void> {
  const spec = getProviderSpec(provider);
  if (!spec) throw new Error("未知的模型供应商");

  const exists = await sql<{ provider: string }[]>`
    SELECT provider FROM provider_configs WHERE provider = ${provider} LIMIT 1
  `;

  if (!exists.length) {
    await sql`
      INSERT INTO provider_configs (provider, api_key_enc, api_base, enabled, updated_by)
      VALUES (
        ${provider},
        ${input.apiKey ? encryptSecret(input.apiKey) : null},
        ${input.apiBase || spec.defaultBase},
        ${input.enabled ?? true},
        ${userId}
      )
    `;
    invalidate(provider);
    return;
  }

  const sets: ReturnType<typeof sql>[] = [sql`updated_at = now()`, sql`updated_by = ${userId}`];
  if (input.apiKey !== undefined) {
    sets.push(
      input.apiKey
        ? sql`api_key_enc = ${encryptSecret(input.apiKey)}`
        : sql`api_key_enc = NULL`,
    );
  }
  if (input.apiBase !== undefined) {
    sets.push(sql`api_base = ${input.apiBase || spec.defaultBase}`);
  }
  if (input.enabled !== undefined) sets.push(sql`enabled = ${input.enabled}`);

  const setClause = sets.reduce((acc, item, index) => (index === 0 ? item : sql`${acc}, ${item}`), sql``);
  await sql`UPDATE provider_configs SET ${setClause} WHERE provider = ${provider}`;
  invalidate(provider);
}

async function recordCheck(provider: string, ok: boolean, message: string) {
  await sql`
    UPDATE provider_configs
    SET last_check_at = now(), last_check_ok = ${ok}, last_check_message = ${message}
    WHERE provider = ${provider}
  `;
  invalidate(provider);
}

/**
 * Cheap connectivity check that does not consume any generation quota.
 * For MiniMax we query a bogus task id: a valid key gets a "task not found"
 * style error, an invalid key gets 401 / code 1004 / 2049.
 */
export async function testProvider(provider: string): Promise<{ ok: boolean; message: string }> {
  const runtime = await getProviderRuntime(provider);
  if (!runtime.apiKey) {
    const message = "还没有填写 API Key";
    await recordCheck(provider, false, message).catch(() => {});
    return { ok: false, message };
  }

  try {
    if (provider === "minimax") {
      const res = await fetch(
        `${runtime.apiBase}/v2/query/video_generation/000000000000000`,
        {
          headers: { Authorization: `Bearer ${runtime.apiKey}` },
          signal: AbortSignal.timeout(20_000),
        },
      );
      const text = await res.text();
      if (res.status === 401 || /"(1004|2049)"/.test(text)) {
        const message = "Key 无效或已失效（鉴权失败）";
        await recordCheck(provider, false, message);
        return { ok: false, message };
      }
      if (res.status >= 500) {
        const message = `服务端异常（HTTP ${res.status}），请稍后再试`;
        await recordCheck(provider, false, message);
        return { ok: false, message };
      }
      const message = "连接正常，Key 有效";
      await recordCheck(provider, true, message);
      return { ok: true, message };
    }

    // Generic reachability check for providers without an adapter yet.
    const res = await fetch(runtime.apiBase, {
      method: "HEAD",
      signal: AbortSignal.timeout(15_000),
    }).catch(() => null);
    const message = res
      ? `服务地址可达（HTTP ${res.status}）；该供应商尚未接入生成流程`
      : "服务地址不可达，请检查 Base URL 或网络";
    const ok = Boolean(res);
    await recordCheck(provider, ok, message);
    return { ok, message };
  } catch (error) {
    const message =
      error instanceof Error ? `测试失败：${error.message}` : "测试失败：未知错误";
    await recordCheck(provider, false, message).catch(() => {});
    return { ok: false, message };
  }
}