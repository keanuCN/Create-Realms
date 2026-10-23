"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Clapperboard,
  Coins,
  KeyRound,
  LayoutGrid,
  LogOut,
  Menu,
  Moon,
  BookOpenText,
  NotebookPen,
  ShieldCheck,
  Sun,
  X,
} from "lucide-react";
import { Badge, cn } from "@/components/ui";
import type { User } from "@/lib/types";

const NAV = [
  { href: "/", label: "创作工作台", icon: Clapperboard, exact: true },
  { href: "/library", label: "作品库", icon: LayoutGrid },
  { href: "/prompts", label: "提示词库", icon: NotebookPen },
  { href: "/guide", label: "新手教程", icon: BookOpenText },
];

type ActiveTooltip = { target: HTMLElement; content: string };
type TooltipPosition = { left: number; top: number };

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
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [health, setHealth] = useState<{ mock: boolean; hasApiKey: boolean } | null>(null);
  const [activeTooltip, setActiveTooltip] = useState<ActiveTooltip | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<TooltipPosition | null>(null);
  const tooltipTarget = useRef<HTMLElement | null>(null);
  const tooltipElement = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const findTarget = (target: EventTarget | null) =>
      target instanceof Element ? target.closest<HTMLElement>(".tip[data-tip]") : null;

    const show = (target: HTMLElement) => {
      const content = target.dataset.tip;
      if (!content) return;
      tooltipTarget.current = target;
      setTooltipPosition(null);
      setActiveTooltip({ target, content });
    };

    const hide = () => {
      tooltipTarget.current = null;
      setActiveTooltip(null);
      setTooltipPosition(null);
    };

    const handlePointerOver = (event: PointerEvent) => {
      const target = findTarget(event.target);
      if (target && target !== findTarget(event.relatedTarget)) show(target);
      else if (!target && tooltipTarget.current) hide();
    };

    const handlePointerOut = (event: PointerEvent) => {
      const current = tooltipTarget.current;
      if (!current) return;
      if (event.relatedTarget instanceof Node && current.contains(event.relatedTarget)) return;
      if (findTarget(event.relatedTarget) === current) return;
      hide();
    };

    const handleFocusIn = (event: FocusEvent) => {
      const target = findTarget(event.target);
      if (target) show(target);
    };

    const handleFocusOut = (event: FocusEvent) => {
      const current = tooltipTarget.current;
      if (!current) return;
      if (event.relatedTarget instanceof Node && current.contains(event.relatedTarget)) return;
      hide();
    };

    document.addEventListener("pointerover", handlePointerOver);
    document.addEventListener("pointerout", handlePointerOut);
    document.addEventListener("focusin", handleFocusIn);
    document.addEventListener("focusout", handleFocusOut);
    return () => {
      document.removeEventListener("pointerover", handlePointerOver);
      document.removeEventListener("pointerout", handlePointerOut);
      document.removeEventListener("focusin", handleFocusIn);
      document.removeEventListener("focusout", handleFocusOut);
    };
  }, []);

  useLayoutEffect(() => {
    if (!activeTooltip) return;

    const placeTooltip = () => {
      const trigger = activeTooltip.target;
      const tooltip = tooltipElement.current;
      if (!trigger.isConnected || !tooltip) return;

      const triggerRect = trigger.getBoundingClientRect();
      const tooltipRect = tooltip.getBoundingClientRect();
      const margin = 12;
      const maxLeft = Math.max(margin, window.innerWidth - tooltipRect.width - margin);
      const left = Math.min(
        Math.max(triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2, margin),
        maxLeft,
      );
      const above = triggerRect.top - tooltipRect.height - 8;
      const preferredTop = above >= margin ? above : triggerRect.bottom + 8;
      const maxTop = Math.max(margin, window.innerHeight - tooltipRect.height - margin);
      const top = Math.min(Math.max(preferredTop, margin), maxTop);

      setTooltipPosition((previous) =>
        previous?.left === left && previous.top === top ? previous : { left, top },
      );
    };

    placeTooltip();
    window.addEventListener("resize", placeTooltip);
    document.addEventListener("scroll", placeTooltip, true);
    return () => {
      window.removeEventListener("resize", placeTooltip);
      document.removeEventListener("scroll", placeTooltip, true);
    };
  }, [activeTooltip]);

  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === "light" ? "light" : "dark");
  }, []);

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

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    setTheme(next);
    try {
      localStorage.setItem("zaojing-theme", next);
    } catch {
      // 存储不可用时，仍在当前页面切换主题。
    }
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", next === "light" ? "#ffffff" : "#080b11");
  }

  const nav = [...NAV];
  nav.push({ href: "/settings/providers", label: "我的模型 Key", icon: KeyRound, exact: false });
  nav.push({ href: "/balances", label: "余额与积分", icon: Coins, exact: false });
  if (user.role === "admin") {
    nav.push({ href: "/admin", label: "用户管理", icon: ShieldCheck, exact: true });
  }

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-5 pb-6 pt-6">
        <div className="brand-mark grid size-9 place-items-center rounded-xl text-sm font-semibold text-white">
          <span>造</span>
        </div>
        <div>
          <p className="text-sm font-semibold tracking-wide text-white">造境</p>
          <p className="brand-affiliation text-[11px] font-medium tracking-wide">中健安华AIGC</p>
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
              data-active={active}
              className={cn(
                "nav-item flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm",
                active
                  ? "bg-gradient-to-r from-white/[0.09] to-white/[0.03] text-white"
                  : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200",
              )}
            >
              <Icon
                className={cn(
                  "size-4 transition-colors",
                  active ? "text-[#a99cff]" : "text-slate-500",
                )}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="space-y-3 px-4 pb-5">
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 backdrop-blur-sm">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <span className="relative flex size-2">
              <span
                className={cn(
                  "absolute inline-flex size-full animate-ping rounded-full opacity-60",
                  health?.mock ? "bg-amber-400" : "bg-emerald-400",
                )}
              />
              <span
                className={cn(
                  "relative inline-flex size-2 rounded-full",
                  health?.mock ? "bg-amber-400" : "bg-emerald-400",
                )}
              />
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

        <button
          type="button"
          onClick={toggleTheme}
          aria-pressed={theme === "light"}
          aria-label={theme === "dark" ? "切换到浅色主题" : "切换到深色主题"}
          className="nav-item flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-400 transition hover:bg-white/[0.04] hover:text-slate-200"
        >
          {theme === "dark" ? (
            <Sun className="size-4 text-[#a99cff]" />
          ) : (
            <Moon className="size-4 text-[#a99cff]" />
          )}
          {theme === "dark" ? "切换浅色主题" : "切换深色主题"}
        </button>

        <div className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 transition hover:bg-white/[0.03]">
          <div className="app-user-avatar grid size-8 shrink-0 place-items-center text-xs font-semibold">
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
            data-tip="退出登录"
            className="tip rounded-lg p-1.5 text-slate-500 transition hover:bg-white/5 hover:text-rose-300"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-dvh">
      <aside className="glass fixed inset-y-0 left-0 hidden w-[232px] border-y-0 border-l-0 border-r border-white/[0.06] lg:block">
        {sidebar}
      </aside>

      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="animate-backdrop-in absolute inset-0 bg-black/65 backdrop-blur-[2px]"
            onClick={() => setOpen(false)}
          />
          <aside className="animate-pop-in absolute inset-y-0 left-0 w-[260px] border-r border-white/10 bg-[#0a0e15]">
            <button
              onClick={() => setOpen(false)}
              className="tip absolute right-3 top-3 rounded-lg p-1.5 text-slate-400 hover:bg-white/5"
              data-tip="关闭"
            >
              <X className="size-4" />
            </button>
            {sidebar}
          </aside>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col lg:pl-[232px]">
        <header className="glass sticky top-0 z-30 flex h-14 items-center gap-3 border-x-0 border-t-0 border-b border-white/[0.06] px-4 lg:hidden">
          <button
            onClick={() => setOpen(true)}
            className="lift rounded-lg p-2 text-slate-300 hover:bg-white/5"
            aria-label="打开菜单"
          >
            <Menu className="size-5" />
          </button>
          <span className="text-sm font-semibold">造境</span>
          <Badge tone="cinnabar" className="ml-auto">
            中健安华AIGC
          </Badge>
        </header>
        <main className="animate-fade-up min-w-0 flex-1 px-4 pb-6 pt-4 sm:px-6 lg:px-8 lg:pt-5">
          {children}
        </main>
      </div>
      {activeTooltip && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={tooltipElement}
              role="tooltip"
              className="floating-tooltip"
              style={{
                left: tooltipPosition?.left ?? 0,
                top: tooltipPosition?.top ?? 0,
                visibility: tooltipPosition ? "visible" : "hidden",
              }}
            >
              {activeTooltip.content}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
