"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Eye, EyeOff, Sparkles } from "lucide-react";
import { Button, Input, cn, useToast } from "@/components/ui";
import { api } from "@/lib/client";

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
      toast("登录成功，开始创作吧", "success");
      router.replace("/");
      router.refresh();
    } catch (error) {
      toast(error instanceof Error ? error.message : "登录失败", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-10">
      <div className="pointer-events-none absolute -left-32 top-1/4 size-96 rounded-full bg-[#7c6cff]/20 blur-[120px]" />
      <div className="pointer-events-none absolute -right-24 bottom-0 size-80 rounded-full bg-[#4de2c0]/10 blur-[120px]" />

      <div className="relative grid w-full max-w-4xl overflow-hidden rounded-3xl border border-white/10 bg-[#0d121b]/80 shadow-2xl backdrop-blur-xl md:grid-cols-[1.1fr_1fr]">
        <div className="relative hidden flex-col justify-between gap-10 border-r border-white/5 bg-gradient-to-br from-[#141a2a] via-[#101623] to-[#0b1017] p-10 md:flex">
          <div className="flex items-center gap-2.5">
            <div className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-[#7c6cff] to-[#4de2c0] shadow-lg">
              <Sparkles className="size-5 text-white" />
            </div>
            <div>
              <p className="text-base font-semibold text-white">AIGC 工坊</p>
              <p className="text-xs text-slate-500">团队内部创作空间</p>
            </div>
          </div>

          <div className="space-y-6">
            <h1 className="text-3xl font-semibold leading-snug text-white">
              把想法变成
              <br />
              <span className="bg-gradient-to-r from-[#a99cff] to-[#4de2c0] bg-clip-text text-transparent">
                能看的画面
              </span>
            </h1>
            <p className="max-w-xs text-sm leading-6 text-slate-400">
              文生视频、图生视频、文生图一站搞定。作品自动归档，提示词互相复用，
              同事之间可以直接分享成片。
            </p>
            <div className="flex flex-wrap gap-2 text-[11px] text-slate-500">
              {["MiniMax H3 Max", "480P / 768P", "5–15 秒", "首尾帧控制"].map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>

          <p className="text-[11px] text-slate-600">
            内网部署 · 数据不出公司 · 登录后即可使用
          </p>
        </div>

        <div className="p-8 sm:p-10">
          <div className="mb-8 md:hidden">
            <div className="mb-3 grid size-10 place-items-center rounded-xl bg-gradient-to-br from-[#7c6cff] to-[#4de2c0]">
              <Sparkles className="size-5 text-white" />
            </div>
            <p className="text-lg font-semibold text-white">AIGC 工坊</p>
          </div>

          <h2 className="text-xl font-semibold text-white">登录</h2>
          <p className="mt-1 text-sm text-slate-500">使用管理员分配的账号进入工作台</p>

          <form onSubmit={onSubmit} className="mt-7 space-y-4">
            <div className="space-y-2">
              <label className="text-[13px] text-slate-300">账号</label>
              <Input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="用户名"
                autoComplete="username"
                autoFocus
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-[13px] text-slate-300">密码</label>
              <div className="relative">
                <Input
                  type={show ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShow((value) => !value)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-500 hover:text-slate-300"
                  aria-label={show ? "隐藏密码" : "显示密码"}
                >
                  {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" size="lg" loading={loading} className={cn("mt-2 w-full")}>
              进入工作台
            </Button>
          </form>

          <p className="mt-6 text-center text-[11px] leading-5 text-slate-600">
            没有账号？联系管理员在「用户管理」里创建
          </p>
        </div>
      </div>
    </div>
  );
}
