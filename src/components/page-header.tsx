import type { ReactNode } from "react";

/**
 * 统一的页面标题区：小字标签 + 大标题 + 渐变短线 + 说明 + 右侧操作。
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  meta,
}: {
  eyebrow: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  meta?: ReactNode;
}) {
  return (
    <header className="animate-fade-up mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#a99cff]">
          {eyebrow}
        </p>
        <h1 className="mt-2 flex flex-wrap items-center gap-3 text-3xl font-semibold tracking-tight text-white">
          {title}
          {meta}
        </h1>
        <div className="mt-3 h-[3px] w-16 rounded-full bg-gradient-to-r from-[#7c6cff] via-[#9b8dff] to-[#4de2c0] shadow-[0_0_18px_-2px_rgba(124,108,255,.9)]" />
        {description ? (
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </header>
  );
}