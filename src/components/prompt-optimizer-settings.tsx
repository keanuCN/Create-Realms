"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff, Save, ShieldCheck } from "lucide-react";
import { Badge, Button, Input, useToast } from "@/components/ui";
import { api } from "@/lib/client";

interface ConfigView {
  configured: boolean;
  maskedKey: string | null;
  apiBase: string;
  model: string;
}

const DEFAULT_CONFIG: ConfigView = {
  configured: false,
  maskedKey: null,
  apiBase: "https://api.deepseek.com",
  model: "deepseek-flash",
};

export default function PromptOptimizerSettings() {
  const { toast } = useToast();
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api<ConfigView>("/api/admin/prompt-optimizer")
      .then(setConfig)
      .catch((error) => toast(error instanceof Error ? error.message : "读取配置失败", "error"))
      .finally(() => setLoading(false));
  }, [toast]);

  async function save() {
    setSaving(true);
    try {
      const saved = await api<ConfigView>("/api/admin/prompt-optimizer", {
        method: "PUT",
        body: JSON.stringify({
          apiKey: apiKey.trim() || undefined,
          apiBase: config.apiBase,
          model: config.model,
        }),
      });
      setConfig(saved);
      setApiKey("");
      toast("团队提示词优化配置已保存", "success");
    } catch (error) {
      toast(error instanceof Error ? error.message : "保存失败", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mb-5 rounded-2xl border border-[#7c6cff]/20 bg-[#7c6cff]/[0.04] p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-[15px] font-medium text-white">团队提示词优化</h2>
            {config.configured ? <Badge tone="success">已配置</Badge> : <Badge tone="warning">待填写 Key</Badge>}
          </div>
          <p className="mt-1 max-w-2xl text-[12px] leading-5 text-slate-400">
            全体成员共用此 DeepSeek 配置。API Key 加密保存，只显示掩码；接口地址和模型已预设，也可按需修改。
          </p>
        </div>
        <ShieldCheck className="size-4 text-[#a99cff]" />
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <label className="space-y-1.5">
          <span className="text-[12px] text-slate-400">DeepSeek API Key</span>
          <span className="relative block">
            <Input
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder={config.maskedKey || "粘贴 DeepSeek API Key"}
              autoComplete="new-password"
              disabled={loading || saving}
              className="pr-10 font-mono text-[12px]"
            />
            <button
              type="button"
              onClick={() => setShowKey((value) => !value)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-500 hover:text-slate-300"
              aria-label={showKey ? "隐藏 API Key" : "显示 API Key"}
            >
              {showKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </span>
          <span className="block text-[11px] text-slate-500">
            {config.configured ? `当前：${config.maskedKey}（留空保留）` : "尚未配置，保存前请填写 Key"}
          </span>
        </label>
        <label className="space-y-1.5">
          <span className="text-[12px] text-slate-400">接口地址</span>
          <Input
            value={config.apiBase}
            onChange={(event) => setConfig((value) => ({ ...value, apiBase: event.target.value }))}
            disabled={loading || saving}
            className="font-mono text-[12px]"
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-[12px] text-slate-400">优化模型</span>
          <Input
            value={config.model}
            onChange={(event) => setConfig((value) => ({ ...value, model: event.target.value }))}
            disabled={loading || saving}
            className="font-mono text-[12px]"
          />
        </label>
      </div>

      <div className="mt-4 flex justify-end">
        <Button size="sm" loading={saving} disabled={loading} onClick={() => void save()}>
          <Save className="size-3.5" />
          保存共享配置
        </Button>
      </div>
    </section>
  );
}
