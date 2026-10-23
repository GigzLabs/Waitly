"use client";

import clsx from "clsx";
import { BarChart3, BellRing, LayoutGrid, ListOrdered, Moon, Settings, Sun, Users, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, type ReactNode } from "react";
import { useNow, useWaitly } from "@/lib/client";
import { formatClock } from "@/lib/format";
import { Mark } from "./logo";
import { Dot, Pill } from "./ui";

const NAV = [
  { href: "/app/floor", label: "Floor", icon: LayoutGrid },
  { href: "/app/alerts", label: "Alerts", icon: BellRing },
  { href: "/app/waitlist", label: "Waitlist", icon: ListOrdered },
  { href: "/app/insights", label: "Insights", icon: BarChart3 },
  { href: "/app/settings", label: "Settings", icon: Settings },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { snapshot, connected, staff, setStaffId, toasts, dismissToast, theme, setTheme } = useWaitly();
  const now = useNow(1000);

  const openAlerts = useMemo(() => snapshot?.alerts.filter((a) => !a.resolvedAt) ?? [], [snapshot]);
  const seated = snapshot?.tables.filter((t) => t.status === "seated").length ?? 0;
  const total = snapshot?.tables.length ?? 0;
  const waiting = snapshot?.parties.filter((p) => p.status === "waiting" || p.status === "notified").length ?? 0;

  return (
    <div className="flex min-h-full flex-1 flex-col md:flex-row">
      {/* Rail (tablet and desktop) */}
      <nav className="hidden w-[88px] shrink-0 flex-col items-center gap-1 border-r border-border bg-surface py-4 md:flex" aria-label="Main">
        <Link href="/" className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl text-brand" aria-label="Waitly home">
          <Mark size={30} />
        </Link>
        {NAV.map((n) => {
          const active = pathname.startsWith(n.href);
          const badge = n.href === "/app/alerts" ? openAlerts.length : n.href === "/app/waitlist" ? waiting : 0;
          return (
            <Link
              key={n.href}
              href={n.href}
              className={clsx("relative flex w-[72px] flex-col items-center gap-1 rounded-2xl py-2.5 text-[11px] font-bold transition-colors", active ? "bg-brand-soft text-brand" : "text-ink-3 hover:bg-surface-2 hover:text-ink")}
              aria-current={active ? "page" : undefined}
            >
              <n.icon size={22} strokeWidth={1.75} />
              {n.label}
              {badge > 0 && <span className={clsx("tnum absolute right-2.5 top-1.5 min-w-5 rounded-full px-1.5 py-0.5 text-center text-[10px] font-extrabold", n.href === "/app/alerts" ? "bg-cleaning text-[#0b1220]" : "bg-brand text-on-brand")}>{badge}</span>}
            </Link>
          );
        })}
        <div className="mt-auto flex flex-col items-center gap-2">
          <button className="btn btn-ghost h-10 w-10 !p-0" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}>
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </nav>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-bg/85 px-4 backdrop-blur md:h-16 md:px-6" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
          <Link href="/" className="flex items-center gap-2 md:hidden" aria-label="Waitly home">
            <Mark size={24} className="text-brand" />
          </Link>
          <div className="min-w-0">
            <div className="truncate text-sm font-extrabold tracking-tight md:text-base">{snapshot?.settings.venueName ?? "Waitly"}</div>
            <div className="hidden text-[11px] font-semibold text-ink-3 md:block">
              {now ? `${formatClock(now)} · ${new Date(now).toLocaleDateString(undefined, { weekday: "long" })}` : ""}
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Pill tone={seated ? "seated" : "neutral"}>
              <Dot className={seated ? "bg-seated" : "bg-ink-3"} />
              <span className="tnum">
                {seated}/{total} seated
              </span>
            </Pill>
            {openAlerts.length > 0 && (
              <Link href="/app/alerts" className="pill !border-transparent !bg-cleaning-soft !text-cleaning">
                <Dot className="bg-cleaning" />
                <span className="tnum">{openAlerts.length} alert{openAlerts.length === 1 ? "" : "s"}</span>
              </Link>
            )}
            <Pill className="hidden sm:inline-flex">
              <Dot className={connected ? "bg-free" : "bg-ink-3"} />
              {connected ? "Live" : "Reconnecting"}
            </Pill>
            <label className="hidden items-center gap-2 md:flex">
              <Users size={16} className="text-ink-3" />
              <select className="input h-9 w-auto !px-2 text-sm" value={staff?.id ?? ""} onChange={(e) => setStaffId(e.target.value || null)} aria-label="Who is on the stand">
                <option value="">Who are you?</option>
                {snapshot?.staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} · {s.role}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </header>

        <main className="flex min-w-0 flex-1 flex-col px-4 pb-24 pt-4 md:px-6 md:pb-8 md:pt-6" style={{ paddingLeft: "max(16px, env(safe-area-inset-left, 0px))", paddingRight: "max(16px, env(safe-area-inset-right, 0px))" }}>
          {children}
        </main>
      </div>

      {/* Tab bar (phones) */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-surface/95 backdrop-blur md:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }} aria-label="Main">
        {NAV.map((n) => {
          const active = pathname.startsWith(n.href);
          const badge = n.href === "/app/alerts" ? openAlerts.length : n.href === "/app/waitlist" ? waiting : 0;
          return (
            <Link key={n.href} href={n.href} className={clsx("relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-bold", active ? "text-brand" : "text-ink-3")} aria-current={active ? "page" : undefined}>
              <n.icon size={22} strokeWidth={1.75} />
              {n.label}
              {badge > 0 && <span className={clsx("tnum absolute left-1/2 top-0.5 ml-2 min-w-4 rounded-full px-1 text-center text-[9px] font-extrabold", n.href === "/app/alerts" ? "bg-cleaning text-[#0b1220]" : "bg-brand text-on-brand")}>{badge}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Toasts */}
      <div className="pointer-events-none fixed inset-x-0 top-16 z-40 flex flex-col items-center gap-2 px-4 md:top-20 md:items-end md:px-6" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={clsx("rise-in pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border bg-surface p-3 shadow-md", t.tone === "alert" ? "border-cleaning/50" : t.tone === "danger" ? "border-seated/50" : "border-border")}>
            <span className={clsx("mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full", t.tone === "alert" ? "bg-cleaning" : t.tone === "danger" ? "bg-seated" : t.tone === "success" ? "bg-free" : "bg-brand")} />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold">{t.title}</div>
              {t.body && <div className="text-xs text-ink-2">{t.body}</div>}
            </div>
            <button className="text-ink-3 hover:text-ink" onClick={() => dismissToast(t.id)} aria-label="Dismiss">
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
