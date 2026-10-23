"use client";

import clsx from "clsx";
import { formatElapsed } from "@/lib/format";
import { STATUS_CLASS, STATUS_LABEL, timerStart } from "@/lib/status";
import type { Alert, Section, Staff, Table } from "@/lib/types";
import { alertTitle } from "@/lib/alerts";

/** The list form of the floor: one card per table, like the video's M5 Available / M4 14:15 panel. */
export function TableList({ tables, sections, staff, alerts, nextUpId, now, onSelect }: { tables: Table[]; sections: Section[]; staff: Staff[]; alerts: Alert[]; nextUpId: string | null; now: number; onSelect: (id: string) => void }) {
  const bySection = sections.map((s) => ({ section: s, tables: tables.filter((t) => t.sectionId === s.id) })).filter((g) => g.tables.length);
  return (
    <div className="flex flex-col gap-6">
      {bySection.map(({ section, tables: ts }) => {
        const server = section.serverId ? staff.find((x) => x.id === section.serverId) : null;
        return (
          <section key={section.id} className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between">
              <h3 className="text-sm font-extrabold tracking-tight">{section.name}</h3>
              <span className="text-xs font-semibold text-ink-3">{server ? `${server.name} serving` : "No server assigned"}</span>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {ts.map((t) => {
                const c = STATUS_CLASS[t.status];
                const elapsed = now - timerStart(t);
                const open = alerts.filter((a) => a.tableId === t.id && !a.resolvedAt);
                const esc = open.some((a) => a.escalatedAt);
                const nextUp = nextUpId === t.id;
                return (
                  <button key={t.id} type="button" onClick={() => onSelect(t.id)} className="card flex items-center gap-3.5 p-3.5 text-left transition-colors hover:bg-surface-2">
                    <span className={clsx("relative grid h-13 w-13 shrink-0 place-items-center rounded-full border-[3px] text-[15px] font-bold tracking-tight", c.border, c.bg, open.length && "ring-pulse")} style={{ width: 52, height: 52, borderStyle: t.status === "held" ? "dashed" : "solid" }}>
                      {nextUp && <span className="pointer-events-none absolute -inset-2 rounded-full border-2 border-next opacity-50" aria-hidden="true" />}
                      {t.label}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={clsx("block text-[11px] font-extrabold uppercase tracking-wider", c.text)}>{nextUp ? "Next up" : STATUS_LABEL[t.status]}</span>
                      <span className="block truncate text-[13px] text-ink-2">
                        {t.status === "seated" ? `${t.partyName ? `${t.partyName} · ` : ""}party of ${t.partySize ?? "?"}` : `${t.seats} seats`}
                        {t.note ? ` · ${t.note}` : ""}
                      </span>
                      {open.length > 0 && (
                        <span className={clsx("mt-1 flex items-center gap-1.5 text-xs font-semibold", esc ? "text-seated" : "text-cleaning")}>
                          <span className={clsx("h-2 w-2 rounded-full", esc ? "bg-seated" : "bg-cleaning")} />
                          {alertTitle(open[0].type)} · {formatElapsed(now - open[0].createdAt)}
                        </span>
                      )}
                    </span>
                    <span className={clsx("timer text-2xl", t.status === "free" ? "text-ink-3" : t.status === "seated" ? "text-ink" : c.text)}>{t.status === "free" && elapsed < 60_000 ? "" : formatElapsed(elapsed)}</span>
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
