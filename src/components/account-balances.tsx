"use client";

import { useCallback, useEffect, useState } from "react";
import { Coins, ExternalLink, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Badge, Button, cn, useToast } from "@/components/ui";
import { api } from "@/lib/client";

interface BalanceProvider {
  id: string;
  label: string;
  scope: string;
  consoleUrl: string;
  querySupported: boolean;
  configured: boolean;
}

interface DeepSeekResult {
  isAvailable: boolean;
  balances: { currency: string; total: string; granted: string; toppedUp: string }[];
  checkedAt: string;
}

interface PixVerseResult {
  balances: { monthly: number; package: number; total: number }[];
  checkedAt: string;
}

type Result = DeepSeekResult | PixVerseResult;

function formatMoney(value: string, currency: string) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return `${value} ${currency}`;
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: currency === "CNY" ? "CNY" : "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export default function AccountBalances() {
  const { toast } = useToast();
  const [items, setItems] = useState<BalanceProvider[]>([]);
  const [results, setResults] = useState<Record<string, Result>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await api<{ items: BalanceProvider[] }>("/api/account-balances");
      setItems(data.items);
    } catch (error) {
      toast(error instanceof Error ? error.message : "加载余额入口失败", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function query(provider: "deepseek" | "pixverse") {
    setBusy(provider);
    setErrors((current) => ({ ...current, [provider]: "" }));
    try {
      const result = await api<Result>("/api/account-balances", {
        method: "POST",
        body: JSON.stringify({ provider }),
      });
      setResults((current) => ({ ...current, [provider]: result }));
    } catch (error) {
      setErrors((current) => ({
        ...current,
        [provider]: error instanceof Error ? error.message : "查询失败",
      }));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        eyebrow="ACCOUNT · BALANCE"
        title="余额与积分"
        description="集中查看已接入供应商的账户额度。支持 API 查询的项目会实时请求；其他平台可直接打开控制台查看。"
      />

      <div className="mb-5 flex items-start gap-3 rounded-2xl border border-sky-500/20 bg-sky-500/[0.05] p-4 text-[12px] leading-6 text-sky-100/80">
        <Coins className="mt-1 size-4 shrink-0 text-sky-300" />
        <p>余额对应各供应商账户：DeepSeek 使用全员共享的提示词优化 Key；PixVerse 使用你个人配置的 API Key。其他平台暂时没有可直接使用现有 API Key 查询余额的接口。</p>
      </div>

      {loading ? (
        <div className="skeleton h-40 rounded-2xl border border-white/5" />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {items.map((item) => {
            const result = results[item.id];
            const isBusy = busy === item.id;
            return (
              <article key={item.id} className="rounded-2xl border border-white/[0.07] bg-[#0e141d] p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-[14px] font-medium text-white">{item.label}</h2>
                      {item.querySupported ? (
                        <Badge tone={item.configured ? "success" : "warning"}>
                          {item.configured ? "可查询" : "未配置 Key"}
                        </Badge>
                      ) : (
                        <Badge>控制台查询</Badge>
                      )}
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500">{item.scope}</p>
                  </div>
                  <a
                    href={item.consoleUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex shrink-0 items-center gap-1 text-[11px] text-[#a99cff] hover:text-white"
                  >
                    控制台
                    <ExternalLink className="size-3" />
                  </a>
                </div>

                {item.id === "deepseek" && result && "isAvailable" in result ? (
                  <div className="mt-4 space-y-2">
                    {result.balances.length ? result.balances.map((balance) => (
                      <div key={balance.currency} className="rounded-xl border border-white/[0.06] bg-black/10 p-3">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-[11px] text-slate-400">可用余额</span>
                          <strong className="text-xl font-semibold tabular-nums text-white">
                            {formatMoney(balance.total, balance.currency)}
                          </strong>
                        </div>
                        <p className="mt-2 text-[11px] text-slate-500">
                          赠金 {formatMoney(balance.granted, balance.currency)} · 充值 {formatMoney(balance.toppedUp, balance.currency)}
                        </p>
                      </div>
                    )) : <p className="text-[12px] text-slate-400">账号暂未返回余额项目</p>}
                    <p className="text-right text-[10px] text-slate-600">
                      {result.isAvailable ? "账户可正常调用" : "余额不足或账户暂不可用"} · {new Date(result.checkedAt).toLocaleString("zh-CN")}
                    </p>
                  </div>
                ) : null}

                {item.id === "pixverse" && result && "balances" in result && result.balances[0] && "monthly" in result.balances[0] ? (
                  <div className="mt-4 rounded-xl border border-white/[0.06] bg-black/10 p-3">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-[11px] text-slate-400">可用积分</span>
                      <strong className="text-xl font-semibold tabular-nums text-white">
                        {result.balances[0].total.toLocaleString("zh-CN")}
                      </strong>
                    </div>
                    <p className="mt-2 text-[11px] text-slate-500">
                      月度积分 {result.balances[0].monthly.toLocaleString("zh-CN")} · 套餐积分 {result.balances[0].package.toLocaleString("zh-CN")}
                    </p>
                    <p className="mt-1 text-right text-[10px] text-slate-600">
                      {new Date(result.checkedAt).toLocaleString("zh-CN")}
                    </p>
                  </div>
                ) : null}

                {errors[item.id] ? (
                  <p className="mt-3 rounded-lg border border-rose-500/20 bg-rose-500/[0.06] px-3 py-2 text-[11px] text-rose-200">
                    {errors[item.id]}
                  </p>
                ) : null}

                <div className="mt-4 flex justify-end">
                  {item.querySupported ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      loading={isBusy}
                      disabled={!item.configured || Boolean(busy)}
                      onClick={() => void query(item.id as "deepseek" | "pixverse")}
                    >
                      <RefreshCw className={cn("size-3.5", isBusy && "animate-spin")} />
                      {result ? "刷新余额" : "查询余额"}
                    </Button>
                  ) : (
                    <span className="self-center text-[10px] text-slate-600">余额查询请以平台控制台为准</span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
