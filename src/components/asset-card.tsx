"use client";

import Link from "next/link";
import { useState } from "react";
import {
  AlertTriangle,
  Download,
  Heart,
  Link2,
  Loader2,
  Play,
  RefreshCw,
  Trash2,
  Users,
} from "lucide-react";
import { Badge, Button, OrbitLoader, cn, useToast } from "@/components/ui";
import { PRICING_AS_OF, estimateCost, getModel } from "@/lib/models";
import { api } from "@/lib/client";
import type { AssetWithUser } from "@/lib/types";

export function statusLabel(status: AssetWithUser["status"]) {
  switch (status) {
    case "pending":
      return "排队中";
    case "running":
      return "生成中";
    case "failed":
      return "生成失败";
    case "cancelled":
      return "已取消";
    default:
      return "已完成";
  }
}

export function AssetThumb({ asset }: { asset: AssetWithUser }) {
  if (asset.status === "pending" || asset.status === "running") {
    return (
      <div className="relative flex h-full w-full flex-col items-center justify-center gap-3 bg-[#0b1018]">
        <div className="shimmer absolute inset-0" />
        <div className="pulse-ring relative grid size-12 place-items-center rounded-full border border-white/10 bg-black/40">
          <OrbitLoader />
        </div>
        <p className="relative text-xs text-slate-400">{statusLabel(asset.status)}…</p>
      </div>
    );
  }

  if (asset.status === "failed" || asset.status === "cancelled") {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-b from-[#170e13] to-[#120d10] px-5 text-center">
        <AlertTriangle className="size-5 text-rose-400/80" />
        <p className="line-clamp-2 text-xs leading-5 text-rose-200/80">
          {asset.errorMessage || statusLabel(asset.status)}
        </p>
      </div>
    );
  }

  if (!asset.mediaUrl) {
    return <div className="skeleton h-full w-full" />;
  }

  if (asset.kind === "video") {
    return (
      <div className="group/media relative h-full w-full bg-black">
        <video
          src={asset.mediaUrl}
          muted
          playsInline
          preload="metadata"
          className="zoom-media h-full w-full object-cover"
        />
        <div className="pointer-events-none absolute inset-0 grid place-items-center bg-black/25 opacity-100 transition group-hover/media:opacity-0">
          <div className="video-play-mark grid size-11 place-items-center rounded-full backdrop-blur transition group-hover/media:scale-110">
            <Play className="ml-0.5 size-4 fill-current" />
          </div>
        </div>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={asset.mediaUrl}
      alt={asset.prompt}
      loading="lazy"
      className="zoom-media h-full w-full object-cover"
    />
  );
}

export function AssetCard({
  asset,
  canManage = true,
  onOpen,
  onChanged,
}: {
  asset: AssetWithUser;
  canManage?: boolean;
  onOpen?: (asset: AssetWithUser) => void;
  onChanged?: () => void;
}) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  async function toggleFavorite(event: React.MouseEvent) {
    event.stopPropagation();
    setBusy(true);
    try {
      await api(`/api/assets/${asset.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isFavorite: !asset.isFavorite }),
      });
      onChanged?.();
    } catch (error) {
      toast(error instanceof Error ? error.message : "操作失败", "error");
    } finally {
      setBusy(false);
    }
  }

  async function share(event: React.MouseEvent) {
    event.stopPropagation();
    try {
      const { token } = await api<{ token: string }>(`/api/assets/${asset.id}/share`, {
        method: "POST",
      });
      await navigator.clipboard.writeText(`${location.origin}/s/${token}`);
      toast("分享链接已复制到剪贴板", "success");
      onChanged?.();
    } catch (error) {
      toast(error instanceof Error ? error.message : "分享失败", "error");
    }
  }

  async function toggleTeamVisibility(event: React.MouseEvent) {
    event.stopPropagation();
    setBusy(true);
    try {
      await api(`/api/assets/${asset.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isPublic: !asset.isPublic }),
      });
      toast(asset.isPublic ? "已从团队视频库撤回" : "已发布到团队视频库", "success");
      onChanged?.();
    } catch (error) {
      toast(error instanceof Error ? error.message : "更新失败", "error");
    } finally {
      setBusy(false);
    }
  }

  function download(event: React.MouseEvent) {
    event.stopPropagation();
    if (!asset.mediaUrl) return;
    const link = document.createElement("a");
    link.href = asset.mediaUrl;
    const extension = asset.storageKey?.split(".").pop() || (asset.kind === "video" ? "mp4" : "png");
    link.download = `${asset.title || asset.kind}-${asset.id.slice(0, 8)}.${extension}`;
    link.click();
  }

  async function remove(event: React.MouseEvent) {
    event.stopPropagation();
    if (!confirm("确定删除这个作品？删除后不可恢复。")) return;
    setBusy(true);
    try {
      await api(`/api/assets/${asset.id}`, { method: "DELETE" });
      toast("已删除", "success");
      onChanged?.();
    } catch (error) {
      toast(error instanceof Error ? error.message : "删除失败", "error");
    } finally {
      setBusy(false);
    }
  }

  async function retry(event: React.MouseEvent) {
    event.stopPropagation();
    setBusy(true);
    try {
      await api(`/api/assets/${asset.id}/retry`, { method: "POST" });
      toast("已重新排队", "success");
      onChanged?.();
    } catch (error) {
      toast(error instanceof Error ? error.message : "重试失败", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={cn(
        "card-hover glow-border group relative overflow-hidden rounded-2xl border border-white/[0.07] bg-[#0b1018]",
        onOpen && "cursor-pointer",
      )}
      onClick={() => onOpen?.(asset)}
    >
      <div className="relative aspect-square w-full overflow-hidden">
        <AssetThumb asset={asset} />

        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 bg-gradient-to-b from-black/60 to-transparent p-2 opacity-0 transition group-hover:opacity-100">
          <Badge
            tone={asset.kind === "video" ? "brand" : "default"}
            className={asset.kind === "video" ? "asset-video-badge" : undefined}
          >
            {asset.kind === "video" ? "视频" : "图片"}
          </Badge>
          <div className="grid w-[76px] shrink-0 grid-cols-3 gap-1">
            <button
              onClick={toggleFavorite}
              disabled={busy}
              className={cn(
                "asset-action-icon tip grid size-6 shrink-0 place-items-center rounded-lg transition hover:scale-110",
                asset.isFavorite && "asset-action-favorite",
              )}
              data-tip={asset.isFavorite ? "取消收藏" : "收藏"}
            >
              <Heart className={cn("size-3.5", asset.isFavorite && "fill-current")} />
            </button>
            {asset.status === "succeeded" ? (
              <>
                {asset.kind === "video" && canManage ? (
                  <button
                    onClick={toggleTeamVisibility}
                    disabled={busy}
                    className={cn(
                      "asset-action-icon tip grid size-6 shrink-0 place-items-center rounded-lg transition hover:scale-110",
                      asset.isPublic && "text-emerald-300",
                    )}
                    data-tip={asset.isPublic ? "从团队视频库撤回" : "发布到团队视频库"}
                  >
                    <Users className="size-3.5" />
                  </button>
                ) : null}
                <button
                  onClick={download}
                  className="asset-action-icon tip grid size-6 shrink-0 place-items-center rounded-lg transition hover:scale-110"
                  data-tip="下载"
                >
                  <Download className="size-3.5" />
                </button>
                <button
                  onClick={share}
                  className="asset-action-icon tip grid size-6 shrink-0 place-items-center rounded-lg transition hover:scale-110"
                  data-tip="复制分享链接"
                >
                  <Link2 className="size-3.5" />
                </button>
              </>
            ) : null}
            {asset.status === "failed" ? (
              <button
                onClick={retry}
                disabled={busy}
                className="asset-action-icon tip grid size-6 shrink-0 place-items-center rounded-lg transition hover:scale-110"
                data-tip="重试"
              >
                <RefreshCw className="size-3.5" />
              </button>
            ) : null}
            <button
              onClick={remove}
              disabled={busy}
              className="asset-action-icon asset-action-danger tip grid size-6 shrink-0 place-items-center rounded-lg transition hover:scale-110"
              data-tip="删除"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-1.5 border-t border-white/[0.05] bg-gradient-to-b from-white/[0.025] to-transparent p-3">
        <p className="line-clamp-2 min-h-[2.5rem] text-[12.5px] leading-5 text-slate-200">
          {asset.provider === "upload" && asset.title
            ? asset.title
            : asset.prompt || "（无提示词）"}
        </p>
        {typeof asset.params.sourceName === "string" ? (
          <p className="truncate text-[11px] text-slate-400">
            <span className="text-slate-500">来源：</span>{asset.params.sourceName}
          </p>
        ) : null}
        <div className="flex items-center justify-between text-[11px] text-slate-500">
          <span className="truncate">
            {asset.provider === "upload" ? "外部上传" : asset.model}
            {asset.resolution ? ` · ${asset.resolution}` : ""}
            {asset.durationSeconds ? ` · ${asset.durationSeconds}s` : ""}
          </span>
          <span className="shrink-0">
            {new Date(asset.createdAt).toLocaleDateString("zh-CN", {
              month: "2-digit",
              day: "2-digit",
            })}
          </span>
        </div>
      </div>
    </div>
  );
}

export function AssetViewer({
  asset,
  open,
  onClose,
  onChanged,
}: {
  asset: AssetWithUser | null;
  open: boolean;
  onClose: () => void;
  onChanged?: () => void;
}) {
  const { toast } = useToast();
  if (!open || !asset) return null;

  const model = getModel(asset.model);
  const cost = model
    ? estimateCost(model, {
        resolution: asset.resolution ?? undefined,
        duration: asset.durationSeconds ?? undefined,
        count: 1,
        audio: typeof asset.params.audio === "boolean" ? asset.params.audio : model.audioDefault,
      })
    : null;

  const shareUrl = asset.shareToken
    ? `${typeof location !== "undefined" ? location.origin : ""}/s/${asset.shareToken}`
    : null;
  const sourceName = typeof asset.params.sourceName === "string" ? asset.params.sourceName : null;
  const sourceUrl = typeof asset.params.sourceUrl === "string" ? asset.params.sourceUrl : null;

  async function copyPrompt() {
    await navigator.clipboard.writeText(asset!.prompt);
    toast("提示词已复制", "success");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
      <div
        className="animate-backdrop-in absolute inset-0 bg-black/80 backdrop-blur-[3px]"
        onClick={onClose}
      />
      <div className="animate-pop-in panel relative z-10 grid max-h-[92vh] w-full max-w-5xl grid-cols-1 overflow-auto shadow-2xl lg:grid-cols-[1.4fr_1fr]">
        <div className="flex min-h-[280px] items-center justify-center bg-black">
          {asset.status === "succeeded" && asset.mediaUrl ? (
            asset.kind === "video" ? (
              <video
                src={asset.mediaUrl}
                controls
                autoPlay
                playsInline
                className="max-h-[70vh] w-full"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={asset.mediaUrl}
                alt={asset.prompt}
                className="max-h-[70vh] w-full object-contain"
              />
            )
          ) : (
            <div className="flex flex-col items-center gap-2 p-10 text-slate-500">
              {asset.status === "failed" ? (
                <>
                  <AlertTriangle className="size-6 text-rose-400" />
                  <p className="text-sm text-rose-200">{asset.errorMessage}</p>
                </>
              ) : (
                <>
                  <Loader2 className="size-6 animate-spin text-[#a99cff]" />
                  <p className="text-sm">{statusLabel(asset.status)}…</p>
                </>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Badge tone="brand">
                  {asset.provider === "upload" ? "外部上传视频" : asset.model}
                </Badge>
                <Badge tone={asset.status === "failed" ? "danger" : "success"}>
                  {statusLabel(asset.status)}
                </Badge>
              </div>
              {asset.provider === "upload" && asset.title ? (
                <p className="mt-2 text-sm font-medium text-slate-200">{asset.title}</p>
              ) : null}
              <p className="mt-2 text-xs text-slate-500">
                {new Date(asset.createdAt).toLocaleString("zh-CN")} · {asset.authorName}
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              关闭
            </Button>
          </div>

          <div className="rounded-xl border border-white/5 bg-black/20 p-3">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[11px] text-slate-500">提示词</span>
              <button
                onClick={copyPrompt}
                className="text-[11px] text-[#a99cff] hover:text-white"
              >
                复制
              </button>
            </div>
            <p className="max-h-40 overflow-auto whitespace-pre-wrap text-[13px] leading-6 text-slate-300">
              {asset.prompt}
            </p>
          </div>

          {sourceName ? (
            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
              <p className="text-[11px] text-slate-500">视频来源</p>
              <p className="mt-1 break-all text-[13px] text-slate-200">{sourceName}</p>
              {sourceUrl ? (
                <a
                  href={sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-flex max-w-full items-center gap-1 truncate text-xs text-[#bdb3ff] hover:text-white"
                >
                  <Link2 className="size-3 shrink-0" />
                  <span className="truncate">{sourceUrl}</span>
                </a>
              ) : null}
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-2 text-[11px]">
            {asset.resolution ? (
              <div className="rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2">
                <p className="text-slate-500">分辨率</p>
                <p className="mt-0.5 text-slate-200">{asset.resolution}</p>
              </div>
            ) : null}
            {asset.aspectRatio ? (
              <div className="rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2">
                <p className="text-slate-500">比例</p>
                <p className="mt-0.5 text-slate-200">{asset.aspectRatio}</p>
              </div>
            ) : null}
            {asset.durationSeconds ? (
              <div className="rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2">
                <p className="text-slate-500">时长</p>
                <p className="mt-0.5 text-slate-200">{asset.durationSeconds} 秒</p>
              </div>
            ) : null}
            <div className="rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2">
              <p className="text-slate-500">类型</p>
              <p className="mt-0.5 text-slate-200">
                {asset.kind === "video" ? "视频" : "图片"}
              </p>
            </div>
            {cost ? (
              <div
                className="tip cursor-help rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2"
                data-tip={`${cost.detail}${cost.note ? `\n${cost.note}` : ""}\n价格调研于 ${PRICING_AS_OF}，以平台控制台为准`}
              >
                <p className="text-slate-500">参考花费</p>
                <p className="mt-0.5 tabular-nums text-slate-200">{cost.text}</p>
              </div>
            ) : null}
          </div>

          {shareUrl ? (
            <div className="rounded-xl border border-[#7c6cff]/20 bg-[#7c6cff]/5 p-3">
              <p className="mb-1.5 text-[11px] text-slate-400">分享链接</p>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={shareUrl}
                  className="h-8 w-full rounded-lg border border-white/10 bg-black/30 px-2 text-[11px] text-slate-300"
                />
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    navigator.clipboard.writeText(shareUrl);
                    toast("已复制", "success");
                  }}
                >
                  复制
                </Button>
              </div>
            </div>
          ) : null}

          <div className="mt-auto flex flex-wrap gap-2">
            {asset.status === "succeeded" && asset.mediaUrl ? (
              <Link
                href={asset.mediaUrl}
                target="_blank"
                className="inline-flex h-9 items-center rounded-lg border border-white/10 bg-white/[0.06] px-3 text-[13px] text-slate-200 hover:bg-white/[0.1]"
              >
                新窗口打开
              </Link>
            ) : null}
            <Button
              size="sm"
              variant="secondary"
              onClick={async () => {
                if (!asset.shareToken) {
                  const { token } = await api<{ token: string }>(
                    `/api/assets/${asset.id}/share`,
                    { method: "POST" },
                  );
                  await navigator.clipboard.writeText(`${location.origin}/s/${token}`);
                  toast("分享链接已复制", "success");
                } else {
                  await navigator.clipboard.writeText(shareUrl!);
                  toast("分享链接已复制", "success");
                }
                onChanged?.();
              }}
            >
              <Link2 className="size-3.5" />
              生成分享链接
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
