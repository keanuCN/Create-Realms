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
import { MODELS, getModel, modelsFor, providerLabel, providersForModality } from "@/lib/models";
import { providerColor, providerGradient } from "@/lib/provider-colors";
import type { AssetWithUser, PromptTemplate } from "@/lib/types";

type Tab = "video" | "image";

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="stat-tile min-w-[92px] px-4 py-3 text-center">
      <p className="stat-value text-2xl font-semibold text-white">{value}</p>
      <p className="mt-1 text-[11px] text-slate-400">{label}</p>
    </div>
  );
}

export default function Studio({ displayName }: { displayName: string }) {
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>("video");
  const [provider, setProvider] = useState("minimax");
  const [modelId, setModelId] = useState("MiniMax-H3-Max");
  const [prompt, setPrompt] = useState("");
  const [resolution, setResolution] = useState("768P");
  const [duration, setDuration] = useState(5);
  const [ratio, setRatio] = useState("16:9");
  const [expansion, setExpansion] = useState<"disabled" | "balanced" | "quality">("balanced");
  const [firstFrame, setFirstFrame] = useState<UploadedImage | null>(null);
  const [lastFrame, setLastFrame] = useState<UploadedImage | null>(null);
  const [count, setCount] = useState(1);
  const [optimizer, setOptimizer] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  // 视频专用
  const [videoCount, setVideoCount] = useState(1);
  const [audioOn, setAudioOn] = useState(true);
  const [videoOptimizer, setVideoOptimizer] = useState(true);
  const [references, setReferences] = useState<UploadedImage[]>([]);

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
  const currentReady = providerReady[provider] !== false;

  useEffect(() => {
    api<{ providers: { id: string; configured: boolean; enabled: boolean; source: string }[] }>(
      "/api/health",
    )
      .then((data) => {
        const map: Record<string, boolean> = {};
        for (const item of data.providers ?? []) {
          map[item.id] = item.configured && item.enabled;
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
    setVideoOptimizer(true);
    setVideoCount(1);
    setReferences([]);
    setFirstFrame(null);
    setLastFrame(null);
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
                      promptExpansion: expansion,
                      promptOptimizer: expansion !== "disabled",
                    }
                  : { promptOptimizer: videoOptimizer }
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
              promptOptimizer: optimizer,
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
  const withFrames = Boolean(firstFrame || lastFrame);
  const ratios = model.ratios ?? ["16:9"];

  return (
    <div className="mx-auto max-w-[1440px]">
      <div className="hero-band animate-fade-up mb-6 p-6 sm:p-7">
        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#bdb3ff]">
              WORKSPACE
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">
              嗨，{displayName}，<span className="gradient-text">想做点什么？</span>
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-400">
              选一个模型供应商，写下画面描述，剩下的交给它 ——
              视频与图片、多平台模型都在同一个入口。
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-2">
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
          </div>

          <div className="grid grid-cols-3 gap-3">
            <StatTile label="我的作品" value={stats.assets} />
            <StatTile label="在用供应商" value={stats.providers} />
            <StatTile label="可用模型" value={MODELS.length} />
          </div>
        </div>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,430px)_minmax(0,1fr)]">
        <section className="panel p-5 xl:sticky xl:top-6">
          <div className="mb-5">
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
                      onClick={() => pickProvider(item)}
                      className={cn(
                        "lift flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px]",
                        active
                          ? "text-white"
                          : "border-white/10 bg-white/[0.03] text-slate-400 hover:text-slate-200",
                      )}
                      style={
                        active
                          ? {
                              borderColor: color.from,
                              background: color.soft,
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
              <div className="grid grid-cols-2 gap-2">
                {modelOptions.map((item) => {
                  const active = modelId === item.id;
                  const color = providerColor(item.provider);
                  return (
                    <button
                      key={item.id}
                      onClick={() => pickModel(item.id)}
                      className={cn(
                        "lift relative overflow-hidden rounded-xl border p-3 pl-4 text-left",
                        active
                          ? "text-white"
                          : "border-white/10 bg-black/20 hover:border-white/20",
                      )}
                      style={
                        active
                          ? {
                              borderColor: color.from,
                              background: color.soft,
                              boxShadow: `0 10px 26px -16px ${color.from}`,
                            }
                          : undefined
                      }
                    >
                      <span
                        aria-hidden
                        className="absolute inset-y-0 left-0 w-[3px]"
                        style={{ background: providerGradient(item.provider, "180deg") }}
                      />
                      <div className="flex items-center gap-1.5">
                        <span className="text-[13px] font-semibold text-white">
                          {item.label}
                        </span>
                        {item.badge ? <Badge tone="brand">{item.badge}</Badge> : null}
                      </div>
                      <p className="mt-1 text-[11px] leading-4 text-slate-400">
                        {item.tagline}
                      </p>
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
              hint={
                <span className={cn(prompt.length > charLimit && "text-rose-400")}>
                  {prompt.length} / {charLimit}
                </span>
              }
            >
              <Textarea
                rows={tab === "video" ? 5 : 4}
                value={prompt}
                maxLength={charLimit}
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
                {model.supportsReferenceImages ? (
                  <MultiImageDrop
                    label="参考图（可选）"
                    hint={`主体 / 风格参考，最多 ${model.maxReferenceImages ?? 4} 张`}
                    values={references}
                    onChange={setReferences}
                    max={model.maxReferenceImages ?? 4}
                    disabled={Boolean(firstFrame || lastFrame)}
                  />
                ) : null}

                {model.supportsFrames ? (
                  <div className="grid grid-cols-2 gap-3">
                    <ImageDrop
                      label="首帧（可选）"
                      value={firstFrame}
                      onChange={setFirstFrame}
                      disabled={references.length > 0}
                    />
                    <ImageDrop
                      label="尾帧（可选）"
                      value={lastFrame}
                      onChange={setLastFrame}
                      disabled={!firstFrame || !model.supportsLastFrame || references.length > 0}
                    />
                  </div>
                ) : null}

                {references.length && (firstFrame || lastFrame) ? (
                  <p className="rounded-lg border border-amber-500/25 bg-amber-500/[0.08] px-3 py-2 text-[11px] leading-5 text-amber-200">
                    首尾帧与参考图是两种互斥的方式，请只保留一种。
                  </p>
                ) : null}

                <Field label="分辨率">
                  <div className="flex flex-wrap gap-2">
                    {(model.resolutions ?? []).map((item) => (
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
                    min={model.durationRange?.min ?? 5}
                    max={model.durationRange?.max ?? 10}
                    step={model.durationRange?.step ?? 1}
                    value={duration}
                    onChange={setDuration}
                  />
                </Field>

                {withFrames || references.length ? (
                  <p className="rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-[11px] leading-5 text-slate-500">
                    已上传{references.length ? "参考图" : "参考帧"}，画面比例会跟随输入图片自动适配。
                  </p>
                ) : (
                  <Field label="比例">
                    <div className="flex flex-wrap gap-2">
                      {ratios.map((item) => (
                        <Chip key={item} active={ratio === item} onClick={() => setRatio(item)}>
                          {item}
                        </Chip>
                      ))}
                    </div>
                  </Field>
                )}

                {model.supportsPromptOptimizer ? (
                  modelId === "MiniMax-H3-Max" ? (
                    <Field label="提示词优化" hint="默认「均衡」效果最稳">
                      <div className="flex gap-2">
                        {(
                          [
                            ["disabled", "关闭"],
                            ["balanced", "均衡"],
                            ["quality", "高质量"],
                          ] as const
                        ).map(([value, label]) => (
                          <Chip
                            key={value}
                            active={expansion === value}
                            onClick={() => setExpansion(value)}
                            className="flex-1"
                          >
                            {label}
                          </Chip>
                        ))}
                      </div>
                    </Field>
                  ) : (
                    <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-3.5 py-3 transition hover:border-[#7c6cff]/30">
                      <div>
                        <p className="text-[13px] text-slate-200">提示词优化</p>
                        <p className="mt-0.5 text-[11px] text-slate-500">
                          {model.promptOptimizerHint ?? "自动补充画面细节"}
                        </p>
                      </div>
                      <Switch checked={videoOptimizer} onChange={setVideoOptimizer} />
                    </div>
                  )
                ) : null}

                {model.supportsAudio ? (
                  <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-3.5 py-3 transition hover:border-[#7c6cff]/30">
                    <div>
                      <p className="text-[13px] text-slate-200">生成音频</p>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        {audioOn ? "音画同出（对白 / 音效 / 配乐）" : "只出画面，不生成声音"}
                      </p>
                    </div>
                    <Switch checked={audioOn} onChange={setAudioOn} />
                  </div>
                ) : null}

                <Field label="生成数量" hint={`同一提示词生成多条，最多 ${model.maxVideos ?? 4} 条`}>
                  <div className="flex flex-wrap gap-2">
                    {Array.from({ length: model.maxVideos ?? 4 }, (_, index) => index + 1).map(
                      (item) => (
                        <Chip
                          key={item}
                          active={videoCount === item}
                          onClick={() => setVideoCount(item)}
                          className="flex-1"
                        >
                          {item} 条
                        </Chip>
                      ),
                    )}
                  </div>
                </Field>
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

                <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-3.5 py-3 transition hover:border-[#7c6cff]/30">
                  <div>
                    <p className="text-[13px] text-slate-200">智能改写提示词</p>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      自动补充画面细节，通常更出片
                    </p>
                  </div>
                  <Switch checked={optimizer} onChange={setOptimizer} />
                </div>
              </>
            )}

            <Button
              size="lg"
              className="w-full"
              loading={submitting}
              onClick={submit}
              disabled={!prompt.trim() || !currentReady}
            >
              <Sparkles className="size-4" />
              {tab === "video" ? `生成视频 · ${duration} 秒` : `生成图片 · ${count} 张`}
            </Button>

            <p className="text-center text-[11px] text-slate-600">
              {tab === "video"
                ? "视频生成通常需要 1–3 分钟，可以先去做别的事"
                : "图片生成通常需要 10–30 秒"}
            </p>
          </div>
        </section>

        <section className="min-w-0">
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

          {loadingRecent ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
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
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
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
        </section>
      </div>

      <AssetViewer
        asset={viewer}
        open={Boolean(viewer)}
        onClose={() => setViewer(null)}
        onChanged={() => void loadRecent()}
      />

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
