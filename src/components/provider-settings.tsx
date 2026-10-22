"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Eye,
  EyeOff,
  Loader2,
  Plug,
  Save,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { Badge, Button, Input, cn, useToast } from "@/components/ui";
import { api } from "@/lib/client";

interface ProviderView {
  id: string;
  label: string;
  vendor: string;
  status: "ready" | "planned";
  capability: string;
  defaultBase: string;
  docsUrl: string;
  keyPlaceholder: string;
  note: string;
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

interface Draft {
  apiKey: string;
  apiBase: string;
  enabled: boolean;
  showKey: boolean;
}

export default function ProviderSettings() {
  const { toast } = useToast();
  const [items, setItems] = useState<ProviderView[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const applyItems = useCallback((list: ProviderView[]) => {
    setItems(list);
    setDrafts((prev) => {
      const next: Record<string, Draft> = {};
      for (const item of list) {
        next[item.id] = prev[item.id]
          ? { ...prev[item.id], apiBase: item.apiBase, enabled: item.enabled }
          : { apiKey: "", apiBase: item.apiBase, enabled: item.enabled, showKey: false };
      }
      return next;
    });
  }, []);

  const load = useCallback(async () => {
    try {
      const data = await api<{ items: ProviderView[] }>("/api/admin/providers");
      applyItems(data.items);
    } catch (error) {
      toast(error instanceof Error ? error.message : "加载失败", "error");
    } finally {
      setLoading(false);
    }
  }, [applyItems, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  function update(id: string, patch: Partial<Draft>) {
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  async function save(item: ProviderView) {
    const draft = drafts[item.id];
    if (!draft) return;
    setBusy(item.id);
    try {
      const data = await api<{ items: ProviderView[] }>(
        `/api/admin/providers/${item.id}`,
        {
          method: "PUT",
          body: JSON.stringify({
            apiKey: draft.apiKey.trim() ? draft.apiKey.trim() : undefined,
            apiBase: draft.apiBase.trim(),
            enabled: draft.enabled,
          }),
        },
      );
      applyItems(data.items);
      toast(`${item.label} 配置已保存，立即生效`, "success");
    } catch (error) {
      toast(error instanceof Error ? error.message : "保存失败", "error");
    } finally {
      setBusy(null);
    }
  }

  async function clearKey(item: ProviderView) {
    if (!confirm(`确定清除 ${item.label} 的 API Key？清除后将无法再调用该供应商。`)) return;
    setBusy(item.id);
    try {
      const data = await api<{ items: ProviderView[] }>(
        `/api/admin/providers/${item.id}`,
        { method: "PUT", body: JSON.stringify({ apiKey: "" }) },
      );
      applyItems(data.items);
      toast("已清除该 Key", "success");
    } catch (error) {
      toast(error instanceof Error ? error.message : "清除失败", "error");
    } finally {
      setBusy(null);
    }
  }

  async function test(item: ProviderView) {
    setBusy(item.id);
    try {
      const result = await api<{ ok: boolean; message: string }>(
        `/api/admin/providers/${item.id}/test`,
        { method: "POST" },
      );
      toast(result.message, result.ok ? "success" : "error");
      await load();
    } catch (error) {
      toast(error instanceof Error ? error.message : "测试失败", "error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-5">
        <p className="text-xs font-medium tracking-wider text-[#a99cff]">ADMIN</p>
        <h1 className="mt-1 text-2xl font-semibold text-white">模型设置</h1>
        <p className="mt-1 text-sm text-slate-500">
          在这里填写各家模型的 API Key，保存后立刻生效，不用改配置文件、也不用重启服务。
        </p>
      </header>

      <div className="mb-5 flex items-start gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] p-4">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-300" />
        <div className="text-[12px] leading-6 text-emerald-100/80">
          Key 使用 AES-256-GCM 加密后存入数据库，页面上只展示掩码（如
          <span className="mx-1 font-mono">sk-cp-••••••••abcd</span>），任何人都无法在界面上看到完整 Key。
          请妥善保管服务器上的 <span className="font-mono">APP_SECRET</span>，它是解密凭据。
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-40 animate-pulse rounded-2xl bg-white/[0.03]" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const draft = drafts[item.id];
            if (!draft) return null;
            const isBusy = busy === item.id;
            const active = item.configured && item.enabled;

            return (
              <article
                key={item.id}
                className={cn(
                  "rounded-2xl border p-4 transition sm:p-5",
                  active
                    ? "border-[#7c6cff]/25 bg-[#7c6cff]/[0.04]"
                    : "border-white/[0.07] bg-[#0e141d]",
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-[15px] font-medium text-white">{item.label}</h2>
                      {item.status === "ready" ? (
                        <Badge tone="brand">已接入</Badge>
                      ) : (
                        <Badge>待接入</Badge>
                      )}
                      {active ? (
                        <Badge tone="success">
                          <CheckCircle2 className="size-3" />
                          使用中
                        </Badge>
                      ) : item.configured ? (
                        <Badge tone="warning">已停用</Badge>
                      ) : (
                        <Badge tone="danger">未配置</Badge>
                      )}
                    </div>
                    <p className="mt-1 text-[12px] text-slate-500">
                      {item.vendor} · 支持 {item.capability}
                    </p>
                  </div>

                  <a
                    href={item.docsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[12px] text-[#a99cff] hover:text-white"
                  >
                    获取 Key
                    <ExternalLink className="size-3" />
                  </a>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-[12px] text-slate-400">API Key</label>
                    <div className="relative">
                      <Input
                        type={draft.showKey ? "text" : "password"}
                        value={draft.apiKey}
                        onChange={(event) => update(item.id, { apiKey: event.target.value })}
                        placeholder={item.maskedKey || item.keyPlaceholder}
                        autoComplete="off"
                        className="pr-10 font-mono text-[12px]"
                      />
                      <button
                        type="button"
                        onClick={() => update(item.id, { showKey: !draft.showKey })}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-500 hover:text-slate-300"
                        aria-label={draft.showKey ? "隐藏" : "显示"}
                      >
                        {draft.showKey ? (
                          <EyeOff className="size-4" />
                        ) : (
                          <Eye className="size-4" />
                        )}
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      {item.configured
                        ? `当前：${item.maskedKey}（留空表示不修改）`
                        : "尚未配置，粘贴完整 Key 后保存"}
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[12px] text-slate-400">Base URL</label>
                    <Input
                      value={draft.apiBase}
                      onChange={(event) => update(item.id, { apiBase: event.target.value })}
                      placeholder={item.defaultBase}
                      className="font-mono text-[12px]"
                    />
                    <p className="text-[11px] text-slate-500">{item.note}</p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <label className="flex cursor-pointer items-center gap-2 text-[12px] text-slate-400">
                    <input
                      type="checkbox"
                      checked={draft.enabled}
                      onChange={(event) => update(item.id, { enabled: event.target.checked })}
                      className="size-4 accent-[#7c6cff]"
                    />
                    启用该供应商
                  </label>

                  <div className="ml-auto flex flex-wrap items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      loading={isBusy}
                      onClick={() => void test(item)}
                    >
                      <Plug className="size-3.5" />
                      测试连接
                    </Button>
                    {item.configured ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={isBusy}
                        onClick={() => void clearKey(item)}
                      >
                        <Trash2 className="size-3.5" />
                        清除
                      </Button>
                    ) : null}
                    <Button size="sm" loading={isBusy} onClick={() => void save(item)}>
                      <Save className="size-3.5" />
                      保存
                    </Button>
                  </div>
                </div>

                {item.lastCheckAt ? (
                  <div
                    className={cn(
                      "mt-3 flex items-start gap-2 rounded-lg border px-3 py-2 text-[11px] leading-5",
                      item.lastCheckOk
                        ? "border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-100/80"
                        : "border-rose-500/20 bg-rose-500/[0.06] text-rose-100/80",
                    )}
                  >
                    {item.lastCheckOk ? (
                      <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" />
                    ) : (
                      <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
                    )}
                    <span>
                      {new Date(item.lastCheckAt).toLocaleString("zh-CN")}：
                      {item.lastCheckMessage}
                    </span>
                  </div>
                ) : null}

                {isBusy ? (
                  <p className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-500">
                    <Loader2 className="size-3 animate-spin" />
                    处理中…
                  </p>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}