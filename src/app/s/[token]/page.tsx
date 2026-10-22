import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Download } from "lucide-react";
import { getAssetByShareToken } from "@/lib/share";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ token: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const asset = await getAssetByShareToken(token);
  return {
    title: asset ? `${asset.title || "AI 作品"} · 造境` : "作品不存在",
  };
}

export default async function SharePage({ params }: Props) {
  const { token } = await params;
  const asset = await getAssetByShareToken(token);
  if (!asset || !asset.mediaUrlPublic) notFound();

  return (
    <div className="mx-auto flex min-h-dvh max-w-5xl flex-col px-4 py-8 sm:px-6">
      <header className="mb-6 flex items-center gap-2.5">
        <div className="brand-mark grid size-9 place-items-center rounded-xl text-sm font-semibold text-white">
          造
        </div>
        <div>
          <p className="text-sm font-semibold text-white">造境</p>
          <p className="text-[11px] text-slate-500">团队作品分享</p>
        </div>
      </header>

      <main className="grid flex-1 items-start gap-5 lg:grid-cols-[1.6fr_1fr]">
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-black">
          {asset.kind === "video" ? (
            <video
              src={asset.mediaUrlPublic}
              controls
              autoPlay
              playsInline
              className="max-h-[72vh] w-full"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={asset.mediaUrlPublic} alt={asset.prompt} className="w-full" />
          )}
        </div>

        <aside className="space-y-4 rounded-2xl border border-white/[0.07] bg-[#0d121b] p-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-[#7c6cff]/25 bg-[#7c6cff]/10 px-2 py-0.5 text-[11px] text-[#b4a8ff]">
              {asset.model}
            </span>
            {asset.resolution ? (
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[11px] text-slate-400">
                {asset.resolution}
              </span>
            ) : null}
            {asset.durationSeconds ? (
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[11px] text-slate-400">
                {asset.durationSeconds}s
              </span>
            ) : null}
          </div>

          <div>
            <p className="text-[11px] text-slate-500">提示词</p>
            <p className="mt-1.5 whitespace-pre-wrap text-[13px] leading-6 text-slate-300">
              {asset.prompt}
            </p>
          </div>

          <div className="text-[11px] text-slate-500">
            <p>
              作者：{asset.authorName}
              {asset.authorUsername ? `（@${asset.authorUsername}）` : ""}
            </p>
            <p className="mt-1">{new Date(asset.createdAt).toLocaleString("zh-CN")}</p>
          </div>

          <a
            href={asset.mediaUrlPublic}
            download
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#7c6cff] text-sm font-medium text-white transition hover:bg-[#8b7dff]"
          >
            <Download className="size-4" />
            下载原文件
          </a>

          <p className="text-center text-[11px] leading-5 text-slate-600">
            这是通过分享链接查看的作品，仅对拿到链接的人可见。
          </p>
        </aside>
      </main>
    </div>
  );
}
