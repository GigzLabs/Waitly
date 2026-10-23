"use client";

import clsx from "clsx";
import { BellRing, Check } from "lucide-react";
import { useMemo, useState } from "react";
import { alertActionLabel, alertTitle, compareAlerts } from "@/lib/alerts";
import { useNow, useWaitly } from "@/lib/client";
import { formatClock, formatElapsed } from "@/lib/format";
import type { Alert } from "@/lib/types";
import { TableSheet } from "./table-sheet";
import { Empty, Segmented, Stat } from "./ui";

/**
 * "You get an alert telling you exactly which table needs attention."
 * Open alerts first (escalated on top), one action each, then what was resolved recently.
 */
export function AlertsView() {
  const { snapshot, dispatch, staff } = useWaitly();
  const now = useNow(1000);
  const [tab, setTab] = useState<"open" | "resolved">("open");
  const [selected, setSelected] = useState<string | null>(null);

  const open = useMemo(() => (snapshot?.alerts ?? []).filter((a) => !a.resolvedAt).sort(compareAlerts), [snapshot]);
  const resolved = useMemo(() => (snapshot?.alerts ?? []).filter((a) => a.resolvedAt).sort((a, b) => (b.resolvedAt ?? 0) - (a.resolvedAt ?? 0)), [snapshot]);

  if (!snapshot) return <div className="text-sm font-semibold text-ink-3">Connecting…</div>;

  const escalated = open.filter((a) => a.escalatedAt).length;
  const noGreet = open.filter((a) => a.type === "no_greet").length;
  const cleaning = open.filter((a) => a.type === "needs_cleaning").length;

  const resolveWithAction = async (a: Alert) => {
    if (a.type === "no_greet" || a.type === "no_revisit") {
      if (a.tableId) await dispatch({ type: "serverArrived", tableId: a.tableId, staffId: staff?.id });
    } else if (a.type === "needs_cleaning") {
      if (a.tableId) await dispatch({ type: "markCleaned", tableId: a.tableId, staffId: staff?.id });
    } else if (a.type === "long_wait") {
      // Seating happens from the waitlist; here we only acknowledge.
      await dispatch({ type: "ackAlert", alertId: a.id, staffId: staff?.id });
    }
  };

  const where = (a: Alert) => {
    const t = a.tableId ? snapshot.tables.find((x) => x.id === a.tableId) : null;
    const p = a.partyId ? snapshot.parties.find((x) => x.id === a.partyId) : null;
    if (t) {
      const sec = snapshot.sections.find((s) => s.id === t.sectionId);
      const srv = (t.serverId ? snapshot.staff.find((s) => s.id === t.serverId) : null) ?? (sec?.serverId ? snapshot.staff.find((s) => s.id === sec.serverId) : null);
      return { title: `Table ${t.label}`, meta: [t.partySize ? `party of ${t.partySize}` : null, sec?.name, srv ? srv.name : "unassigned"].filter(Boolean).join(" · "), tableId: t.id };
    }
    if (p) return { title: p.name, meta: `party of ${p.size} · on the waitlist`, tableId: null };
    return { title: "Floor", meta: "", tableId: null };
  };

  return (
    <div className="flex flex-1 flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="eyebrow">No forgotten guest</div>
          <h1 className="text-3xl font-bold tracking-tight">Alerts</h1>
        </div>
        <Segmented value={tab} onChange={setTab} options={[{ value: "open", label: `Open ${open.length}` }, { value: "resolved", label: "Resolved" }]} />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Open now" value={open.length} tone={open.length ? "cleaning" : undefined} />
        <Stat label="Escalated" value={escalated} tone={escalated ? "seated" : undefined} hint="Past twice the threshold" />
        <Stat label="No server yet" value={noGreet} hint={`${snapshot.settings.greetSlaMin} min rule`} />
        <Stat label="To be cleaned" value={cleaning} hint={`${snapshot.settings.cleaningSlaMin} min to reset`} />
      </div>

      {tab === "open" ? (
        open.length === 0 ? (
          <Empty title="All quiet" body="Every seated table has been greeted and every free table is clean. New alerts appear here and on every device." />
        ) : (
          <ul className="flex flex-col gap-2">
            {open.map((a) => {
              const w = where(a);
              return (
                <li key={a.id} className={clsx("card flex items-center gap-3 p-3 md:p-4", a.escalatedAt && "border-seated/40")}>
                  <span className={clsx("h-3 w-3 shrink-0 rounded-full", a.escalatedAt ? "bg-seated" : "bg-cleaning", "ring-pulse")} aria-hidden="true" />
                  <button className="min-w-0 flex-1 text-left" onClick={() => w.tableId && setSelected(w.tableId)}>
                    <div className="truncate text-[15px] font-bold">
                      {w.title} · <span className={a.escalatedAt ? "text-seated" : "text-cleaning"}>{alertTitle(a.type)}</span>
                    </div>
                    <div className="truncate text-xs text-ink-2">
                      {a.message}
                      {w.meta ? ` · ${w.meta}` : ""}
                      {a.acknowledgedAt ? " · seen" : ""}
                    </div>
                  </button>
                  <span className="tnum hidden text-sm font-bold text-ink-2 sm:block">{formatElapsed(now - a.createdAt)}</span>
                  <button className="btn btn-primary btn-sm md:h-10 md:px-4 md:text-sm" onClick={() => resolveWithAction(a)}>
                    <Check size={16} /> {alertActionLabel(a.type)}
                  </button>
                </li>
              );
            })}
          </ul>
        )
      ) : resolved.length === 0 ? (
        <Empty title="Nothing resolved yet" body="Resolved alerts from the last day show here with how long they took." />
      ) : (
        <ul className="flex flex-col gap-2">
          {resolved.slice(0, 40).map((a) => {
            const w = where(a);
            const by = a.resolvedBy ? snapshot.staff.find((s) => s.id === a.resolvedBy)?.name : null;
            return (
              <li key={a.id} className="card flex items-center gap-3 p-3 opacity-80">
                <span className="h-3 w-3 shrink-0 rounded-full bg-ink-3" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold text-ink-2">
                    {w.title} · {alertTitle(a.type)}
                  </div>
                  <div className="truncate text-xs text-ink-3">
                    Resolved {formatClock(a.resolvedAt ?? 0)}
                    {by ? ` by ${by}` : ""} · took {formatElapsed((a.resolvedAt ?? 0) - a.createdAt)}
                  </div>
                </div>
                <BellRing size={16} className="text-ink-3" />
              </li>
            );
          })}
        </ul>
      )}

      <TableSheet tableId={selected} now={now} onClose={() => setSelected(null)} />
    </div>
  );
}
