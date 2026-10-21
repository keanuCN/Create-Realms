"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Clapperboard,
  Images,
  LayoutGrid,
  LogOut,
  Menu,
  NotebookPen,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { Badge, cn } from "@/components/ui";
import type { User } from "@/lib/types";

const NAV = [
  { href: "/", label: "创作工作台", icon: Clapperboard, exact: true },
  { href: "/library", label: "作品库", icon: LayoutGrid },
  { href: "/prompts", label: "提示词库", icon: NotebookPen },
];

export default function AppShell({
  user,
  children,
}: {
  user: User;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [health, setHealth] = useState<{ mock: boolean; hasApiKey: boolean } | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch("/api/health")
        .then((res) => res.json())
        .then((data) => {
          if (alive) setHealth({ mock: Boolean(data.mock), hasApiKey: Boolean(data.hasApiKey) });
        })
        .catch(() => {});
    load();
    const timer = setInterval(load, 60_000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  const nav = [...NAV];
  if (user.role === "admin") {
    nav.push({ href: "/admin", label: "用户管理", icon: ShieldCheck, exact: false });
  }

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-5 pb-6 pt-6">
        <div className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-[#7c6cff] to-[#4de2c0] text-white shadow-lg">
          <Sparkles className="size-4.5" />
        </div>
        <div>
          <p className="text-sm font-semibold tracking-wide text-white">AIGC 工坊</p>
          <p className="text-[11px] text-slate-500">团队创作空间</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {nav.map((item) => {
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition",
                active
                  ? "bg-white/[0.07] text-white shadow-inner"
                  : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200",
              )}
            >
              <Icon className={cn("size-4", active ? "text-[#a99cff]" : "text-slate-500")} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="space-y-3 px-4 pb-5">
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
            </span>
            模型服务
            {health?.mock ? (
              <Badge tone="warning" className="ml-auto">
                演示模式
              </Badge>
            ) : health && !health.hasApiKey ? (
              <Badge tone="danger" className="ml-auto">
                未配置 Key
              </Badge>
            ) : (
              <Badge tone="success" className="ml-auto">
                在线
              </Badge>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2.5 rounded-xl px-2 py-1.5">
          <div className="grid size-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#2a3350] to-[#1a2033] text-xs font-semibold text-slate-200">
            {user.displayName.slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium text-slate-200">
              {user.displayName}
            </p>
            <p className="truncate text-[11px] text-slate-500">@{user.username}</p>
          </div>
          <button
            onClick={logout}
            title="退出登录"
            className="rounded-lg p-1.5 text-slate-500 transition hover:bg-white/5 hover:text-rose-300"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-dvh">
      <aside className="fixed inset-y-0 left-0 hidden w-[232px] border-r border-white/[0.06] bg-[#0a0e15]/80 backdrop-blur lg:block">
        {sidebar}
      </aside>

      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-[260px] border-r border-white/10 bg-[#0a0e15]">
            <button
              onClick={() => setOpen(false)}
              className="absolute right-3 top-3 rounded-lg p-1.5 text-slate-400 hover:bg-white/5"
            >
              <X className="size-4" />
            </button>
            {sidebar}
          </aside>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col lg:pl-[232px]">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-white/[0.06] bg-[#080b11]/80 px-4 backdrop-blur lg:hidden">
          <button
            onClick={() => setOpen(true)}
            className="rounded-lg p-2 text-slate-300 hover:bg-white/5"
          >
            <Menu className="size-5" />
          </button>
          <span className="text-sm font-semibold">AIGC 工坊</span>
          <Badge tone="brand" className="ml-auto">
            <Images className="size-3" />
            内部使用
          </Badge>
        </header>
        <main className="min-w-0 flex-1 px-4 pb-16 pt-5 sm:px-6 lg:px-8 lg:pt-8">
          {children}
        </main>
      </div>
    </div>
  );
}
