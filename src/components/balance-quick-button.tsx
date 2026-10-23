"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowRight, Coins, RefreshCw, X } from "lucide-react";
import { Button, cn } from "@/components/ui";
import { api } from "@/lib/client";

type ProviderId = "deepseek" | "pixverse";

interface ProviderEntry {
  id: ProviderId;
  label: string;
  configured: boolean;
}

interface DeepSeekResult {
  provider: "deepseek";
  isAvailable: boolean;
  balances: { currency: string; total: string; granted: string; toppedUp: string }[];
  checkedAt: string;
}

interface PixVerseResult {
  provider: "pixverse";
  balances: { monthly: number; package: number; total: number }[];
  checkedAt: string;
}

type BalanceResult = DeepSeekResult | PixVerseResult;

function money(value: string, currency: string) {
  const amount = Number(value);
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: currency === "CNY" ? "CNY" : "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
}

export function BalanceQuickButton() {
  const [open, setOpen] = useState(false);
  const [loadingList, setLoadingList] = useState(false);
  const [providers, setProviders] = useState<ProviderEntry[]>([]);
  const [results, setResults] = useState<Partial<Record<ProviderId, BalanceResult>>>({});
  const [errors, setErrors] = useState<Partial<Record<ProviderId, string>>>({});
  const [busy, setBusy] = useState<Partial<Record<ProviderId, boolean>>>({});
  const [listError, setListError] = useState("");

  async function query(provider: ProviderId) {
    setBusy((current) => ({ ...current, [provider]: true }));
    setErrors((current) => ({ ...current, [provider]: "" }));
    try {
      const result = await api<BalanceResult>("/api/account-balances", {
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
      setBusy((current) => ({ ...current, [provider]: false }));
    }
  }

  async function openAndQuery() {
    setOpen(true);
    setLoadingList(true);
    setListError("");
    try {
      const data = await api<{ items: ProviderEntry[] }>("/api/account-balances");
      const supported = data.items.filter((item) => item.id === "deepseek" || item.id === "pixverse");
      setProviders(supported);
      const ready = supported.filter((item) => item.configured);
      await Promise.all(ready.map((item) => query(item.id)));
    } catch (error) {
      setListError(error instanceof Error ? error.message : "读取余额状态失败");
    } finally {
      setLoadingList(false);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => (open ? setOpen(false) : void openAndQuery())}
        title="查询余额与积分"
        aria-label="查询余额与积分"
        aria-expanded={open}
        className={cn(
          "lift grid size-8 place-items-center rounded-lg border transition",
          open
            ? "border-[#7c6cff]/40 bg-[#7c6cff]/15 text-[#c5bcff]"
            : "border-white/12 bg-white/[0.06] text-slate-300 hover:border-[#7c6cff]/40 hover:text-white",
        )}
      >
        <Coins className="size-4" />
      </button>

      {open ? (
        <div className="absolute right-0 top-10 z-50 w-[min(340px,calc(100vw-32px))] rounded-2xl border border-white/10 bg-[#101722] p-3 shadow-2xl shadow-black/50">
          <div className="mb-2 flex items-center justify-between gap-3 px-1">
            <div>
              <p className="text-[13px] font-medium text-white">余额与积分</p>
              <p className="mt-0.5 text-[10px] text-slate-500">已配置账户的实时余额</p>
            </div>
            <div className="flex items-center gap-1">
              <Link
                href="/balances"
                title="查看所有供应商入口"
                className="rounded-md p-1.5 text-slate-500 hover:bg-white/[0.06] hover:text-white"
              >
                <ArrowRight className="size-3.5" />
              </Link>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="关闭余额面板"
                className="rounded-md p-1.5 text-slate-500 hover:bg-white/[0.06] hover:text-white"
              >
                <X className="size-3.5" />
              </button>
            </div>
          </div>

          {loadingList && providers.length === 0 ? (
            <div className="skeleton h-16 rounded-xl" />
          ) : listError ? (
            <p className="rounded-lg bg-rose-500/[0.08] px-3 py-2 text-[11px] text-rose-200">{listError}</p>
          ) : (
            <div className="space-y-2">
              {providers.map((provider) => {
                const result = results[provider.id];
                const isBusy = Boolean(busy[provider.id]);
                return (
                  <div key={provider.id} className="rounded-xl border border-white/[0.07] bg-black/10 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-medium text-slate-300">{provider.label}</p>
                        {!provider.configured ? (
                          <p className="mt-1 text-[10px] text-amber-300/80">
                            {provider.id === "deepseek" ? "管理员尚未配置共享 Key" : "请先配置个人 PixVerse Key"}
                          </p>
                        ) : provider.id === "deepseek" && result && "isAvailable" in result ? (
                          <div className="mt-1 space-y-0.5">
                            {result.balances.map((item) => (
                              <p key={item.currency} className="text-[12px] font-semibold tabular-nums text-white">
                                {money(item.total, item.currency)}
                                <span className="ml-1.5 text-[9px] font-normal text-slate-500">赠金 {money(item.granted, item.currency)}</span>
                              </p>
                            ))}
                            <p className="text-[9px] text-slate-600">
                              {result.isAvailable ? "账户可用" : "余额不足或账户不可用"} · {new Date(result.checkedAt).toLocaleTimeString("zh-CN")}
                            </p>
                          </div>
                        ) : provider.id === "pixverse" && result && "provider" in result && result.provider === "pixverse" ? (
                          <div className="mt-1">
                            <p className="text-[12px] font-semibold tabular-nums text-white">
                              {result.balances[0]?.total.toLocaleString("zh-CN") ?? 0} 积分
                            </p>
                            <p className="text-[9px] text-slate-600">
                              月度 {result.balances[0]?.monthly.toLocaleString("zh-CN") ?? 0} · 套餐 {result.balances[0]?.package.toLocaleString("zh-CN") ?? 0} · {new Date(result.checkedAt).toLocaleTimeString("zh-CN")}
                            </p>
                          </div>
                        ) : provider.configured ? (
                          <p className="mt-1 text-[10px] text-slate-500">点击右侧查询</p>
                        ) : null}
                        {errors[provider.id] ? (
                          <p className="mt-1 flex items-start gap-1 text-[10px] text-rose-300">
                            <AlertCircle className="mt-0.5 size-3 shrink-0" />
                            {errors[provider.id]}
                          </p>
                        ) : null}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 shrink-0 px-2"
                        disabled={!provider.configured || isBusy}
                        loading={isBusy}
                        title="刷新余额"
                        onClick={() => void query(provider.id)}
                      >
                        <RefreshCw className={cn("size-3.5", isBusy && "animate-spin")} />
                      </Button>
                    </div>
                  </div>
                );
              })}
              {!loadingList && providers.length === 0 ? (
                <p className="px-2 py-3 text-center text-[11px] text-slate-500">暂无可查询账户</p>
              ) : null}
            </div>
          )}

          <p className="mt-2 px-1 text-[9px] text-slate-600">仅展示 DeepSeek 与 PixVerse 的 API 余额；其他平台可从“余额与积分”页跳转控制台。</p>
        </div>
      ) : null}
    </div>
  );
}
