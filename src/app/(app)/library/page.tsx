"use client";

import { useCallback, useEffect, useState } from "react";
import { Heart, Images, LayoutGrid, Search, Sparkles, Upload } from "lucide-react";
import { AssetCard, AssetViewer } from "@/components/asset-card";
import { PageHeader } from "@/components/page-header";
import { Button, Chip, EmptyState, Input, Modal, cn, useToast } from "@/components/ui";
import { api } from "@/lib/client";
import type { AssetWithUser } from "@/lib/types";

export default function LibraryPage() {
  const { toast } = useToast();
  const [scope, setScope] = useState<"mine" | "team">("mine");
  const [kind, setKind] = useState<"all" | "video" | "image">("all");
  const [favorite, setFavorite] = useState(false);
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [items, setItems] = useState<AssetWithUser[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [viewer, setViewer] = useState<AssetWithUser | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState("");
  const [sourceName, setSourceName] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");

  useEffect(() => {
    api<{ user: { id: string } | null }>("/api/auth/me")
      .then((data) => setCurrentUserId(data.user?.id ?? null))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQ(q.trim()), 350);
    return () => clearTimeout(timer);
  }, [q]);

  const fetchPage = useCallback(
    async (offset: number) => {
      const params = new URLSearchParams({
        scope,
        kind,
        limit: "24",
        offset: String(offset),
      });
      if (favorite) params.set("favorite", "1");
      if (debouncedQ) params.set("q", debouncedQ);
      return api<{ items: AssetWithUser[]; total: number }>(
        `/api/assets?${params.toString()}`,
      );
    },
    [scope, kind, favorite, debouncedQ],
  );

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchPage(0)
      .then((data) => {
        if (!alive) return;
        setItems(data.items);
        setTotal(data.total);
      })
      .catch((error) => toast(error instanceof Error ? error.message : "加载失败", "error"))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [fetchPage, toast]);

  const hasActive = items.some(
    (item) => item.status === "pending" || item.status === "running",
  );

  useEffect(() => {
    if (!hasActive) return;
    const timer = setInterval(() => {
      fetchPage(0)
        .then((data) => {
          setItems(data.items);
          setTotal(data.total);
        })
        .catch(() => {});
    }, 4000);
    return () => clearInterval(timer);
  }, [hasActive, fetchPage]);

  async function loadMore() {
    setLoadingMore(true);
    try {
      const data = await fetchPage(items.length);
      setItems((prev) => [...prev, ...data.items]);
      setTotal(data.total);
    } catch (error) {
      toast(error instanceof Error ? error.message : "加载失败", "error");
    } finally {
      setLoadingMore(false);
    }
  }

  async function uploadVideo() {
    if (!uploadFile || !sourceName.trim()) return;
    const form = new FormData();
    form.append("file", uploadFile);
    form.append("title", uploadTitle.trim());
    form.append("sourceName", sourceName.trim());
    form.append("sourceUrl", sourceUrl.trim());
    setUploading(true);
    try {
      await api<{ id: string }>("/api/assets/upload", { method: "POST", body: form });
      toast("视频已上传并加入团队作品库", "success");
      setUploadOpen(false);
      setUploadFile(null);
      setUploadTitle("");
      setSourceName("");
      setSourceUrl("");
      try {
        const data = await fetchPage(0);
        setItems(data.items);
        setTotal(data.total);
      } catch {
        toast("视频已上传，请刷新页面查看作品", "info");
      }
    } catch (error) {
      toast(error instanceof Error ? error.message : "视频上传失败", "error");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="mx-auto max-w-[1440px]">
      <PageHeader
        eyebrow="LIBRARY"
        title="作品库"
        meta={
          <span className="rounded-full border border-[#7c6cff]/30 bg-[#7c6cff]/10 px-2.5 py-1 text-xs font-normal text-[#bdb3ff]">
            {total} 件
          </span>
        }
        description="所有生成结果都会自动留档，支持收藏、下载和分享给同事。"
        actions={
          <Button onClick={() => setUploadOpen(true)}>
            <Upload className="size-4" />
            上传视频
          </Button>
        }
      />

      <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-3 lg:flex-row lg:items-center">
        <div className="flex rounded-xl border border-white/10 bg-black/25 p-1">
          {(
            [
              ["mine", "我的作品"],
              ["team", "团队作品"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setScope(value)}
              className={cn(
                "h-8 rounded-lg px-3 text-[13px] transition",
                scope === value
                  ? "bg-white/[0.09] text-white"
                  : "text-slate-500 hover:text-slate-300",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
          <Input
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="搜索提示词或标题…"
            className="pl-9"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              ["all", "全部"],
              ["video", "视频"],
              ["image", "图片"],
            ] as const
          ).map(([value, label]) => (
            <Chip key={value} active={kind === value} onClick={() => setKind(value)}>
              {label}
            </Chip>
          ))}
          <Chip active={favorite} onClick={() => setFavorite((value) => !value)}>
            <span className="flex items-center gap-1">
              <Heart className={cn("size-3.5", favorite && "fill-rose-400 text-rose-400")} />
              收藏
            </span>
          </Chip>
        </div>
      </div>

      <div className="min-h-0 max-h-[calc(100dvh-20rem)] overflow-y-auto overscroll-contain pr-1 lg:max-h-[calc(100dvh-17rem)]">
        {loading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {Array.from({ length: 10 }).map((_, index) => (
              <div
                key={index}
                className="skeleton aspect-square rounded-2xl border border-white/5"
              />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={favorite ? <Heart className="size-7" /> : <Images className="size-7" />}
            title={favorite ? "还没有收藏" : "这里还空着"}
            description={
              favorite
                ? "点作品卡片右上角的爱心，把喜欢的收进来。"
                : "去工作台生成第一个作品，它会自动出现在这里。"
            }
            action={
              <a
                href="/"
                className="mt-1 inline-flex h-9 items-center gap-2 rounded-lg bg-[#7c6cff] px-4 text-[13px] font-medium text-white"
              >
                <Sparkles className="size-4" />
                去创作
              </a>
            }
          />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {items.map((asset) => (
                <AssetCard
                  key={asset.id}
                  asset={asset}
                  canManage={asset.userId === currentUserId}
                  onOpen={setViewer}
                  onChanged={() =>
                    fetchPage(0)
                      .then((data) => {
                        setItems(data.items);
                        setTotal(data.total);
                      })
                      .catch(() => {})
                  }
                />
              ))}
            </div>

            {items.length < total ? (
              <div className="mt-6 flex justify-center pb-1">
                <Button variant="secondary" loading={loadingMore} onClick={loadMore}>
                  <LayoutGrid className="size-4" />
                  加载更多（{items.length}/{total}）
                </Button>
              </div>
            ) : null}
          </>
        )}
      </div>

      <Modal
        open={uploadOpen}
        onClose={() => {
          if (!uploading) setUploadOpen(false);
        }}
        title="上传视频到团队作品库"
        description="支持 MP4、MOV、WebM，单个文件最大 300MB。上传后团队成员都可以查看和下载。"
        footer={
          <>
            <Button variant="ghost" onClick={() => setUploadOpen(false)} disabled={uploading}>
              取消
            </Button>
            <Button
              onClick={uploadVideo}
              loading={uploading}
              disabled={!uploadFile || !sourceName.trim()}
            >
              <Upload className="size-4" />
              上传并分享
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <label className="flex min-h-28 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 bg-white/[0.025] px-4 py-5 text-center transition hover:border-[#7c6cff]/50 hover:bg-[#7c6cff]/[0.06]">
            <input
              type="file"
              accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                if (file && file.size > 300 * 1024 * 1024) {
                  toast("视频不能超过 300MB", "error");
                  event.target.value = "";
                  setUploadFile(null);
                  return;
                }
                setUploadFile(file);
                event.target.value = "";
              }}
            />
            <Upload className="size-5 text-[#bdb3ff]" />
            <span className="max-w-full truncate text-sm text-slate-200">
              {uploadFile ? uploadFile.name : "点击选择视频文件"}
            </span>
            <span className="text-[11px] text-slate-500">
              {uploadFile
                ? `${(uploadFile.size / 1024 / 1024).toFixed(1)} MB`
                : "MP4 / MOV / WebM · 最大 300MB"}
            </span>
          </label>

          <div>
            <label htmlFor="library-upload-title" className="mb-1.5 block text-[13px] font-medium text-slate-300">
              作品标题 <span className="font-normal text-slate-500">（选填）</span>
            </label>
            <Input
              id="library-upload-title"
              value={uploadTitle}
              onChange={(event) => setUploadTitle(event.target.value)}
              maxLength={120}
              placeholder="默认使用视频文件名"
            />
          </div>

          <div>
            <label htmlFor="library-upload-source" className="mb-1.5 block text-[13px] font-medium text-slate-300">
              视频来源 <span className="text-rose-300">*</span>
            </label>
            <Input
              id="library-upload-source"
              value={sourceName}
              onChange={(event) => setSourceName(event.target.value)}
              maxLength={100}
              placeholder="例如：客户提供、B站、项目宣传片"
              required
            />
          </div>

          <div>
            <label htmlFor="library-upload-source-url" className="mb-1.5 block text-[13px] font-medium text-slate-300">
              来源链接 <span className="font-normal text-slate-500">（选填）</span>
            </label>
            <Input
              id="library-upload-source-url"
              type="url"
              value={sourceUrl}
              onChange={(event) => setSourceUrl(event.target.value)}
              placeholder="https://..."
            />
          </div>
        </div>
      </Modal>

      <AssetViewer
        asset={viewer}
        open={Boolean(viewer)}
        onClose={() => setViewer(null)}
        onChanged={() => {
          fetchPage(0)
            .then((data) => {
              setItems(data.items);
              setTotal(data.total);
            })
            .catch(() => {});
        }}
      />
    </div>
  );
}
