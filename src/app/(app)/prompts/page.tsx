"use client";

import { useCallback, useEffect, useState } from "react";
import { BookOpen, Copy, Pencil, Plus, Search, Trash2, Users } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import {
  Badge,
  Button,
  Chip,
  EmptyState,
  Field,
  Input,
  Modal,
  Textarea,
  cn,
  useToast,
} from "@/components/ui";
import { api } from "@/lib/client";
import type { PromptTemplate } from "@/lib/types";

const KIND_LABEL: Record<string, string> = {
  video: "视频",
  image: "图片",
  any: "通用",
};

interface DraftState {
  id?: string;
  title: string;
  content: string;
  tags: string;
  kind: "video" | "image" | "any";
  isShared: boolean;
}

const EMPTY_DRAFT: DraftState = {
  title: "",
  content: "",
  tags: "",
  kind: "any",
  isShared: true,
};

export default function PromptsPage() {
  const { toast } = useToast();
  const [scope, setScope] = useState<"mine" | "shared">("shared");
  const [kind, setKind] = useState<"any" | "video" | "image">("any");
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [items, setItems] = useState<PromptTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  const [draft, setDraft] = useState<DraftState | null>(null);
  const [saving, setSaving] = useState(false);
  const [meId, setMeId] = useState<string | null>(null);

  useEffect(() => {
    api<{ user: { id: string } | null }>("/api/auth/me")
      .then((data) => setMeId(data.user?.id ?? null))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => clearTimeout(timer);
  }, [q]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ scope, kind });
      if (debouncedQ) params.set("q", debouncedQ);
      const data = await api<{ items: PromptTemplate[] }>(
        `/api/prompts?${params.toString()}`,
      );
      setItems(data.items);
    } catch (error) {
      toast(error instanceof Error ? error.message : "加载失败", "error");
    } finally {
      setLoading(false);
    }
  }, [scope, kind, debouncedQ, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    if (!draft) return;
    if (!draft.title.trim() || !draft.content.trim()) {
      toast("标题和内容都要填", "error");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: draft.title.trim(),
        content: draft.content.trim(),
        tags: draft.tags
          .split(/[,，\s]+/)
          .map((tag) => tag.trim())
          .filter(Boolean)
          .slice(0, 8),
        kind: draft.kind,
        isShared: draft.isShared,
      };
      if (draft.id) {
        await api(`/api/prompts/${draft.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        toast("已保存", "success");
      } else {
        await api("/api/prompts", { method: "POST", body: JSON.stringify(payload) });
        toast("提示词已创建", "success");
      }
      setDraft(null);
      await load();
    } catch (error) {
      toast(error instanceof Error ? error.message : "保存失败", "error");
    } finally {
      setSaving(false);
    }
  }

  async function remove(item: PromptTemplate) {
    if (!confirm(`删除提示词「${item.title}」？`)) return;
    try {
      await api(`/api/prompts/${item.id}`, { method: "DELETE" });
      toast("已删除", "success");
      await load();
    } catch (error) {
      toast(error instanceof Error ? error.message : "删除失败", "error");
    }
  }

  async function copy(item: PromptTemplate) {
    await navigator.clipboard.writeText(item.content);
    void api(`/api/prompts/${item.id}/use`, { method: "POST" }).catch(() => {});
    toast("已复制，去工作台粘贴即可", "success");
  }

  return (
    <div className="mx-auto max-w-[1440px]">
      <PageHeader
        eyebrow="PROMPTS"
        title="提示词库"
        description="把好用的提示词沉淀下来，勾选共享后同事就能一键复用。"
        actions={
          <Button onClick={() => setDraft({ ...EMPTY_DRAFT })}>
            <Plus className="size-4" />
            新建提示词
          </Button>
        }
      />

      <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-3 sm:flex-row sm:items-center">
        <div className="flex rounded-xl border border-white/10 bg-black/25 p-1">
          {(
            [
              ["shared", "共享大厅"],
              ["mine", "我的"],
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
            placeholder="搜索标题、内容或标签…"
            className="pl-9"
          />
        </div>

        <div className="flex gap-2">
          {(
            [
              ["any", "全部"],
              ["video", "视频"],
              ["image", "图片"],
            ] as const
          ).map(([value, label]) => (
            <Chip key={value} active={kind === value} onClick={() => setKind(value)}>
              {label}
            </Chip>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="skeleton h-40 rounded-2xl border border-white/5" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="size-7" />}
          title="还没有提示词"
          description="创建一条，勾选「共享给同事」，它就会出现在共享大厅里。"
          action={
            <Button size="sm" onClick={() => setDraft({ ...EMPTY_DRAFT })}>
              <Plus className="size-3.5" />
              新建
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <article
              key={item.id}
              className="group flex flex-col rounded-2xl border border-white/[0.07] bg-[#0e141d] p-4 transition hover:border-white/15"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-[14px] font-medium text-slate-100">{item.title}</h3>
                <div className="flex shrink-0 gap-1 opacity-0 transition group-hover:opacity-100">
                  <button
                    onClick={() => copy(item)}
                    className="rounded-md p-1.5 text-slate-500 hover:bg-white/5 hover:text-slate-200"
                    title="复制"
                  >
                    <Copy className="size-3.5" />
                  </button>
                  {item.userId === meId ? (
                    <button
                      onClick={() =>
                        setDraft({
                          id: item.id,
                          title: item.title,
                          content: item.content,
                          tags: item.tags.join(", "),
                          kind: item.kind,
                          isShared: item.isShared,
                        })
                      }
                      className="rounded-md p-1.5 text-slate-500 hover:bg-white/5 hover:text-slate-200"
                      title="编辑"
                    >
                      <Pencil className="size-3.5" />
                    </button>
                  ) : null}
                  {item.userId === meId ? (
                    <button
                      onClick={() => remove(item)}
                      className="rounded-md p-1.5 text-slate-500 hover:bg-rose-500/10 hover:text-rose-300"
                      title="删除"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  ) : null}
                </div>
              </div>

              <p className="mt-2 line-clamp-3 flex-1 text-[12.5px] leading-6 text-slate-400">
                {item.content}
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <Badge>{KIND_LABEL[item.kind]}</Badge>
                {item.tags.slice(0, 4).map((tag) => (
                  <Badge key={tag} tone="brand">
                    {tag}
                  </Badge>
                ))}
                <span className="ml-auto flex items-center gap-1 text-[11px] text-slate-500">
                  <Users className="size-3" />
                  {item.authorName || "同事"} · 用 {item.useCount} 次
                </span>
              </div>
            </article>
          ))}
        </div>
      )}

      <Modal
        open={Boolean(draft)}
        onClose={() => setDraft(null)}
        title={draft?.id ? "编辑提示词" : "新建提示词"}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDraft(null)}>
              取消
            </Button>
            <Button loading={saving} onClick={save}>
              保存
            </Button>
          </>
        }
      >
        {draft ? (
          <div className="space-y-4">
            <Field label="标题">
              <Input
                value={draft.title}
                onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                placeholder="例如：电影感人物特写"
                maxLength={80}
              />
            </Field>
            <Field label="提示词内容">
              <Textarea
                rows={6}
                value={draft.content}
                onChange={(event) => setDraft({ ...draft, content: event.target.value })}
                placeholder="完整的提示词，越具体越稳定…"
                maxLength={7000}
              />
            </Field>
            <Field label="标签" hint="逗号分隔，最多 8 个">
              <Input
                value={draft.tags}
                onChange={(event) => setDraft({ ...draft, tags: event.target.value })}
                placeholder="人像, 电影感, 逆光"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="适用类型">
                <div className="flex gap-2">
                  {(
                    [
                      ["any", "通用"],
                      ["video", "视频"],
                      ["image", "图片"],
                    ] as const
                  ).map(([value, label]) => (
                    <Chip
                      key={value}
                      active={draft.kind === value}
                      onClick={() => setDraft({ ...draft, kind: value })}
                    >
                      {label}
                    </Chip>
                  ))}
                </div>
              </Field>
              <label className="flex cursor-pointer items-center justify-between self-end rounded-xl border border-white/10 bg-black/20 px-3 py-2.5">
                <span className="text-[13px] text-slate-300">共享给同事</span>
                <input
                  type="checkbox"
                  checked={draft.isShared}
                  onChange={(event) =>
                    setDraft({ ...draft, isShared: event.target.checked })
                  }
                  className="size-4 accent-[#7c6cff]"
                />
              </label>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
