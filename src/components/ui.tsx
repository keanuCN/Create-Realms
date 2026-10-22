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
  primary: "btn-primary text-white",
  secondary: "btn-secondary",
  ghost: "btn-ghost",
  danger: "btn-danger",
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
        "btn-base lift inline-flex select-none items-center justify-center font-medium outline-none transition focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:transform-none",
        buttonVariants[variant],
        buttonSizes[size],
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : null}
      <span className="relative inline-flex items-center gap-1.5">{children}</span>
    </button>
  );
}

/* ----------------------------- Inputs ----------------------------- */

const fieldBase = "field-control w-full rounded-xl outline-none transition-all duration-200";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(fieldBase, "h-10 px-3.5 text-sm", className)} {...props} />;
}

export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea className={cn(fieldBase, "resize-none px-3.5 py-3 text-sm leading-6", className)} {...props} />
  );
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(fieldBase, "h-10 appearance-none px-3.5 text-sm", className)} {...props} />
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
        "chip lift rounded-lg border px-3 py-1.5 text-[13px] transition-all duration-200",
        className,
      )}
      data-active={active}
      {...props}
    >
      {children}
    </button>
  );
}

/* --------------------------- Segmented ---------------------------- */

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: { value: T; label: ReactNode }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  const index = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  return (
    <div
      className={cn(
        "segment-control relative grid rounded-xl border p-1",
        className,
      )}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      <span
        aria-hidden
        className="segment-thumb absolute inset-y-1 rounded-lg transition-transform duration-[350ms]"
        style={{
          width: `calc((100% - 0.5rem) / ${options.length})`,
          left: "0.25rem",
          transform: `translateX(${index * 100}%)`,
          transitionTimingFunction: "cubic-bezier(.22,.61,.36,1)",
        }}
      />
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              "relative z-10 flex h-9 items-center justify-center gap-2 rounded-lg text-[13px] font-medium transition-colors duration-300",
              active ? "text-white" : "text-slate-500 hover:text-slate-300",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------ Switch ---------------------------- */

export function Switch({
  checked,
  onChange,
  disabled,
  className,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("switch", disabled && "opacity-50", className)}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="knob" />
    </span>
  );
}

/* --------------------------- Range slider -------------------------- */

export function RangeSlider({
  min,
  max,
  step = 1,
  value,
  onChange,
  suffix = "s",
  minLabel,
  maxLabel,
  valueLabel,
  className,
}: {
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (value: number) => void;
  suffix?: string;
  /** 可选：当滑块表示「第几档」而不是数值本身时，自定义显示文案 */
  minLabel?: string;
  maxLabel?: string;
  valueLabel?: string;
  className?: string;
}) {
  const safeMin = Math.min(min, max);
  const safeMax = Math.max(min, max);
  const safeRange = safeMax - safeMin;
  const percent = safeRange > 0 ? ((value - safeMin) / safeRange) * 100 : 100;
  const ticks = safeRange > 0 && step > 0 ? Math.round(safeRange / step) : 0;

  return (
    <div className={cn("select-none", className)}>
      <div className="relative flex h-9 items-center">
        <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-white/[0.09]" />
        <div
          className="absolute left-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-gradient-to-r from-[#7c6cff] to-[#4de2c0] shadow-[0_0_14px_-2px_rgba(124,108,255,.9)]"
          style={{ width: `${percent}%` }}
        />
        {/* 刻度点 */}
        {ticks > 0 && ticks <= 24
          ? Array.from({ length: ticks + 1 }).map((_, index) => (
              <span
                key={index}
                className="absolute top-1/2 size-1 -translate-y-1/2 rounded-full bg-white/20"
                style={{ left: `calc(${(index / ticks) * 100}% - 2px)` }}
              />
            ))
          : null}
        <input
          type="range"
          min={safeMin}
          max={safeMax}
          step={step}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          aria-label="时长"
          className="absolute inset-x-0 top-1/2 h-9 w-full -translate-y-1/2 cursor-grab appearance-none bg-transparent outline-none active:cursor-grabbing [&::-moz-range-thumb]:size-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-white [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-[0_0_0_4px_rgba(124,108,255,.35),0_6px_16px_-4px_rgba(0,0,0,.9)] [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-110"
        />
      </div>
      <div className="flex items-center justify-between text-[10px] text-slate-500">
        <span>{minLabel ?? `${safeMin}${suffix}`}</span>
        <span className="rounded-md border border-[#7c6cff]/30 bg-[#7c6cff]/10 px-1.5 py-0.5 font-medium text-[#bdb3ff]">
          {valueLabel ?? `${value}${suffix}`}
        </span>
        <span>{maxLabel ?? `${safeMax}${suffix}`}</span>
      </div>
    </div>
  );
}

/* ------------------------------ Badge ----------------------------- */

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
    success: "bg-emerald-500/10 text-emerald-300 border-emerald-500/25",
    warning: "bg-amber-500/10 text-amber-300 border-amber-500/25",
    danger: "bg-rose-500/10 text-rose-300 border-rose-500/25",
    brand: "bg-[#7c6cff]/12 text-[#bdb3ff] border-[#7c6cff]/30",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium backdrop-blur-sm",
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

/** Uiverse 风格的环形渐变加载器，用于「生成中」状态 */
export function OrbitLoader({ className }: { className?: string }) {
  return <span className={cn("orbit", className)} aria-label="加载中" role="status" />;
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
    <div className="animate-fade-up flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-white/12 bg-white/[0.015] px-6 py-16 text-center">
      {icon ? (
        <div className="float-slow grid size-14 place-items-center rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.08] to-transparent text-[#a99cff]">
          {icon}
        </div>
      ) : null}
      <p className="text-sm font-medium text-slate-200">{title}</p>
      {description ? <p className="max-w-sm text-xs leading-6 text-slate-500">{description}</p> : null}
      {action}
    </div>
  );
}

/* ------------------------------ Modal ----------------------------- */

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
        className="animate-backdrop-in absolute inset-0 bg-black/75 backdrop-blur-[3px]"
        onClick={onClose}
        aria-hidden
      />
      <div
        className={cn(
          "animate-pop-in panel relative z-10 max-h-[90vh] w-full overflow-auto p-6",
          wide ? "max-w-4xl" : "max-w-lg",
        )}
      >
        <button
          onClick={onClose}
          className="tip absolute right-4 top-4 rounded-lg p-1 text-slate-400 transition hover:bg-white/5 hover:text-white"
          data-tip="关闭 (Esc)"
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

/* ------------------------------ Toast ----------------------------- */

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
    }, 4200);
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
              "animate-toast-in pointer-events-auto relative flex items-start gap-2 overflow-hidden rounded-xl border px-4 py-3 text-sm shadow-2xl backdrop-blur-md",
              item.tone === "success" &&
                "border-emerald-500/30 bg-emerald-950/85 text-emerald-100",
              item.tone === "error" && "border-rose-500/30 bg-rose-950/85 text-rose-100",
              item.tone === "info" && "border-white/12 bg-[#151b27]/95 text-slate-100",
            )}
          >
            {item.tone === "success" ? <Check className="mt-0.5 size-4 shrink-0" /> : null}
            <span className="leading-5">{item.message}</span>
            <span
              aria-hidden
              className={cn(
                "absolute inset-x-0 bottom-0 h-0.5 origin-left",
                item.tone === "success" && "bg-emerald-400/70",
                item.tone === "error" && "bg-rose-400/70",
                item.tone === "info" && "bg-[#7c6cff]/70",
              )}
              style={{ animation: "toast-bar 4.2s linear forwards" }}
            />
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
