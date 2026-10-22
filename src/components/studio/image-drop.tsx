"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { cn } from "@/components/ui";
import { api } from "@/lib/client";

export interface UploadedImage {
  id: string;
  url: string;
  name: string;
}

async function compress(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) throw new Error("请选择图片文件");
  try {
    const bitmap = await createImageBitmap(file);
    const max = 2048;
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 3 * 1024 * 1024) {
      bitmap.close?.();
      return file;
    }
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((value) => resolve(value), "image/jpeg", 0.92),
    );
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", {
      type: "image/jpeg",
    });
  } catch {
    return file;
  }
}

export function ImageDrop({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: UploadedImage | null;
  onChange: (value: UploadedImage | null) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setLoading(true);
    try {
      const compressed = await compress(file);
      const form = new FormData();
      form.append("file", compressed);
      const result = await api<UploadedImage>("/api/uploads", {
        method: "POST",
        body: form,
      });
      onChange({ id: result.id, url: result.url, name: compressed.name });
    } catch (err) {
      setError(err instanceof Error ? err.message : "上传失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[12px] text-slate-400">{label}</span>
        {value ? (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-[11px] text-slate-500 hover:text-rose-300"
          >
            移除
          </button>
        ) : null}
      </div>

      <div
        onClick={() => !disabled && inputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragOver(false);
          if (disabled) return;
          void handleFile(event.dataTransfer.files?.[0]);
        }}
        className={cn(
          "relative flex h-24 cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-dashed transition",
          dragOver
            ? "border-[#7c6cff]/70 bg-[#7c6cff]/10"
            : "border-white/12 bg-black/20 hover:border-white/25",
          disabled && "cursor-not-allowed opacity-60",
        )}
      >
        {value ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={value.url} alt={label} className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onChange(null);
              }}
              className="absolute right-1.5 top-1.5 grid size-6 place-items-center rounded-md bg-black/60 text-slate-300 hover:text-white"
            >
              <X className="size-3.5" />
            </button>
          </>
        ) : loading ? (
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Loader2 className="size-4 animate-spin" />
            上传中…
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1 text-slate-500">
            <ImagePlus className="size-5" />
            <span className="text-[11px]">点击或拖拽上传</span>
          </div>
        )}
      </div>
      {error ? <p className="text-[11px] text-rose-400">{error}</p> : null}
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(event) => {
          void handleFile(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
    </div>
  );
}

/**
 * 多张参考图（主体 / 风格参考）。缩略图网格 + 追加按钮。
 */
export function MultiImageDrop({
  label,
  hint,
  values,
  onChange,
  max = 4,
  disabled,
}: {
  label: string;
  hint?: string;
  values: UploadedImage[];
  onChange: (values: UploadedImage[]) => void;
  max?: number;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const full = values.length >= max;

  async function handleFiles(files: FileList | null | undefined) {
    if (!files?.length) return;
    setError(null);
    setLoading(true);
    try {
      const room = max - values.length;
      const picked = Array.from(files).slice(0, Math.max(0, room));
      const uploaded: UploadedImage[] = [];
      for (const file of picked) {
        const compressed = await compress(file);
        const form = new FormData();
        form.append("file", compressed);
        const result = await api<UploadedImage>("/api/uploads", {
          method: "POST",
          body: form,
        });
        uploaded.push({ id: result.id, url: result.url, name: compressed.name });
      }
      onChange([...values, ...uploaded]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "上传失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[12px] text-slate-400">{label}</span>
        {hint ? <span className="text-[11px] text-slate-500">{hint}</span> : null}
      </div>

      <div className="flex flex-wrap gap-2">
        {values.map((item) => (
          <div
            key={item.id}
            className="group relative size-20 overflow-hidden rounded-xl border border-white/12"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.url} alt={item.name} className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => onChange(values.filter((value) => value.id !== item.id))}
              className="absolute right-1 top-1 grid size-5 place-items-center rounded-md bg-black/65 text-slate-300 opacity-0 transition group-hover:opacity-100 hover:text-white"
              aria-label="移除"
            >
              <X className="size-3" />
            </button>
          </div>
        ))}

        {!full ? (
          <div
            onClick={() => !disabled && inputRef.current?.click()}
            onDragOver={(event) => {
              event.preventDefault();
              if (!disabled) setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragOver(false);
              if (disabled || full) return;
              void handleFiles(event.dataTransfer.files);
            }}
            className={cn(
              "flex size-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed transition",
              dragOver
                ? "border-[#7c6cff]/70 bg-[#7c6cff]/10"
                : "border-white/12 bg-black/20 hover:border-white/25",
              (disabled || loading) && "cursor-not-allowed opacity-60",
            )}
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin text-slate-400" />
            ) : (
              <>
                <ImagePlus className="size-4 text-slate-500" />
                <span className="text-[10px] text-slate-500">
                  {values.length}/{max}
                </span>
              </>
            )}
          </div>
        ) : null}
      </div>

      {error ? <p className="text-[11px] text-rose-400">{error}</p> : null}
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(event) => {
          void handleFiles(event.target.files);
          event.target.value = "";
        }}
      />
    </div>
  );
}
