import { getAdapter } from "./adapters";
import type { AdapterContext } from "./adapters/types";
import { sql } from "./db";
import { env } from "./env";
import { decryptSecret, encryptSecret, maskSecret } from "./secrets";

export interface CredentialField {
  key: string;
  label: string;
  placeholder: string;
  hint?: string;
  required?: boolean;
}

export interface ProviderSpec {
  id: string;
  label: string;
  vendor: string;
  capability: string;
  defaultBase: string;
  docsUrl: string;
  note: string;
  credentialFields: CredentialField[];
}

const SINGLE_KEY = (placeholder: string, label = "API Key"): CredentialField[] => [
  { key: "apiKey", label, placeholder },
];

export const PROVIDERS: ProviderSpec[] = [
  {
    id: "minimax",
    label: "MiniMax 海螺",
    vendor: "MiniMax",
    capability: "视频（H3 / H3 Max）+ 图片（image-01）",
    defaultBase: "https://api.minimax.cn",
    docsUrl: "https://platform.minimax.cn/user-center/basic-information/interface-key",
    note: "国际站请把 Base URL 改成 https://api.minimax.io",
    credentialFields: SINGLE_KEY("sk-cp-..."),
  },
  {
    id: "volcengine-ark",
    label: "即梦 / 豆包（火山方舟）",
    vendor: "字节跳动",
    capability: "视频（Seedance 2.5 / 2.0）+ 图片（Seedream 5.0 Pro / Flash）",
    defaultBase: "https://ark.cn-beijing.volces.com/api/v3",
    docsUrl: "https://console.volcengine.com/ark",
    note: "注意 Base URL 必须带 /api/v3 后缀",
    credentialFields: SINGLE_KEY("填入方舟 API Key"),
  },
  {
    id: "kling",
    label: "可灵 AI",
    vendor: "快手",
    capability: "视频（可灵 3.0 / 2.6 / 3.0 Turbo；4.0 暂未开放）",
    defaultBase: "https://api-beijing.klingai.com",
    docsUrl: "https://klingai.com/dev/api-key",
    note: "使用新版 API Key 鉴权（控制台「API Key」页面，注意不是 AK/SK）",
    credentialFields: SINGLE_KEY("填入可灵 API Key"),
  },
  {
    id: "pixverse",
    label: "爱诗科技 PixVerse",
    vendor: "爱诗科技",
    capability: "视频（C1 / V6 Max / V6 / V5.6）",
    defaultBase: "https://app-api.pixverse.ai",
    docsUrl: "https://platform.pixverse.ai",
    note: "使用 API-KEY 请求头鉴权",
    credentialFields: SINGLE_KEY("填入 PixVerse API Key"),
  },
  {
    id: "vidu",
    label: "生数科技 Vidu",
    vendor: "生数科技",
    capability: "视频（Vidu Q3 Pro / Turbo）",
    defaultBase: "https://api.vidu.cn",
    docsUrl: "https://platform.vidu.cn",
    note: "使用 Authorization: Token 鉴权",
    credentialFields: SINGLE_KEY("填入 Vidu API Key"),
  },
  {
    id: "dashscope",
    label: "通义万相 / 千问 / HappyHorse",
    vendor: "阿里云百炼",
    capability: "视频（HappyHorse 1.1 / 万相 3.0、2.7）+ 图片（万相 2.7、千问图像 3.0、万相 2.6）",
    defaultBase: "https://dashscope.aliyuncs.com/api/v1",
    docsUrl: "https://bailian.console.aliyun.com/cn-beijing/model/settings/api-key",
    note: "百炼的 Key 按地域独立，注意控制台地域与 Base URL 对应",
    credentialFields: SINGLE_KEY("sk-..."),
  },
  {
    id: "openai",
    label: "OpenAI",
    vendor: "OpenAI",
    capability: "图片（GPT Image 2.5 Sunburst / Flare）",
    defaultBase: "https://api.openai.com/v1",
    docsUrl: "https://platform.openai.com/api-keys",
    note: "已接入图片生成与参考图编辑；OpenAI Sora 视频 API 已下线",
    credentialFields: SINGLE_KEY("sk-..."),
  },
  {
    id: "google",
    label: "Google Gemini",
    vendor: "Google",
    capability: "图片（Nano Banana 2 / 2 Lite / Pro / 2.1）+ 视频（Gemini Omni Flash）",
    defaultBase: "https://generativelanguage.googleapis.com",
    docsUrl: "https://aistudio.google.com/apikey",
    note: "Gemini API Key；Imagen 已停用，Veo 3.1 预览 API 于 2026-10-22 到退役日期",
    credentialFields: SINGLE_KEY("AIza..."),
  },
  {
    id: "google-vertex",
    label: "Google Cloud Veo",
    vendor: "Google Cloud",
    capability: "视频（Veo 3.1 / 3.1 Fast / 3.1 Lite）",
    defaultBase: "https://us-central1-aiplatform.googleapis.com/v1",
    docsUrl: "https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/veo/3-1-generate?hl=zh-CN",
    note: "需在 Google Cloud 启用 Agent Platform API 和计费，为服务账号授予 Vertex AI User；当前使用 us-central1。生成结果会下载并存入本地作品库。",
    credentialFields: [
      {
        key: "projectId",
        label: "Google Cloud 项目 ID",
        placeholder: "my-google-cloud-project",
        hint: "在 Google Cloud 项目设置中查看，不是项目名称。",
      },
      {
        key: "serviceAccountJson",
        label: "服务账号 JSON Key",
        placeholder: "粘贴下载的服务账号 JSON 文件全部内容",
        hint: "创建服务账号并授予 Vertex AI User 后下载 JSON Key。凭据会按个人加密保存。若 Google 返回 GCS 文件，还需授予该账号读取对应对象的权限。",
      },
    ],
  },
  {
    id: "xai",
    label: "xAI Grok Imagine",
    vendor: "xAI",
    capability: "视频（Grok Imagine Video 1.5，原生音画生成）",
    defaultBase: "https://api.x.ai/v1",
    docsUrl: "https://console.x.ai/",
    note: "服务端需能访问 api.x.ai；参考图模式最高 720p。",
    credentialFields: SINGLE_KEY("填入 xAI API Key"),
  },
  {
    id: "tencent-hy",
    label: "腾讯混元 Hy Video",
    vendor: "腾讯云 TokenHub",
    capability: "视频（Hy Video 1.5 文生 / 图生）",
    defaultBase: "https://tokenhub-intl.tencentcloudmaas.com",
    docsUrl: "https://intl.cloud.tencent.com/zh/document/product/1300/83716",
    note: "默认新加坡站；API Key 与 TokenHub 地域需匹配，广州站请由管理员改为 https://tokenhub.tencentcloudmaas.com。还需开通 Hy-Video-1.5 后付费；当前固定 5 秒 / 720p。",
    credentialFields: SINGLE_KEY("填入腾讯云 TokenHub API Key"),
  },
  {
    id: "runway",
    label: "Runway",
    vendor: "Runway",
    capability: "视频（Gen 系列）",
    defaultBase: "https://api.dev.runwayml.com/v1",
    docsUrl: "https://dev.runwayml.com",
    note: "适配器尚未接入",
    credentialFields: SINGLE_KEY("key_..."),
  },
];

export function getProviderSpec(id: string): ProviderSpec | undefined {
  return PROVIDERS.find((item) => item.id === id);
}

export type Credentials = Record<string, string>;

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
  apiBase: string;
  enabled: boolean;
  source: "database" | "env" | "none";
  credentials: Credentials;
  /** 单 Key 供应商的便捷入口 */
  apiKey: string;
}

const CACHE_TTL_MS = 15_000;
const runtimeCache = new Map<string, { value: ProviderRuntime; at: number }>();
let seeded = false;

function envFallback(provider: string): { credentials: Credentials; apiBase: string } {
  if (provider === "minimax" && env.minimax.apiKey) {
    return {
      credentials: { apiKey: env.minimax.apiKey },
      apiBase: env.minimax.apiBase,
    };
  }
  return { credentials: {}, apiBase: "" };
}

/** Stored as an encrypted JSON object; older rows held a bare key string. */
function parseStoredCredentials(decrypted: string | null): Credentials {
  if (!decrypted) return {};
  try {
    const parsed = JSON.parse(decrypted) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Credentials;
    }
    if (typeof parsed === "string") return { apiKey: parsed };
  } catch {
    // not JSON → legacy single key
  }
  return { apiKey: decrypted };
}

function serializeCredentials(credentials: Credentials): string {
  return JSON.stringify(credentials);
}

function invalidate(provider?: string) {
  if (provider) runtimeCache.delete(provider);
  else runtimeCache.clear();
}

export function requiredCredentialFields(spec: ProviderSpec): CredentialField[] {
  return spec.credentialFields;
}

export function hasAllCredentials(spec: ProviderSpec, credentials: Credentials): boolean {
  return requiredCredentialFields(spec).every((field) =>
    Boolean(credentials[field.key]?.trim()),
  );
}

export function activeCredentials(credentials: Credentials): Credentials {
  const result: Credentials = {};
  for (const [key, value] of Object.entries(credentials)) {
    if (typeof value === "string" && value.trim()) result[key] = value.trim();
  }
  return result;
}

async function seedFromEnv() {
  if (seeded) return;
  seeded = true;
  try {
    const rows = await sql<{ provider: string }[]>`SELECT provider FROM provider_configs`;
    const known = new Set(rows.map((row) => row.provider));
    for (const spec of PROVIDERS) {
      const fallback = envFallback(spec.id);
      if (known.has(spec.id) || !fallback.credentials.apiKey) continue;
      await sql`
        INSERT INTO provider_configs (provider, api_key_enc, api_base, enabled)
        VALUES (
          ${spec.id},
          ${encryptSecret(serializeCredentials(fallback.credentials))},
          ${fallback.apiBase || spec.defaultBase},
          true
        )
        ON CONFLICT (provider) DO NOTHING
      `;
      console.log(`[providers] imported ${spec.id} credentials from environment`);
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
    const stored = activeCredentials(parseStoredCredentials(decryptSecret(row?.api_key_enc)));
    const credentials = Object.keys(stored).length ? stored : fallback.credentials;
    value = {
      provider,
      apiBase: (row?.api_base || fallback.apiBase || spec?.defaultBase || "").replace(/\/+$/, ""),
      enabled: row?.enabled ?? true,
      source: Object.keys(stored).length ? "database" : fallback.credentials.apiKey ? "env" : "none",
      credentials,
      apiKey: credentials.apiKey ?? "",
    };
  } catch (error) {
    console.error("[providers] read failed", error);
    value = {
      provider,
      apiBase: fallback.apiBase || spec?.defaultBase || "",
      enabled: true,
      source: fallback.credentials.apiKey ? "env" : "none",
      credentials: fallback.credentials,
      apiKey: fallback.credentials.apiKey ?? "",
    };
  }

  runtimeCache.set(provider, { value, at: Date.now() });
  return value;
}

export async function getAdapterContext(provider: string, userId: string): Promise<AdapterContext> {
  const runtime = await getProviderRuntime(provider);
  const credentials = await getUserCredentials(provider, userId);
  return {
    provider,
    apiBase: runtime.apiBase,
    apiKey: credentials.apiKey ?? "",
    credentials,
  };
}

/** 供应商是否可用：已启用 + 适配器已接入 + 必填凭据齐全。 */
export async function isProviderReady(provider: string, userId: string): Promise<boolean> {
  const spec = getProviderSpec(provider);
  const adapter = getAdapter(provider);
  if (!spec || !adapter) return false;
  const runtime = await getProviderRuntime(provider);
  const credentials = await getUserCredentials(provider, userId);
  return runtime.enabled && hasAllCredentials(spec, credentials);
}

interface UserProviderRow {
  api_key_enc: string | null;
  updated_at: Date;
}

async function getUserCredentials(provider: string, userId: string): Promise<Credentials> {
  const rows = await sql<UserProviderRow[]>`
    SELECT api_key_enc, updated_at FROM user_provider_configs
    WHERE user_id = ${userId} AND provider = ${provider} LIMIT 1
  `;
  return activeCredentials(parseStoredCredentials(decryptSecret(rows[0]?.api_key_enc)));
}

export async function listUserProviderViews(userId: string): Promise<ProviderView[]> {
  const [globalViews, rows] = await Promise.all([
    listProviderViews(),
    sql<(UserProviderRow & { provider: string })[]>`
      SELECT provider, api_key_enc, updated_at FROM user_provider_configs WHERE user_id = ${userId}
    `,
  ]);
  const byId = new Map(rows.map((row) => [row.provider, row]));
  return globalViews.map((item) => {
    const row = byId.get(item.id);
    const credentials = activeCredentials(parseStoredCredentials(decryptSecret(row?.api_key_enc)));
    return {
      ...item,
      configured: hasAllCredentials(item, credentials),
      source: Object.keys(credentials).length ? "database" : "none",
      credentials: item.credentialFields.map((field) => {
        const value = credentials[field.key] ?? "";
        return { ...field, configured: Boolean(value), masked: maskSecret(value) };
      }),
      updatedAt: row?.updated_at ? row.updated_at.toISOString() : null,
      lastCheckAt: null,
      lastCheckOk: null,
      lastCheckMessage: null,
    };
  });
}

export async function saveUserProviderCredentials(
  provider: string,
  credentials: Credentials,
  userId: string,
): Promise<void> {
  const spec = getProviderSpec(provider);
  if (!spec) throw new Error("未知的模型供应商");
  const current = await getUserCredentials(provider, userId);
  const merged = { ...current };
  for (const field of spec.credentialFields) {
    const value = credentials[field.key];
    if (value === undefined) continue;
    if (value.trim()) merged[field.key] = value.trim();
    else delete merged[field.key];
  }
  const encrypted = Object.keys(merged).length
    ? encryptSecret(serializeCredentials(merged))
    : null;
  await sql`
    INSERT INTO user_provider_configs (user_id, provider, api_key_enc, updated_at)
    VALUES (${userId}, ${provider}, ${encrypted}, now())
    ON CONFLICT (user_id, provider) DO UPDATE SET
      api_key_enc = ${encrypted}, updated_at = now()
  `;
  runtimeCache.delete(`${provider}:${userId}`);
}

export interface ProviderCredentialView extends CredentialField {
  configured: boolean;
  masked: string | null;
}

export interface ProviderView extends ProviderSpec {
  status: "ready" | "planned";
  configured: boolean;
  enabled: boolean;
  apiBase: string;
  source: "database" | "env" | "none";
  credentials: ProviderCredentialView[];
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
    const stored = activeCredentials(parseStoredCredentials(decryptSecret(row?.api_key_enc)));
    const credentials = Object.keys(stored).length ? stored : envFallback(spec.id).credentials;
    const source: ProviderView["source"] = Object.keys(stored).length
      ? "database"
      : envFallback(spec.id).credentials.apiKey
        ? "env"
        : "none";

    return {
      ...spec,
      status: getAdapter(spec.id) ? "ready" : "planned",
      configured: hasAllCredentials(spec, credentials),
      enabled: row?.enabled ?? true,
      apiBase: row?.api_base || envFallback(spec.id).apiBase || spec.defaultBase,
      source,
      credentials: spec.credentialFields.map((field) => {
        const value = credentials[field.key] ?? "";
        return { ...field, configured: Boolean(value), masked: maskSecret(value) };
      }),
      updatedAt: row?.updated_at ? row.updated_at.toISOString() : null,
      lastCheckAt: row?.last_check_at ? row.last_check_at.toISOString() : null,
      lastCheckOk: row?.last_check_ok ?? null,
      lastCheckMessage: row?.last_check_message ?? null,
    };
  });
}

export async function saveProviderConfig(
  provider: string,
  input: { credentials?: Credentials; apiBase?: string; enabled?: boolean },
  userId: string,
): Promise<void> {
  const spec = getProviderSpec(provider);
  if (!spec) throw new Error("未知的模型供应商");

  const existing = await sql<ProviderRow[]>`
    SELECT * FROM provider_configs WHERE provider = ${provider} LIMIT 1
  `;
  const current = activeCredentials(parseStoredCredentials(decryptSecret(existing[0]?.api_key_enc)));

  // 只覆盖本次提交的字段；提交空字符串表示清除该字段。
  const merged: Credentials = { ...current };
  if (input.credentials) {
    for (const field of spec.credentialFields) {
      const submitted = input.credentials[field.key];
      if (submitted === undefined) continue;
      const trimmed = submitted.trim();
      if (trimmed) merged[field.key] = trimmed;
      else delete merged[field.key];
    }
  }

  const mergedKeys = Object.keys(merged);
  // 空凭据时存 NULL，而不是一个空对象密文，这样 has_key 才有意义
  const encrypted = mergedKeys.length ? encryptSecret(serializeCredentials(merged)) : null;

  if (!existing.length) {
    await sql`
      INSERT INTO provider_configs (provider, api_key_enc, api_base, enabled, updated_by)
      VALUES (
        ${provider},
        ${encrypted},
        ${input.apiBase || spec.defaultBase},
        ${input.enabled ?? true},
        ${userId}
      )
    `;
    invalidate(provider);
    return;
  }

  const sets: ReturnType<typeof sql>[] = [
    sql`updated_at = now()`,
    sql`updated_by = ${userId}`,
  ];
  if (input.credentials) sets.push(sql`api_key_enc = ${encrypted}`);
  if (input.apiBase !== undefined) sets.push(sql`api_base = ${input.apiBase || spec.defaultBase}`);
  if (input.enabled !== undefined) sets.push(sql`enabled = ${input.enabled}`);

  const setClause = sets.reduce((acc, item, index) => (index === 0 ? item : sql`${acc}, ${item}`), sql``);
  await sql`UPDATE provider_configs SET ${setClause} WHERE provider = ${provider}`;
  invalidate(provider);
}

async function recordCheck(provider: string, ok: boolean, message: string) {
  await sql`
    INSERT INTO provider_configs (provider, last_check_at, last_check_ok, last_check_message)
    VALUES (${provider}, now(), ${ok}, ${message})
    ON CONFLICT (provider) DO UPDATE SET
      last_check_at = now(),
      last_check_ok = ${ok},
      last_check_message = ${message}
  `;
  invalidate(provider);
}

export interface TestResult {
  ok: boolean;
  message: string;
  /** 本次测试用的是界面上未保存的内容（不代表已生效） */
  usedDraft?: boolean;
}

/**
 * 连通性测试。
 * `overrides` 用于「界面上刚填、还没保存」的凭据 —— 这样用户填完就能直接测，
 * 不会因为「测试只认已保存的值」而误报缺少凭据。
 */
export async function testProvider(
  provider: string,
  overrides?: Credentials,
  userId?: string,
): Promise<TestResult> {
  const spec = getProviderSpec(provider);
  if (!spec) return { ok: false, message: "未知的模型供应商" };

  const adapter = getAdapter(provider);
  const runtime = await getProviderRuntime(provider);
  const savedCredentials = userId ? await getUserCredentials(provider, userId) : runtime.credentials;

  const draft = activeCredentials(overrides ?? {});
  const usedDraft = Object.keys(draft).length > 0;
  const credentials = usedDraft ? { ...savedCredentials, ...draft } : savedCredentials;

  let result: TestResult;
  if (!adapter) {
    result = {
      ok: false,
      usedDraft,
      message: "该供应商的适配器还未接入，凭据会先保存下来备用",
    };
  } else if (!hasAllCredentials(spec, credentials)) {
    result = {
      ok: false,
      usedDraft,
      message: `还缺少：${requiredCredentialFields(spec)
        .filter((field) => !credentials[field.key])
        .map((field) => field.label)
        .join("、")}`,
    };
  } else {
    const verify = await adapter.verify({
      provider,
      apiBase: runtime.apiBase,
      apiKey: credentials.apiKey ?? "",
      credentials,
    });
    result = { ...verify, usedDraft };
  }

  // 只用已保存的配置测试时才写入「上次检查结果」，避免用未保存的值污染记录
  if (!usedDraft && !userId) {
    await recordCheck(provider, result.ok, result.message).catch(() => {});
  }
  return result;
}
