"use client";

import clsx from "clsx";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { Check, Loader2, X } from "lucide-react";

export function cn(...values: Array<string | false | null | undefined>) {
  return clsx(values);
}

/* ----------------------------- Button ----------------------------- */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    "bg-[#7c6cff] text-white hover:bg-[#8b7dff] active:bg-[#6a56f5] shadow-[0_8px_24px_-10px_rgba(124,108,255,.8)]",
  secondary:
    "bg-white/[0.06] text-slate-100 hover:bg-white/[0.1] border border-white/10",
  ghost: "text-slate-300 hover:text-white hover:bg-white/[0.06]",
  danger: "bg-rose-500/15 text-rose-300 hover:bg-rose-500/25 border border-rose-500/20",
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-[13px] rounded-lg gap-1.5",
  md: "h-10 px-4 text-sm rounded-xl gap-2",
  lg: "h-12 px-5 text-[15px] rounded-xl gap-2",
};

export function Button({
  variant = "primary",
  size = "md",
  loading,
  className,
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        buttonVariants[variant],
        buttonSizes[size],
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : null}
      {children}
    </button>
  );
}

/* ----------------------------- Inputs ----------------------------- */

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-10 w-full rounded-xl border border-white/10 bg-black/25 px-3.5 text-sm text-slate-100 placeholder:text-slate-500 outline-none transition focus:border-[#7c6cff]/70 focus:ring-2 focus:ring-[#7c6cff]/20",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "w-full resize-none rounded-xl border border-white/10 bg-black/25 px-3.5 py-3 text-sm leading-6 text-slate-100 placeholder:text-slate-500 outline-none transition focus:border-[#7c6cff]/70 focus:ring-2 focus:ring-[#7c6cff]/20",
        className,
      )}
      {...props}
    />
  );
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-10 w-full appearance-none rounded-xl border border-white/10 bg-black/25 px-3.5 text-sm text-slate-100 outline-none transition focus:border-[#7c6cff]/70",
        className,
      )}
      {...props}
    />
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-[13px] font-medium text-slate-300">{label}</label>
        {hint ? <span className="text-[11px] text-slate-500">{hint}</span> : null}
      </div>
      {children}
    </div>
  );
}

export function Chip({
  active,
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      className={cn(
        "rounded-lg border px-3 py-1.5 text-[13px] transition",
        active
          ? "border-[#7c6cff]/60 bg-[#7c6cff]/15 text-white"
          : "border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/20 hover:text-slate-200",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

/* ----------------------------- Badge ----------------------------- */

export function Badge({
  tone = "default",
  children,
  className,
}: {
  tone?: "default" | "success" | "warning" | "danger" | "brand";
  children: ReactNode;
  className?: string;
}) {
  const tones: Record<string, string> = {
    default: "bg-white/[0.06] text-slate-300 border-white/10",
    success: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
    warning: "bg-amber-500/10 text-amber-300 border-amber-500/20",
    danger: "bg-rose-500/10 text-rose-300 border-rose-500/20",
    brand: "bg-[#7c6cff]/12 text-[#b4a8ff] border-[#7c6cff]/25",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("size-4 animate-spin", className)} />;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-white/10 px-6 py-16 text-center">
      {icon ? <div className="text-slate-500">{icon}</div> : null}
      <p className="text-sm font-medium text-slate-300">{title}</p>
      {description ? <p className="max-w-sm text-xs text-slate-500">{description}</p> : null}
      {action}
    </div>
  );
}

/* ----------------------------- Modal ----------------------------- */

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div
        className={cn(
          "relative z-10 max-h-[90vh] w-full overflow-auto rounded-2xl border border-white/10 bg-[#0f141d] p-6 shadow-2xl",
          wide ? "max-w-4xl" : "max-w-lg",
        )}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1 text-slate-400 transition hover:bg-white/5 hover:text-white"
          aria-label="关闭"
        >
          <X className="size-4" />
        </button>
        {title ? <h2 className="pr-8 text-lg font-semibold text-white">{title}</h2> : null}
        {description ? <p className="mt-1 text-sm text-slate-400">{description}</p> : null}
        <div className={cn(title || description ? "mt-4" : "")}>{children}</div>
        {footer ? <div className="mt-6 flex justify-end gap-2">{footer}</div> : null}
      </div>
    </div>
  );
}

/* ----------------------------- Toast ----------------------------- */

type ToastItem = { id: number; message: string; tone: "info" | "success" | "error" };
type ToastContextValue = {
  toast: (message: string, tone?: ToastItem["tone"]) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const toast = useCallback((message: string, tone: ToastItem["tone"] = "info") => {
    const id = ++idRef.current;
    setItems((prev) => [...prev, { id, message, tone }]);
    setTimeout(() => {
      setItems((prev) => prev.filter((item) => item.id !== id));
    }, 3800);
  }, []);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-6 left-1/2 z-[60] flex w-full max-w-sm -translate-x-1/2 flex-col gap-2 px-4">
        {items.map((item) => (
          <div
            key={item.id}
            className={cn(
              "pointer-events-auto flex items-start gap-2 rounded-xl border px-4 py-3 text-sm shadow-xl backdrop-blur",
              item.tone === "success" && "border-emerald-500/25 bg-emerald-950/80 text-emerald-100",
              item.tone === "error" && "border-rose-500/25 bg-rose-950/80 text-rose-100",
              item.tone === "info" && "border-white/10 bg-[#151b27]/95 text-slate-100",
            )}
          >
            {item.tone === "success" ? <Check className="mt-0.5 size-4 shrink-0" /> : null}
            <span className="leading-5">{item.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}
