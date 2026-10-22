"use client";

import { useCallback, useEffect, useState } from "react";
import { KeyRound, Plus, ShieldCheck, UserX } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import {
  Badge,
  Button,
  Chip,
  EmptyState,
  Field,
  Input,
  Modal,
  cn,
  useToast,
} from "@/components/ui";
import { api } from "@/lib/client";
import type { User } from "@/lib/types";

interface AdminUser extends User {
  assetCount: number;
  succeededCount: number;
}

export default function AdminUsers({ me }: { me: User }) {
  const { toast } = useToast();
  const [items, setItems] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    username: "",
    displayName: "",
    password: "",
    role: "member" as "admin" | "member",
  });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<{ items: AdminUser[] }>("/api/admin/users");
      setItems(data.items);
    } catch (error) {
      toast(error instanceof Error ? error.message : "加载失败", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function create() {
    if (!form.username.trim() || form.password.length < 6) {
      toast("用户名必填，密码至少 6 位", "error");
      return;
    }
    setSaving(true);
    try {
      await api("/api/admin/users", {
        method: "POST",
        body: JSON.stringify({
          username: form.username.trim(),
          displayName: form.displayName.trim() || form.username.trim(),
          password: form.password,
          role: form.role,
        }),
      });
      toast("账号已创建", "success");
      setCreateOpen(false);
      setForm({ username: "", displayName: "", password: "", role: "member" });
      await load();
    } catch (error) {
      toast(error instanceof Error ? error.message : "创建失败", "error");
    } finally {
      setSaving(false);
    }
  }

  async function patch(id: string, body: Record<string, unknown>, message: string) {
    setBusyId(id);
    try {
      await api(`/api/admin/users/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      toast(message, "success");
      await load();
    } catch (error) {
      toast(error instanceof Error ? error.message : "操作失败", "error");
    } finally {
      setBusyId(null);
    }
  }

  async function resetPassword(user: AdminUser) {
    const password = prompt(`为「${user.displayName}」设置新密码（至少 6 位）：`);
    if (!password) return;
    if (password.length < 6) {
      toast("密码至少 6 位", "error");
      return;
    }
    await patch(user.id, { password }, "密码已重置，该用户需要重新登录");
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        eyebrow="ADMIN · USERS"
        title="用户管理"
        description={`给同事开账号、重置密码、停用离职账号。当前共 ${items.length} 个账号。`}
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            新建账号
          </Button>
        }
      />

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="skeleton h-14 rounded-xl border border-white/5" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState icon={<ShieldCheck className="size-7" />} title="还没有账号" />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-white/[0.07]">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/[0.03] text-[11px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">用户</th>
                <th className="hidden px-4 py-3 font-medium sm:table-cell">角色</th>
                <th className="hidden px-4 py-3 font-medium md:table-cell">作品</th>
                <th className="hidden px-4 py-3 font-medium lg:table-cell">最近登录</th>
                <th className="px-4 py-3 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {items.map((user) => (
                <tr key={user.id} className="bg-[#0c1119] hover:bg-white/[0.02]">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="grid size-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#2a3350] to-[#1a2033] text-[11px] font-semibold">
                        {user.displayName.slice(0, 1)}
                      </div>
                      <div className="min-w-0">
                        <p className="flex items-center gap-1.5 truncate text-[13px] text-slate-200">
                          {user.displayName}
                          {user.id === me.id ? (
                            <Badge tone="brand">我</Badge>
                          ) : null}
                          {user.disabled ? <Badge tone="danger">已停用</Badge> : null}
                        </p>
                        <p className="truncate text-[11px] text-slate-500">
                          @{user.username}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="hidden px-4 py-3 sm:table-cell">
                    <Badge tone={user.role === "admin" ? "brand" : "default"}>
                      {user.role === "admin" ? "管理员" : "成员"}
                    </Badge>
                  </td>
                  <td className="hidden px-4 py-3 text-[13px] text-slate-400 md:table-cell">
                    {user.succeededCount} / {user.assetCount}
                  </td>
                  <td className="hidden px-4 py-3 text-[12px] text-slate-500 lg:table-cell">
                    {user.lastLoginAt
                      ? new Date(user.lastLoginAt).toLocaleString("zh-CN")
                      : "从未登录"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1.5">
                      <button
                        onClick={() => void resetPassword(user)}
                        className="rounded-lg border border-white/10 bg-white/[0.04] p-1.5 text-slate-400 transition hover:text-slate-100"
                        title="重置密码"
                      >
                        <KeyRound className="size-3.5" />
                      </button>
                      <button
                        onClick={() =>
                          void patch(
                            user.id,
                            { role: user.role === "admin" ? "member" : "admin" },
                            "角色已更新",
                          )
                        }
                        disabled={busyId === user.id || user.id === me.id}
                        className={cn(
                          "rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-[11px] text-slate-400 transition hover:text-slate-100 disabled:opacity-40",
                        )}
                        title="切换角色"
                      >
                        {user.role === "admin" ? "设为成员" : "设为管理员"}
                      </button>
                      <button
                        onClick={() =>
                          void patch(
                            user.id,
                            { disabled: !user.disabled },
                            user.disabled ? "已启用账号" : "已停用账号",
                          )
                        }
                        disabled={busyId === user.id || user.id === me.id}
                        className={cn(
                          "rounded-lg border p-1.5 transition disabled:opacity-40",
                          user.disabled
                            ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                            : "border-white/10 bg-white/[0.04] text-slate-400 hover:text-rose-300",
                        )}
                        title={user.disabled ? "启用" : "停用"}
                      >
                        <UserX className="size-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="新建账号"
        description="把账号密码发给同事，对方登录后即可使用。"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              取消
            </Button>
            <Button loading={saving} onClick={create}>
              创建
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="用户名" hint="登录用，字母数字">
            <Input
              value={form.username}
              onChange={(event) => setForm({ ...form, username: event.target.value })}
              placeholder="zhangsan"
            />
          </Field>
          <Field label="显示名称" hint="选填">
            <Input
              value={form.displayName}
              onChange={(event) => setForm({ ...form, displayName: event.target.value })}
              placeholder="张三"
            />
          </Field>
          <Field label="初始密码" hint="至少 6 位">
            <Input
              type="text"
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              placeholder="建议用 8 位以上"
            />
          </Field>
          <Field label="角色">
            <div className="flex gap-2">
              {(
                [
                  ["member", "普通成员"],
                  ["admin", "管理员"],
                ] as const
              ).map(([value, label]) => (
                <Chip
                  key={value}
                  active={form.role === value}
                  onClick={() => setForm({ ...form, role: value })}
                >
                  {label}
                </Chip>
              ))}
            </div>
          </Field>
        </div>
      </Modal>
    </div>
  );
}
