import { randomUUID } from "node:crypto";
import { z } from "zod";
import { fail, handleApiError, ok, requireApiUser, ApiError } from "@/lib/http";
import { getPromptOptimizerConfig } from "@/lib/prompt-optimizer";
import { getAdapterContext, getProviderRuntime } from "@/lib/providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const providers = [
  { id: "deepseek", label: "DeepSeek", scope: "团队共享 Key", consoleUrl: "https://platform.deepseek.com/usage" },
  { id: "pixverse", label: "PixVerse", scope: "个人 API Key", consoleUrl: "https://platform.pixverse.ai/billing" },
  { id: "minimax", label: "MiniMax 海螺", scope: "个人供应商账户", consoleUrl: "https://platform.minimaxi.com/" },
  { id: "volcengine-ark", label: "火山方舟", scope: "个人供应商账户", consoleUrl: "https://console.volcengine.com/ark" },
  { id: "kling", label: "可灵 AI", scope: "个人供应商账户", consoleUrl: "https://klingai.com/dev/api-key" },
  { id: "vidu", label: "生数科技 Vidu", scope: "个人供应商账户", consoleUrl: "https://platform.vidu.cn/credit-balance" },
  { id: "dashscope", label: "阿里云百炼", scope: "个人供应商账户", consoleUrl: "https://bailian.console.aliyun.com/" },
  { id: "openai", label: "OpenAI", scope: "个人供应商账户", consoleUrl: "https://platform.openai.com/usage" },
  { id: "google", label: "Google Gemini", scope: "个人供应商账户", consoleUrl: "https://aistudio.google.com/usage" },
] as const;

export async function GET() {
  try {
    const user = await requireApiUser();
    const [optimizer, pixverse] = await Promise.all([
      getPromptOptimizerConfig(),
      getAdapterContext("pixverse", user.id),
    ]);
    return ok({
      items: providers.map((provider) => ({
        ...provider,
        querySupported: provider.id === "deepseek" || provider.id === "pixverse",
        configured:
          provider.id === "deepseek"
            ? Boolean(optimizer.apiKey)
            : provider.id === "pixverse"
              ? Boolean(pixverse.apiKey)
              : false,
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

interface DeepSeekBalanceResponse {
  is_available?: boolean;
  balance_infos?: {
    currency?: string;
    total_balance?: string;
    granted_balance?: string;
    topped_up_balance?: string;
  }[];
  error?: { message?: string };
}

interface PixVerseBalanceResponse {
  ErrCode?: number;
  ErrMsg?: string;
  Resp?: {
    credit_monthly?: number;
    credit_package?: number;
  };
}

export async function POST(req: Request) {
  try {
    const user = await requireApiUser();
    const parsed = z.object({ provider: z.enum(["deepseek", "pixverse"]) }).safeParse(
      await req.json().catch(() => null),
    );
    if (!parsed.success) throw new ApiError("暂不支持查询该供应商的 API 余额", 400);

    if (parsed.data.provider === "deepseek") {
      const config = await getPromptOptimizerConfig();
      if (!config.apiKey) throw new ApiError("管理员尚未配置团队 DeepSeek Key", 503);
      const response = await fetch(`${config.apiBase}/user/balance`, {
        headers: { Accept: "application/json", Authorization: `Bearer ${config.apiKey}` },
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
      const data = (await response.json().catch(() => null)) as DeepSeekBalanceResponse | null;
      if (!response.ok) {
        throw new ApiError(data?.error?.message || `DeepSeek 查询失败（HTTP ${response.status}）`, 502);
      }
      return ok({
        provider: "deepseek",
        isAvailable: Boolean(data?.is_available),
        balances: (data?.balance_infos ?? []).map((item) => ({
          currency: item.currency || "",
          total: item.total_balance || "0",
          granted: item.granted_balance || "0",
          toppedUp: item.topped_up_balance || "0",
        })),
        checkedAt: new Date().toISOString(),
      });
    }

    const [runtime, context] = await Promise.all([
      getProviderRuntime("pixverse"),
      getAdapterContext("pixverse", user.id),
    ]);
    if (!context.apiKey) throw new ApiError("请先到「我的模型 Key」配置 PixVerse API Key", 503);
    const response = await fetch(`${runtime.apiBase}/openapi/v2/account/balance`, {
      headers: { "API-KEY": context.apiKey, "ai-trace-id": randomUUID() },
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    const data = (await response.json().catch(() => null)) as PixVerseBalanceResponse | null;
    if (!response.ok || data?.ErrCode !== 0 || !data.Resp) {
      throw new ApiError(data?.ErrMsg || `PixVerse 查询失败（HTTP ${response.status}）`, 502);
    }
    const monthly = Number(data.Resp.credit_monthly ?? 0);
    const packageCredits = Number(data.Resp.credit_package ?? 0);
    return ok({
      provider: "pixverse",
      balances: [{ monthly, package: packageCredits, total: monthly + packageCredits }],
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof ApiError) return fail(error.message, error.status);
    return handleApiError(error);
  }
}
