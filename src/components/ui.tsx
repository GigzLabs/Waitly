"use client";

import clsx from "clsx";
import { X } from "lucide-react";
import { useEffect, type ReactNode } from "react";

export function Pill({ tone, children, className }: { tone?: "free" | "seated" | "cleaning" | "next" | "held" | "neutral"; children: ReactNode; className?: string }) {
  const t = tone ?? "neutral";
  return (
    <span
      className={clsx(
        "pill",
        t === "seated" && "!border-transparent !bg-seated-soft !text-seated",
        t === "free" && "!border-transparent !bg-free-soft !text-free",
        t === "cleaning" && "!border-transparent !bg-cleaning-soft !text-cleaning",
        t === "next" && "!border-transparent !bg-next-soft !text-next",
        t === "held" && "!border-transparent !bg-held-soft !text-held",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Dot({ className }: { className?: string }) {
  return <span className={clsx("inline-block h-2 w-2 rounded-full", className)} aria-hidden="true" />;
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx("eyebrow", className)}>{children}</div>;
}

export function Empty({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border-strong px-6 py-12 text-center">
      <div className="text-xl font-bold tracking-tight">{title}</div>
      {body && <p className="max-w-sm text-sm text-ink-2">{body}</p>}
      {action}
    </div>
  );
}

export function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: "free" | "seated" | "cleaning" | "next" }) {
  return (
    <div className="card flex flex-col gap-1 p-4">
      <div className="eyebrow">{label}</div>
      <div className={clsx("tnum text-2xl font-extrabold tracking-tight", tone === "free" && "text-free", tone === "seated" && "text-seated", tone === "cleaning" && "text-cleaning", tone === "next" && "text-next")}>{value}</div>
      {hint && <div className="text-xs text-ink-3">{hint}</div>}
    </div>
  );
}

export function Segmented<T extends string>({ value, onChange, options, className }: { value: T; onChange: (v: T) => void; options: Array<{ value: T; label: ReactNode }>; className?: string }) {
  return (
    <div className={clsx("inline-flex h-10 items-center gap-1 rounded-xl border border-border bg-surface-2 p-1", className)} role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={o.value === value}
          onClick={() => onChange(o.value)}
          className={clsx("h-8 rounded-lg px-3 text-sm font-semibold transition-colors", o.value === value ? "bg-surface text-ink shadow-sm" : "text-ink-2 hover:text-ink")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Slide-over on tablet and desktop, bottom sheet on phones. */
export function Sheet({ open, onClose, title, eyebrow, children, footer, wide }: { open: boolean; onClose: () => void; title?: ReactNode; eyebrow?: ReactNode; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
      <button aria-label="Close" className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div
        className={clsx(
          "absolute flex flex-col bg-surface shadow-lg",
          "inset-x-0 bottom-0 max-h-[88vh] rounded-t-3xl",
          "md:inset-y-0 md:right-0 md:left-auto md:max-h-none md:rounded-none md:rounded-l-3xl md:border-l md:border-border",
          wide ? "md:w-[560px]" : "md:w-[440px]",
        )}
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-3">
          <div className="min-w-0">
            {eyebrow && <div className="eyebrow mb-1">{eyebrow}</div>}
            {title && <h2 className="text-2xl font-bold tracking-tight">{title}</h2>}
          </div>
          <button className="btn btn-ghost -mr-2 h-10 w-10 !p-0" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>
        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-5 pb-5">{children}</div>
        {footer && <div className="border-t border-border px-5 py-4">{footer}</div>}
      </div>
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-bold tracking-wide text-ink-2">{label}</span>
      {children}
      {hint && <span className="text-xs text-ink-3">{hint}</span>}
    </label>
  );
}

export function Stepper({ value, onChange, min = 1, max = 20, label }: { value: number; onChange: (v: number) => void; min?: number; max?: number; label?: string }) {
  return (
    <div className="inline-flex h-12 items-center rounded-xl border border-border-strong bg-surface" aria-label={label}>
      <button type="button" className="h-full w-12 text-lg font-bold text-ink-2 hover:text-ink" onClick={() => onChange(Math.max(min, value - 1))} aria-label="Fewer">
        −
      </button>
      <span className="tnum w-10 text-center text-lg font-extrabold">{value}</span>
      <button type="button" className="h-full w-12 text-lg font-bold text-ink-2 hover:text-ink" onClick={() => onChange(Math.min(max, value + 1))} aria-label="More">
        +
      </button>
    </div>
  );
}
