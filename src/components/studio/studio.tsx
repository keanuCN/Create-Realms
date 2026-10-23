"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  BookOpen,
  ChevronRight,
  Clapperboard,
  Image as ImageIcon,
  Sparkles,
  Wand2,
} from "lucide-react";
import { AssetCard, AssetViewer } from "@/components/asset-card";
import { BalanceQuickButton } from "@/components/balance-quick-button";
import { ImageDrop, MultiImageDrop, type UploadedImage } from "@/components/studio/image-drop";
import {
  Badge,
  Button,
  Chip,
  EmptyState,
  Field,
  Modal,
  RangeSlider,
  Segmented,
  Switch,
  Textarea,
  cn,
  useToast,
} from "@/components/ui";
import { api } from "@/lib/client";
import {
  MODELS,
  PRICING_AS_OF,
  durationOptions,
  estimateCost,
  getModel,
  modelsFor,
  priceTable,
  priceTag,
  providerLabel,
  providersForModality,
} from "@/lib/models";
import { providerColor } from "@/lib/provider-colors";
import type { AssetWithUser, PromptTemplate } from "@/lib/types";

type Tab = "video" | "image";

function StatPill({ label, value }: { label: string; value: number }) {
  return (
    <span className="studio-stat inline-flex items-center gap-1 rounded-full border px-2 py-0.5">
      <span className="font-semibold tabular-nums text-slate-200">{value}</span>
      <span>{label}</span>
    </span>
  );
}

export default function Studio({ displayName }: { displayName: string }) {
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>("video");
  const [provider, setProvider] = useState("minimax");
  const [modelId, setModelId] = useState("MiniMax-H3-Max");
  const [prompt, setPrompt] = useState("");
  const [optimizingPrompt, setOptimizingPrompt] = useState(false);
  const [resolution, setResolution] = useState("768P");
  const [duration, setDuration] = useState(5);
  const [ratio, setRatio] = useState("16:9");
  const [firstFrame, setFirstFrame] = useState<UploadedImage | null>(null);
  const [lastFrame, setLastFrame] = useState<UploadedImage | null>(null);
  const [count, setCount] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  // 视频专用
  const [videoCount, setVideoCount] = useState(1);
  const [audioOn, setAudioOn] = useState(true);
  const [references, setReferences] = useState<UploadedImage[]>([]);
  const [inputMode, setInputMode] = useState<"text" | "first" | "firstLast" | "reference">("text");

  const [recent, setRecent] = useState<AssetWithUser[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(true);
  const [viewer, setViewer] = useState<AssetWithUser | null>(null);

  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [providerReady, setProviderReady] = useState<Record<string, boolean>>({});
  const [stats, setStats] = useState({ assets: 0, providers: 0 });

  const model = getModel(modelId) ?? modelsFor(tab, provider)[0];
  const modelOptions = modelsFor(tab, provider);
  const providerOptions = providersForModality(tab);
  const resolutionOptions =
    model.id === "grok-imagine-video-1.5" && inputMode === "reference"
      ? (model.resolutions ?? []).filter((item) => item !== "1080p")
      : model.resolutions ?? [];
  const currentReady = providerReady[provider] !== false;

  useEffect(() => {
    api<{
      items: {
        id: string;
        status: "ready" | "planned";
        configured: boolean;
        enabled: boolean;
      }[];
    }>("/api/my/providers")
      .then((data) => {
        const map: Record<string, boolean> = {};
        for (const item of data.items ?? []) {
          map[item.id] = item.configured && item.enabled && item.status === "ready";
        }
        setProviderReady(map);
        setStats((prev) => ({
          ...prev,
          providers: Object.values(map).filter(Boolean).length,
        }));
      })
      .catch(() => {});
  }, [tab]);

  useEffect(() => {
    api<{ total: number }>("/api/assets?limit=1")
      .then((data) => setStats((prev) => ({ ...prev, assets: data.total ?? 0 })))
      .catch(() => {});
  }, []);

  const loadRecent = useCallback(async () => {
    try {
      const data = await api<{ items: AssetWithUser[] }>("/api/assets?scope=mine&limit=6");
      setRecent(data.items);
    } catch {
      // ignore transient errors during polling
    } finally {
      setLoadingRecent(false);
    }
  }, []);

  useEffect(() => {
    void loadRecent();
  }, [loadRecent]);

  const activeJobs = recent.some(
    (item) => item.status === "pending" || item.status === "running",
  );

  useEffect(() => {
    if (!activeJobs) return;
    const timer = setInterval(() => void loadRecent(), 3000);
    return () => clearInterval(timer);
  }, [activeJobs, loadRecent]);

  function applyModelDefaults(spec: ReturnType<typeof getModel>) {
    if (!spec) return;
    if (spec.defaultResolution) setResolution(spec.defaultResolution);
    if (spec.defaultDuration) setDuration(spec.defaultDuration);
    if (spec.defaultRatio) setRatio(spec.defaultRatio);
    setAudioOn(spec.audioDefault ?? false);
    setVideoCount(1);
    setReferences([]);
    setFirstFrame(null);
    setLastFrame(null);
    setInputMode("text");
  }

  function switchTab(next: Tab) {
    setTab(next);
    const firstProvider = providersForModality(next)[0];
    const firstModel = modelsFor(next, firstProvider)[0];
    setProvider(firstProvider);
    setModelId(firstModel.id);
    applyModelDefaults(firstModel);
    setCount(1);
  }

  function pickProvider(next: string) {
    const first = modelsFor(tab, next)[0];
    if (!first) return;
    setProvider(next);
    setModelId(first.id);
    applyModelDefaults(first);
  }

  function pickModel(id: string) {
    const spec = getModel(id);
    if (!spec) return;
    setModelId(id);
    if (spec.defaultResolution) setResolution(spec.defaultResolution);
    if (spec.defaultDuration) setDuration(spec.defaultDuration);
    if (spec.defaultRatio) setRatio(spec.defaultRatio);
    if (spec.supportsAudio) setAudioOn(spec.audioDefault ?? false);
    setVideoCount(1);
    if (!spec.supportsLastFrame) setLastFrame(null);
    if (!spec.supportsReferenceImages) setReferences([]);
    else if (spec.maxReferenceImages)
      setReferences((prev) => prev.slice(0, spec.maxReferenceImages));
  }

  async function openTemplates() {
    setTemplatesOpen(true);
    setTemplatesLoading(true);
    try {
      const data = await api<{ items: PromptTemplate[] }>(
        `/api/prompts?scope=shared&kind=${tab}`,
      );
      setTemplates(data.items);
    } catch (error) {
      toast(error instanceof Error ? error.message : "加载失败", "error");
    } finally {
      setTemplatesLoading(false);
    }
  }

  async function useTemplate(item: PromptTemplate) {
    setPrompt(item.content);
    setTemplatesOpen(false);
    void api(`/api/prompts/${item.id}/use`, { method: "POST" }).catch(() => {});
    toast("已填入提示词", "success");
  }

  async function submit() {
    if (!prompt.trim()) {
      toast("先写点提示词吧", "error");
      return;
    }
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> =
        tab === "video"
          ? {
              kind: "video",
              model: modelId,
              prompt,
              resolution,
              duration,
              n: videoCount,
              ...(model.supportsAudio ? { audio: audioOn } : {}),
              ...(model.supportsPromptOptimizer
                ? modelId === "MiniMax-H3-Max"
                  ? {
                      promptExpansion: "balanced",
                      promptOptimizer: true,
                    }
                  : { promptOptimizer: true }
                : {}),
              ...(firstFrame || lastFrame
                ? {
                    firstFrameUploadId: firstFrame?.id,
                    lastFrameUploadId: lastFrame?.id,
                  }
                : references.length
                  ? { referenceUploadIds: references.map((item) => item.id) }
                  : { ratio }),
            }
          : {
              kind: "image",
              model: modelId,
              prompt,
              ratio,
              n: count,
              promptOptimizer: true,
              ...(model.resolutions?.length ? { resolution } : {}),
            };

      const result = await api<{ assets?: { id: string }[] }>("/api/generate", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const created = result.assets?.length ?? 1;
      toast(
        tab === "video" && created > 1
          ? `已提交 ${created} 条视频任务，正在排队生成`
          : "任务已提交，正在排队生成",
        "success",
      );
      setFirstFrame(null);
      setLastFrame(null);
      setReferences([]);
      await loadRecent();
    } catch (error) {
      toast(error instanceof Error ? error.message : "提交失败", "error");
    } finally {
      setSubmitting(false);
    }
  }

  const charLimit = model.maxPrompt;

  async function optimizePrompt() {
    const source = prompt.trim();
    if (!source) {
      toast("先写点提示词吧", "error");
      return;
    }

    setOptimizingPrompt(true);
    try {
      const result = await api<{ prompt: string }>("/api/prompts/optimize", {
        method: "POST",
        body: JSON.stringify({ kind: tab, model: model.id, prompt: source }),
      });
      setPrompt(result.prompt);
      toast("提示词已优化并替换原文", "success");
    } catch (error) {
      toast(error instanceof Error ? error.message : "提示词优化失败", "error");
    } finally {
      setOptimizingPrompt(false);
    }
  }
  const withFrames = Boolean(firstFrame || lastFrame);
  const ratios = model.ratios ?? ["16:9"];
  const durationChoices =
    model.id === "veo-3.1-generate-001" && references.length
      ? [8]
      : durationOptions(model);
  const cost = estimateCost(model, {
    resolution,
    duration: tab === "video" ? duration : undefined,
    count: tab === "video" ? videoCount : count,
    audio: tab === "video" ? audioOn : undefined,
  });

  /** 操作条：宽屏钉在表单底部，窄屏浮动在视口底部，保证提交按钮永远可见 */
  const actionBar = (
    <>
      <div className="mb-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-400">
        <span className="font-medium text-slate-200">{model.label}</span>
        <span className="text-slate-600">·</span>
        <span>{resolution}</span>
        {tab === "video" ? (
          <>
            <span className="text-slate-600">·</span>
            <span>{duration} 秒</span>
            <span className="text-slate-600">·</span>
            <span>{videoCount} 条</span>
            {model.supportsAudio ? (
              <>
                <span className="text-slate-600">·</span>
                <span className={audioOn ? "text-emerald-300" : "text-slate-500"}>
                  {audioOn ? "有声" : "无声"}
                </span>
              </>
            ) : null}
            {references.length ? (
              <>
                <span className="text-slate-600">·</span>
                <span>参考图 {references.length} 张</span>
              </>
            ) : withFrames ? (
              <>
                <span className="text-slate-600">·</span>
                <span>{lastFrame ? "首尾帧" : "首帧"}</span>
              </>
            ) : (
              <>
                <span className="text-slate-600">·</span>
                <span>{ratio}</span>
              </>
            )}
          </>
        ) : (
          <>
            <span className="text-slate-600">·</span>
            <span>{ratio}</span>
            <span className="text-slate-600">·</span>
            <span>{count} 张</span>
          </>
        )}
        <span className="text-slate-600">·</span>
        <span
          className="tip cursor-help rounded-md border border-white/10 bg-white/[0.05] px-1.5 py-0.5 font-medium tabular-nums text-slate-200"
          data-tip={`${cost.detail}${cost.note ? `\n${cost.note}` : ""}\n价格调研于 ${PRICING_AS_OF}，以平台控制台为准`}
        >
          预计 {cost.text}
        </span>
      </div>

      <Button
        size="lg"
        className="w-full"
        loading={submitting}
        onClick={submit}
        disabled={!prompt.trim() || !currentReady || model.availability === "coming-soon"}
      >
        <Sparkles className="size-4" />
        {tab === "video"
          ? `生成视频 · ${duration} 秒${videoCount > 1 ? ` × ${videoCount}` : ""}`
          : `生成图片 · ${count} 张`}
      </Button>

      <p className="mt-2 text-center text-[11px] text-slate-600 lg:block">
        {tab === "video"
          ? "视频通常需要 1–3 分钟，可以先去做别的事"
          : "图片通常需要 10–30 秒"}
      </p>
    </>
  );

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col pb-32 lg:h-[var(--studio-h)] lg:min-h-0 lg:pb-0">
      {/* 紧凑头部：一行放下问候、统计与入口 */}
      <header className="studio-welcome mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
          <h1 className="text-xl font-semibold tracking-tight text-white">
            嗨，{displayName}，<span className="gradient-text">想做点什么？</span>
          </h1>
          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <StatPill label="我的作品" value={stats.assets} />
            <StatPill label="在用供应商" value={stats.providers} />
            <StatPill
              label="可用模型"
              value={MODELS.filter((entry) => entry.availability !== "coming-soon").length}
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <BalanceQuickButton />
          <Link
            href="/guide"
            className="lift inline-flex h-8 items-center gap-1 rounded-lg border border-white/12 bg-white/[0.06] px-3 text-[13px] text-slate-200 backdrop-blur transition hover:border-[#7c6cff]/40 hover:text-white"
          >
            <BookOpen className="size-3.5" />
            提示词教程
          </Link>
          <Button variant="secondary" size="sm" onClick={openTemplates}>
            <BookOpen className="size-3.5" />
            提示词模板
          </Button>
          <Link
            href="/library"
            className="lift inline-flex h-8 items-center gap-1 rounded-lg border border-white/12 bg-white/[0.06] px-3 text-[13px] text-slate-200 backdrop-blur transition hover:border-[#7c6cff]/40 hover:text-white"
          >
            作品库
            <ChevronRight className="size-3.5" />
          </Link>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 items-stretch gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <section className="panel flex min-h-0 flex-col">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 pr-3">
          <div className="mb-1">
            <Segmented
              value={tab}
              onChange={(next) => switchTab(next)}
              options={[
                {
                  value: "video",
                  label: (
                    <>
                      <Clapperboard className="size-4" />
                      视频生成
                    </>
                  ),
                },
                {
                  value: "image",
                  label: (
                    <>
                      <ImageIcon className="size-4" />
                      图片生成
                    </>
                  ),
                },
              ]}
            />
          </div>

          <div className="space-y-5">
            <div className="space-y-2">
              <span className="text-[13px] font-medium text-slate-300">模型供应商</span>
              <div className="flex flex-wrap gap-1.5">
                {providerOptions.map((item) => {
                  const ready = providerReady[item] !== false;
                  const active = provider === item;
                  const color = providerColor(item);
                  return (
                    <button
                      key={item}
                      data-active={active}
                      onClick={() => pickProvider(item)}
                      className={cn(
                        "studio-choice lift flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px]",
                        active
                          ? "text-white"
                          : "border-white/10 bg-white/[0.03] text-slate-400 hover:text-slate-200",
                      )}
                      style={
                        active
                          ? {
                              borderColor: color.from,
                              background: "var(--brand)",
                              boxShadow: `0 8px 22px -12px ${color.from}`,
                            }
                          : undefined
                      }
                    >
                      <span
                        className="provider-dot"
                        style={{
                          background: ready ? color.from : "#475569",
                          color: ready ? color.from : "transparent",
                        }}
                      />
                      {providerLabel(item)}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-[13px] font-medium text-slate-300">模型</span>
              <div className="flex flex-wrap gap-1.5">
                {modelOptions.map((item) => {
                  const active = modelId === item.id;
                  const unavailable = item.availability === "coming-soon";
                  const color = providerColor(item.provider);
                  const tag = priceTag(item, item.defaultResolution);
                  const table = priceTable(item);
                  return (
                    <button
                      key={item.id}
                      data-active={active && !unavailable}
                      onClick={() => pickModel(item.id)}
                      disabled={unavailable}
                      data-tip={
                        table.length
                          ? `${item.tagline}\n参考单价：${table.join(" · ")}\n（${PRICING_AS_OF} 调研，以控制台为准）`
                          : `${item.tagline}\n参考单价：见控制台`
                      }
                      className={cn(
                        "studio-choice tip lift flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px] font-medium",
                        unavailable
                          ? "cursor-not-allowed border-white/[0.05] bg-white/[0.015] text-slate-600 opacity-60"
                          : active
                          ? "text-white"
                          : "border-white/10 bg-white/[0.03] text-slate-400 hover:text-slate-200",
                      )}
                      style={
                        active && !unavailable
                          ? {
                              borderColor: color.from,
                              background: "var(--brand)",
                              boxShadow: `0 8px 20px -12px ${color.from}`,
                            }
                          : undefined
                      }
                    >
                      <span
                        className="provider-dot"
                        style={{ background: unavailable ? "#475569" : color.from, color: unavailable ? "#475569" : color.from }}
                      />
                      {item.label}
                      {item.badge ? (
                        <span className={cn(
                          "rounded-full px-1.5 py-px text-[10px]",
                          unavailable
                            ? "bg-slate-700/50 text-slate-500"
                            : "bg-[#7c6cff]/25 text-[#c9c2ff]",
                        )}>
                          {unavailable ? "暂未开放" : item.badge}
                        </span>
                      ) : null}
                      {tag ? (
                        <span
                          className={cn(
                            "rounded-full px-1.5 py-px text-[10px] font-normal tabular-nums",
                            active
                              ? "bg-white/20 text-white"
                              : "bg-white/[0.06] text-slate-400",
                          )}
                        >
                          {tag}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
              {model.note ? (
                <p className="text-[11px] leading-5 text-slate-500">{model.note}</p>
              ) : null}
              {!currentReady ? (
                <p className="rounded-lg border border-amber-500/25 bg-amber-500/[0.08] px-3 py-2 text-[11px] leading-5 text-amber-200">
                  {providerLabel(provider)} 还没有配置凭据，请联系管理员到「模型设置」页面填写并测试连接。
                </p>
              ) : null}
            </div>

            <Field
              label="提示词"
              action={
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  loading={optimizingPrompt}
                  disabled={!prompt.trim() || submitting}
                  title="使用团队共享的 DeepSeek 模型优化并替换当前提示词"
                  onClick={() => void optimizePrompt()}
                  className="h-7 px-2.5 text-[11px]"
                >
                  {!optimizingPrompt ? <Sparkles className="size-3.5" /> : null}
                  {optimizingPrompt ? "正在优化" : "优化提示词"}
                </Button>
              }
              hint={
                <span className={cn(prompt.length > charLimit && "text-rose-400")}>
                  {prompt.length} / {charLimit}
                </span>
              }
            >
              <Textarea
                rows={tab === "video" ? 4 : 4}
                value={prompt}
                maxLength={charLimit}
                disabled={optimizingPrompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder={
                  tab === "video"
                    ? "例如：黄昏的海边，一只金毛犬奔跑着追逐浪花，慢镜头，逆光，电影质感"
                    : "例如：极简风格的咖啡杯产品图，柔和侧光，浅灰色背景，高清质感"
                }
              />
            </Field>

            {tab === "video" ? (
              <>
                {/* 输入模式：文生 / 首帧 / 首尾帧 / 参考图，只展示当前模式需要的上传区 */}
                {model.supportsFrames ? (
                  <div className="space-y-2">
                    <span className="text-[13px] font-medium text-slate-300">生成方式</span>
                    <Segmented
                      value={inputMode}
                      onChange={(next) => {
                        setInputMode(next);
                        if (
                          next === "reference" &&
                          model.id === "grok-imagine-video-1.5" &&
                          resolution === "1080p"
                        ) {
                          setResolution("720p");
                        }
                        if (next === "text") {
                          setFirstFrame(null);
                          setLastFrame(null);
                          setReferences([]);
                        } else if (next === "first") {
                          setLastFrame(null);
                          setReferences([]);
                        } else if (next === "firstLast") {
                          setReferences([]);
                        } else {
                          setFirstFrame(null);
                          setLastFrame(null);
                        }
                      }}
                      options={[
                        { value: "text" as const, label: "文生视频" },
                        { value: "first" as const, label: "首帧" },
                        ...(model.supportsLastFrame
                          ? [{ value: "firstLast" as const, label: "首尾帧" }]
                          : []),
                        ...(model.supportsReferenceImages
                          ? [{ value: "reference" as const, label: "参考图" }]
                          : []),
                      ]}
                    />

                    {inputMode === "first" ? (
                      <ImageDrop label="首帧图片" value={firstFrame} onChange={setFirstFrame} />
                    ) : inputMode === "firstLast" ? (
                      <div className="grid grid-cols-2 gap-3">
                        <ImageDrop label="首帧" value={firstFrame} onChange={setFirstFrame} />
                        <ImageDrop
                          label="尾帧"
                          value={lastFrame}
                          onChange={setLastFrame}
                          disabled={!firstFrame}
                        />
                      </div>
                    ) : inputMode === "reference" ? (
                      <MultiImageDrop
                        label="参考图"
                        hint={
                          model.id === "veo-3.1-generate-001"
                            ? "主体参考最多 3 张；该型号使用参考图时固定生成 8 秒"
                            : `主体 / 风格参考，最多 ${model.maxReferenceImages ?? 4} 张`
                        }
                        values={references}
                        onChange={(value) => {
                          setReferences(value);
                          if (model.id === "veo-3.1-generate-001" && value.length) {
                            setDuration(8);
                          }
                        }}
                        max={model.maxReferenceImages ?? 4}
                      />
                    ) : null}
                  </div>
                ) : null}

                <Field label="分辨率">
                  <div className="flex flex-wrap gap-2">
                    {resolutionOptions.map((item) => (
                      <Chip
                        key={item}
                        active={resolution === item}
                        onClick={() => setResolution(item)}
                      >
                        {item}
                      </Chip>
                    ))}
                  </div>
                </Field>

                <Field label="时长" hint="拖动选择">
                  <RangeSlider
                    min={0}
                    max={Math.max(0, durationChoices.length - 1)}
                    step={1}
                    value={Math.max(0, durationChoices.indexOf(duration))}
                    onChange={(index) => {
                      const next = durationChoices[index];
                      if (next != null) setDuration(next);
                    }}
                    minLabel={`${durationChoices[0] ?? 5}s`}
                    maxLabel={`${durationChoices[durationChoices.length - 1] ?? 5}s`}
                    valueLabel={`${duration}s`}
                  />
                </Field>

                {inputMode === "text" ? (
                  <Field label="比例">
                    <div className="flex flex-wrap gap-2">
                      {ratios.map((item) => (
                        <Chip key={item} active={ratio === item} onClick={() => setRatio(item)}>
                          {item}
                        </Chip>
                      ))}
                    </div>
                  </Field>
                ) : (
                  <p className="rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-[11px] leading-5 text-slate-500">
                    比例会跟随上传的图片自动适配。
                  </p>
                )}

                {/* 高级选项合并成一行，减少纵向占用 */}
                <div className="space-y-2 rounded-xl border border-white/10 bg-black/20 p-2.5">
                  <div className="flex items-center gap-2">
                    <span className="shrink-0 text-[11px] text-slate-400">生成数量</span>
                    <div className="flex flex-1 gap-1.5">
                      {Array.from({ length: model.maxVideos ?? 4 }, (_, index) => index + 1).map(
                        (item) => (
                          <button
                            key={item}
                            type="button"
                            onClick={() => setVideoCount(item)}
                            className={cn(
                              "h-7 flex-1 rounded-lg border text-[12px] transition",
                              videoCount === item
                                ? "border-[#7c6cff]/60 bg-[#7c6cff]/20 text-white"
                                : "border-white/10 bg-white/[0.03] text-slate-400 hover:text-slate-200",
                            )}
                          >
                            {item}
                          </button>
                        ),
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-white/[0.06] pt-2">
                    {model.supportsAudio ? (
                      <div className="flex items-center gap-2">
                        <Switch checked={audioOn} onChange={setAudioOn} />
                        <span className="text-[12px] text-slate-300">
                          音频
                          <span className="ml-1 text-[11px] text-slate-500">
                            {audioOn ? "开" : "关"}
                          </span>
                        </span>
                      </div>
                    ) : null}
                  </div>
                </div>
              </>
            ) : (
              <>
                {model.resolutions?.length ? (
                  <Field label="尺寸">
                    <div className="flex flex-wrap gap-2">
                      {model.resolutions.map((item) => (
                        <Chip
                          key={item}
                          active={resolution === item}
                          onClick={() => setResolution(item)}
                        >
                          {item}
                        </Chip>
                      ))}
                    </div>
                  </Field>
                ) : null}

                <Field label="比例">
                  <div className="flex flex-wrap gap-2">
                    {ratios.map((item) => (
                      <Chip key={item} active={ratio === item} onClick={() => setRatio(item)}>
                        {item}
                      </Chip>
                    ))}
                  </div>
                </Field>

                <Field label="数量">
                  <div className="flex flex-wrap gap-2">
                    {[1, 2, 3, 4].map((item) => (
                      <Chip
                        key={item}
                        active={count === item}
                        onClick={() => setCount(item)}
                      >
                        {item} 张
                      </Chip>
                    ))}
                  </div>
                </Field>

              </>
            )}
          </div>
          </div>

          {/* 固定操作条：无论表单滚到哪，提交按钮始终可见 */}
          <div className="hidden border-t border-white/[0.07] bg-black/20 p-4 backdrop-blur-sm lg:block">
            {actionBar}
          </div>
        </section>

        <section className="flex min-h-0 min-w-0 flex-col">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium text-slate-300">最近生成</h2>
            <Link
              href="/library"
              className="flex items-center gap-1 text-[12px] text-slate-500 transition hover:text-slate-300"
            >
              查看全部
              <ChevronRight className="size-3.5" />
            </Link>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          {loadingRecent ? (
            <div className="grid grid-cols-2 gap-3 2xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={index}
                  className="skeleton aspect-square rounded-2xl border border-white/5"
                />
              ))}
            </div>
          ) : recent.length === 0 ? (
            <EmptyState
              icon={<Wand2 className="size-7" />}
              title="还没有作品"
              description="在左边写下你的第一个画面描述，生成结果会出现在这里。"
            />
          ) : (
            <div className="grid grid-cols-2 gap-3 2xl:grid-cols-3">
              {recent.map((asset) => (
                <AssetCard
                  key={asset.id}
                  asset={asset}
                  onOpen={setViewer}
                  onChanged={() => void loadRecent()}
                />
              ))}
            </div>
          )}
          </div>
        </section>
      </div>

      <AssetViewer
        asset={viewer}
        open={Boolean(viewer)}
        onClose={() => setViewer(null)}
        onChanged={() => void loadRecent()}
      />

      {/* 窄屏：浮动操作条 */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-[#0b0f16]/95 px-4 pb-3 pt-2.5 backdrop-blur-md lg:hidden">
        {actionBar}
      </div>

      <Modal
        open={templatesOpen}
        onClose={() => setTemplatesOpen(false)}
        title="提示词模板"
        description="点选一条直接填入输入框"
        wide
      >
        {templatesLoading ? (
          <div className="grid gap-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="skeleton h-16 rounded-xl border border-white/5" />
            ))}
          </div>
        ) : templates.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">
            还没有共享的提示词，去「提示词库」创建一条并勾选共享吧。
          </p>
        ) : (
          <div className="grid max-h-[60vh] gap-2 overflow-auto pr-1">
            {templates.map((item) => (
              <button
                key={item.id}
                onClick={() => void useTemplate(item)}
                className="rounded-xl border border-white/10 bg-black/20 p-3 text-left transition hover:border-[#7c6cff]/50 hover:bg-[#7c6cff]/5"
              >
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-medium text-slate-100">{item.title}</span>
                  {item.tags.slice(0, 3).map((tag) => (
                    <Badge key={tag}>{tag}</Badge>
                  ))}
                </div>
                <p className="mt-1 line-clamp-2 text-[12px] leading-5 text-slate-500">
                  {item.content}
                </p>
              </button>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}
