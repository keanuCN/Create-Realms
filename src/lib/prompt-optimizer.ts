import { jsonb, sql } from "./db";
import { decryptSecret, encryptSecret, maskSecret } from "./secrets";

const CONFIG_KEY = "prompt_optimizer";
const DEFAULT_API_BASE = "https://api.deepseek.com";
const DEFAULT_MODEL = "deepseek-flash";

interface StoredConfig {
  apiKeyEnc?: string | null;
  apiBase?: string;
  model?: string;
}

export interface PromptOptimizerConfig {
  apiKey: string;
  apiBase: string;
  model: string;
}

export interface PromptOptimizerConfigView {
  configured: boolean;
  maskedKey: string | null;
  apiBase: string;
  model: string;
}

async function readStoredConfig(): Promise<StoredConfig> {
  const rows = await sql<{ value: unknown }[]>`
    SELECT value FROM system_status WHERE key = ${CONFIG_KEY} LIMIT 1
  `;
  const value = rows[0]?.value;
  if (typeof value === "string") {
    // Earlier writes stored the serialized object as a JSON string scalar.
    try {
      const parsed: unknown = JSON.parse(value);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as StoredConfig;
      }
    } catch {
      return {};
    }
  }
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as StoredConfig
    : {};
}

export async function getPromptOptimizerConfig(): Promise<PromptOptimizerConfig> {
  const stored = await readStoredConfig();
  return {
    apiKey: decryptSecret(stored.apiKeyEnc) ?? "",
    apiBase: (stored.apiBase || DEFAULT_API_BASE).replace(/\/+$/, ""),
    model: stored.model || DEFAULT_MODEL,
  };
}

export async function getPromptOptimizerConfigView(): Promise<PromptOptimizerConfigView> {
  const stored = await readStoredConfig();
  const key = decryptSecret(stored.apiKeyEnc);
  return {
    configured: Boolean(key),
    maskedKey: maskSecret(key),
    apiBase: (stored.apiBase || DEFAULT_API_BASE).replace(/\/+$/, ""),
    model: stored.model || DEFAULT_MODEL,
  };
}

export async function savePromptOptimizerConfig(input: {
  apiKey?: string;
  apiBase: string;
  model: string;
  clearKey?: boolean;
}): Promise<PromptOptimizerConfigView> {
  const existing = await readStoredConfig();
  const apiKey = input.clearKey ? null : input.apiKey?.trim();
  const apiKeyEnc = apiKey ? encryptSecret(apiKey) : input.clearKey ? null : existing.apiKeyEnc ?? null;
  const config: StoredConfig = {
    apiKeyEnc,
    apiBase: input.apiBase.replace(/\/+$/, ""),
    model: input.model,
  };

  await sql`
    INSERT INTO system_status (key, value, updated_at)
    VALUES (${CONFIG_KEY}, ${jsonb(config)}, now())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
  `;

  return {
    configured: Boolean(apiKeyEnc && decryptSecret(apiKeyEnc)),
    maskedKey: maskSecret(decryptSecret(apiKeyEnc)),
    apiBase: config.apiBase!,
    model: config.model!,
  };
}
