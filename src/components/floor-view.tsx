"use client";

import clsx from "clsx";
import { ArrowUpRight, BellRing, ListOrdered } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { alertTitle, compareAlerts } from "@/lib/alerts";
import { useNow, useWaitly } from "@/lib/client";
import { formatElapsed, formatMinutes } from "@/lib/format";
import { FloorMap } from "./floor-map";
import { TableList } from "./table-list";
import { TableSheet } from "./table-sheet";
import { Empty, Segmented } from "./ui";

type Filter = "all" | "seated" | "free" | "cleaning" | "alerts";

export function FloorView() {
  const { snapshot, connected } = useWaitly();
  const now = useNow(1000);
  const [view, setView] = useState<"map" | "list">("map");
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<string | null>(null);

  const openAlerts = useMemo(() => (snapshot?.alerts ?? []).filter((a) => !a.resolvedAt).sort(compareAlerts), [snapshot]);
  const nextUp = useMemo(() => snapshot?.predictions.find((p) => p.status === "seated" || p.status === "cleaning") ?? null, [snapshot]);
  const waiting = useMemo(() => (snapshot?.parties ?? []).filter((p) => p.status === "waiting" || p.status === "notified").sort((a, b) => a.joinedAt - b.joinedAt), [snapshot]);

  if (!snapshot || !now) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm font-semibold text-ink-3">{connected ? "Loading the floor…" : "Connecting to the floor…"}</div>
    );
  }

  const tables = snapshot.tables;
  const counts = {
    seated: tables.filter((t) => t.status === "seated").length,
    free: tables.filter((t) => t.status === "free").length,
    cleaning: tables.filter((t) => t.status === "cleaning").length,
    alerts: new Set(openAlerts.filter((a) => a.tableId).map((a) => a.tableId)).size,
  };
  const alertTableIds = new Set(openAlerts.map((a) => a.tableId));
  const visible = tables.filter((t) => (filter === "all" ? true : filter === "alerts" ? alertTableIds.has(t.id) : t.status === filter));
  const nextUpId = nextUp && (nextUp.status === "seated" || nextUp.status === "cleaning") && counts.free === 0 ? nextUp.tableId : nextUp && waiting.length > 0 ? nextUp.tableId : null;

  return (
    <div className="flex flex-1 flex-col gap-4 lg:flex-row lg:gap-6">
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Segmented value={view} onChange={setView} options={[{ value: "map", label: "Map" }, { value: "list", label: "List" }]} />
          <div className="scroll-thin -mx-1 flex gap-1.5 overflow-x-auto px-1">
            {(
              [
                ["all", `All ${tables.length}`],
                ["seated", `Seated ${counts.seated}`],
                ["free", `Free ${counts.free}`],
                ["cleaning", `To clean ${counts.cleaning}`],
                ["alerts", `Alerts ${counts.alerts}`],
              ] as Array<[Filter, string]>
            ).map(([f, label]) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={clsx(
                  "pill h-8 !px-3 transition-colors",
                  filter === f && f === "seated" && "!border-transparent !bg-seated-soft !text-seated",
                  filter === f && f === "free" && "!border-transparent !bg-free-soft !text-free",
                  filter === f && f === "cleaning" && "!border-transparent !bg-cleaning-soft !text-cleaning",
                  filter === f && f === "alerts" && "!border-transparent !bg-cleaning-soft !text-cleaning",
                  filter === f && f === "all" && "!border-transparent !bg-brand-soft !text-brand",
                )}
                aria-pressed={filter === f}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {view === "map" ? (
          <FloorMap tables={visible} sections={snapshot.sections} alerts={openAlerts} nextUpId={nextUpId} now={now} selectedId={selected} onSelect={setSelected} />
        ) : visible.length ? (
          <TableList tables={visible} sections={snapshot.sections} staff={snapshot.staff} alerts={openAlerts} nextUpId={nextUpId} now={now} onSelect={setSelected} />
        ) : (
          <Empty title="Nothing here" body="No tables match this filter right now." />
        )}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-semibold text-ink-3">
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-free" /> Free</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-seated" /> Seated, timer since arrival</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-cleaning" /> Needs cleaning</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full border-2 border-next" /> Next free table</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full border-2 border-dashed border-held" /> Held</span>
        </div>
      </div>

      {/* Side panel: what needs attention and who is next */}
      <aside className="flex w-full shrink-0 flex-col gap-4 lg:w-[340px]">
        <section className="card flex flex-col gap-3 p-4">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-extrabold tracking-tight">
              <BellRing size={16} className="text-cleaning" /> Needs attention
            </h2>
            <Link href="/app/alerts" className="text-xs font-bold text-brand hover:underline">
              All alerts
            </Link>
          </div>
          {openAlerts.length === 0 ? (
            <p className="text-sm text-ink-2">Every table has been greeted and every free table is clean.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {openAlerts.slice(0, 5).map((a) => {
                const t = a.tableId ? tables.find((x) => x.id === a.tableId) : null;
                const p = a.partyId ? snapshot.parties.find((x) => x.id === a.partyId) : null;
                return (
                  <li key={a.id}>
                    <button onClick={() => (t ? setSelected(t.id) : undefined)} className="flex w-full items-center gap-3 rounded-xl border border-border px-3 py-2 text-left hover:bg-surface-2">
                      <span className={clsx("h-2.5 w-2.5 shrink-0 rounded-full", a.escalatedAt ? "bg-seated" : "bg-cleaning")} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold">
                          {t ? `Table ${t.label}` : p ? p.name : "Floor"} · <span className={a.escalatedAt ? "text-seated" : "text-cleaning"}>{alertTitle(a.type)}</span>
                        </span>
                        <span className="block truncate text-xs text-ink-2">{a.message}</span>
                      </span>
                      <span className="tnum text-xs font-bold text-ink-2">{formatElapsed(now - a.createdAt)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="card flex flex-col gap-3 p-4">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-extrabold tracking-tight">
              <ArrowUpRight size={16} className="text-next" /> Next free table
            </h2>
            <Link href="/app/waitlist" className="text-xs font-bold text-brand hover:underline">
              Waitlist
            </Link>
          </div>
          {counts.free > 0 && waiting.length === 0 ? (
            <p className="text-sm text-ink-2">
              {counts.free} table{counts.free === 1 ? " is" : "s are"} free now. No one is waiting.
            </p>
          ) : nextUp ? (
            <button onClick={() => setSelected(nextUp.tableId)} className="flex items-center gap-3 rounded-xl border border-next/40 bg-next-soft px-3 py-2.5 text-left">
              <span className={clsx("relative grid h-11 w-11 place-items-center rounded-full border-[3px] bg-surface text-sm font-bold", nextUp.status === "cleaning" ? "border-cleaning" : "border-seated")}>
                <span className="pointer-events-none absolute -inset-1.5 rounded-full border-2 border-next opacity-60" />
                {nextUp.label}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-next">{nextUp.etaMin <= 0.5 ? "Any moment" : `In about ${formatMinutes(nextUp.etaMin)}`}</span>
                <span className="block truncate text-xs text-ink-2">{nextUp.reason}</span>
              </span>
            </button>
          ) : (
            <p className="text-sm text-ink-2">No tables are seated.</p>
          )}
          {waiting.length > 0 && (
            <div className="flex items-center gap-2 text-xs font-semibold text-ink-2">
              <ListOrdered size={14} /> {waiting.length} part{waiting.length === 1 ? "y" : "ies"} waiting · first joined {formatElapsed(now - waiting[0].joinedAt)} ago
            </div>
          )}
        </section>
      </aside>

      <TableSheet tableId={selected} now={now} onClose={() => setSelected(null)} />
    </div>
  );
}
