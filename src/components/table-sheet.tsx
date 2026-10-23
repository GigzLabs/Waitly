"use client";

import clsx from "clsx";
import { CircleCheck, Hand, Sparkles, UserRound, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { alertTitle } from "@/lib/alerts";
import { useWaitly } from "@/lib/client";
import { formatClock, formatElapsed, formatMinutes } from "@/lib/format";
import { STATUS_CLASS, STATUS_LABEL, timerStart } from "@/lib/status";
import { Field, Sheet, Stepper } from "./ui";

/** Everything staff can do to one table, one tap each. */
export function TableSheet({ tableId, now, onClose }: { tableId: string | null; now: number; onClose: () => void }) {
  if (!tableId) return null;
  // Keyed by table so the form state starts fresh for every table.
  return <TableSheetBody key={tableId} tableId={tableId} now={now} onClose={onClose} />;
}

function TableSheetBody({ tableId, now, onClose }: { tableId: string; now: number; onClose: () => void }) {
  const { snapshot, dispatch, staff } = useWaitly();
  const table = snapshot?.tables.find((t) => t.id === tableId) ?? null;
  const [mode, setMode] = useState<"view" | "seat" | "note">("view");
  const [size, setSize] = useState(() => (table ? Math.min(2, table.seats) : 2));
  const [name, setName] = useState("");
  const [note, setNote] = useState(() => table?.note ?? "");
  const [busy, setBusy] = useState(false);

  const section = snapshot?.sections.find((s) => s.id === table?.sectionId);
  const server = useMemo(() => {
    if (!table || !snapshot) return null;
    const direct = table.serverId ? snapshot.staff.find((s) => s.id === table.serverId) : null;
    return direct ?? (section?.serverId ? snapshot.staff.find((s) => s.id === section.serverId) : null) ?? null;
  }, [table, snapshot, section]);
  const prediction = snapshot?.predictions.find((p) => p.tableId === table?.id);
  const alerts = snapshot?.alerts.filter((a) => a.tableId === table?.id && !a.resolvedAt) ?? [];
  const waiting = useMemo(() => (snapshot?.parties ?? []).filter((p) => (p.status === "waiting" || p.status === "notified") && table && p.size <= table.seats).sort((a, b) => a.joinedAt - b.joinedAt), [snapshot, table]);
  const suggestion = snapshot?.suggestions.find((s) => s.tableId === table?.id);

  if (!table) return null;
  const c = STATUS_CLASS[table.status];
  const elapsed = now - timerStart(table);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  const seatWalkIn = () =>
    run(async () => {
      const r = await dispatch({ type: "seat", tableId: table.id, size, name: name.trim() || undefined, staffId: staff?.id });
      if (r.ok) onClose();
    });
  const seatFromList = (partyId: string) =>
    run(async () => {
      const r = await dispatch({ type: "seatParty", partyId, tableId: table.id, staffId: staff?.id });
      if (r.ok) onClose();
    });

  return (
    <Sheet open={Boolean(tableId)} onClose={onClose} eyebrow={`${section?.name ?? "Floor"} · ${table.seats} seats`} title={`Table ${table.label}`}>
      <div className="flex flex-col gap-5">
        {/* Status */}
        <div className={clsx("flex items-center gap-4 rounded-2xl border p-4", c.border, c.bg)} style={{ borderStyle: table.status === "held" ? "dashed" : "solid" }}>
          <div className="min-w-0 flex-1">
            <div className={clsx("text-xs font-extrabold uppercase tracking-wider", c.text)}>{STATUS_LABEL[table.status]}</div>
            <div className="truncate text-sm font-semibold text-ink-2">
              {table.status === "seated" && (
                <>
                  {table.partyName ? `${table.partyName} · ` : ""}
                  {table.partySize ? `party of ${table.partySize}` : "party"}
                  {table.seatedAt ? ` · since ${formatClock(table.seatedAt)}` : ""}
                </>
              )}
              {table.status === "cleaning" && `Released ${formatClock(table.statusSince)}`}
              {table.status === "free" && (elapsed > 60_000 ? `Free since ${formatClock(table.statusSince)}` : "Ready for guests")}
              {table.status === "held" && `Held since ${formatClock(table.statusSince)}`}
            </div>
          </div>
          <div className={clsx("timer text-3xl", c.text)}>{table.status === "free" && elapsed < 60_000 ? "—" : formatElapsed(elapsed)}</div>
        </div>

        {alerts.length > 0 && (
          <div className="flex flex-col gap-2">
            {alerts.map((a) => (
              <div key={a.id} className={clsx("flex items-center gap-3 rounded-xl border px-3 py-2 text-sm", a.escalatedAt ? "border-seated/40 bg-seated-soft" : "border-cleaning/40 bg-cleaning-soft")}>
                <span className={clsx("h-2.5 w-2.5 rounded-full", a.escalatedAt ? "bg-seated" : "bg-cleaning")} />
                <div className="min-w-0 flex-1">
                  <div className={clsx("font-bold", a.escalatedAt ? "text-seated" : "text-cleaning")}>{alertTitle(a.type)}</div>
                  <div className="text-xs text-ink-2">{a.message}</div>
                </div>
                <span className="tnum text-xs font-bold text-ink-2">{formatElapsed(now - a.createdAt)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Service timeline for a seated table */}
        {table.status === "seated" && (
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div className="card p-3">
              <dt className="eyebrow">Server</dt>
              <dd className="mt-1 font-bold">{server ? server.name : "Unassigned"}</dd>
            </div>
            <div className="card p-3">
              <dt className="eyebrow">First visit</dt>
              <dd className={clsx("mt-1 font-bold", !table.greetedAt && "text-cleaning")}>{table.greetedAt ? `${formatClock(table.greetedAt)} · ${formatMinutes((table.greetedAt - (table.seatedAt ?? table.statusSince)) / 60000)} after seating` : "Not yet"}</dd>
            </div>
            <div className="card p-3">
              <dt className="eyebrow">Last visit</dt>
              <dd className="mt-1 font-bold">{table.lastVisitAt ? `${formatElapsed(now - table.lastVisitAt)} ago` : "—"}</dd>
            </div>
            <div className="card p-3">
              <dt className="eyebrow">Likely free in</dt>
              <dd className="mt-1 font-bold text-next">{prediction ? (prediction.etaMin <= 0.5 ? "Any moment" : `~${formatMinutes(prediction.etaMin)}`) : "—"}</dd>
              {prediction && <dd className="mt-0.5 text-[11px] text-ink-3">{prediction.reason}</dd>}
            </div>
          </dl>
        )}

        {/* Actions */}
        {mode === "view" && (
          <div className="flex flex-col gap-2">
            {table.status === "seated" && (
              <>
                <button className="btn btn-primary btn-lg" disabled={busy} onClick={() => run(() => dispatch({ type: "serverArrived", tableId: table.id, staffId: staff?.id }))}>
                  <UserRound size={18} /> {table.greetedAt ? "Server visited" : "Server arrived"}
                </button>
                <button className="btn btn-danger btn-lg" disabled={busy} onClick={() => run(async () => { const r = await dispatch({ type: "guestsLeft", tableId: table.id, staffId: staff?.id }); if (r.ok) onClose(); })}>
                  Guests left
                </button>
              </>
            )}
            {table.status === "cleaning" && (
              <button className="btn btn-primary btn-lg" disabled={busy} onClick={() => run(async () => { const r = await dispatch({ type: "markCleaned", tableId: table.id, staffId: staff?.id }); if (r.ok) onClose(); })}>
                <Sparkles size={18} /> Mark cleaned
              </button>
            )}
            {(table.status === "free" || table.status === "held" || table.status === "cleaning") && (
              <>
                {suggestion && (
                  <button className="btn btn-primary btn-lg" disabled={busy} onClick={() => seatFromList(suggestion.partyId)}>
                    <Users size={18} /> Seat {snapshot?.parties.find((p) => p.id === suggestion.partyId)?.name ?? "next party"} here
                  </button>
                )}
                <button className={clsx("btn btn-lg", suggestion ? "btn-secondary" : "btn-primary")} disabled={busy} onClick={() => setMode("seat")}>
                  <CircleCheck size={18} /> Seat party
                </button>
              </>
            )}
            {table.status === "free" && (
              <button className="btn btn-secondary" disabled={busy} onClick={() => run(() => dispatch({ type: "hold", tableId: table.id }))}>
                <Hand size={16} /> Hold table
              </button>
            )}
            {table.status === "held" && (
              <button className="btn btn-secondary" disabled={busy} onClick={() => run(() => dispatch({ type: "unhold", tableId: table.id }))}>
                Release hold
              </button>
            )}
            <button className="btn btn-ghost" onClick={() => setMode("note")}>
              {table.note ? `Note: ${table.note}` : "Add a note"}
            </button>
          </div>
        )}

        {mode === "seat" && (
          <div className="flex flex-col gap-4">
            {waiting.length > 0 && (
              <div className="flex flex-col gap-2">
                <div className="eyebrow">From the waitlist</div>
                {waiting.slice(0, 4).map((p) => (
                  <button key={p.id} className="flex items-center justify-between rounded-xl border border-border bg-surface px-3 py-2.5 text-left hover:bg-surface-2" disabled={busy} onClick={() => seatFromList(p.id)}>
                    <span>
                      <span className="font-bold">{p.name}</span> <span className="text-ink-2">· party of {p.size}</span>
                    </span>
                    <span className="tnum text-xs font-bold text-ink-2">waited {formatElapsed(now - p.joinedAt)}</span>
                  </button>
                ))}
              </div>
            )}
            <div className="eyebrow">Walk-in</div>
            <Field label="Party size">
              <Stepper value={size} onChange={setSize} min={1} max={Math.max(table.seats, 1)} label="Party size" />
            </Field>
            <Field label="Name (optional)">
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Okafor" />
            </Field>
            <div className="flex gap-2">
              <button className="btn btn-secondary flex-1" onClick={() => setMode("view")}>
                Back
              </button>
              <button className="btn btn-primary flex-1" disabled={busy} onClick={seatWalkIn}>
                Seat party of {size}
              </button>
            </div>
          </div>
        )}

        {mode === "note" && (
          <div className="flex flex-col gap-3">
            <Field label="Note for staff">
              <textarea className="input h-24 py-2" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Highchair needed, birthday, allergy…" />
            </Field>
            <div className="flex gap-2">
              <button className="btn btn-secondary flex-1" onClick={() => setMode("view")}>
                Back
              </button>
              <button className="btn btn-primary flex-1" disabled={busy} onClick={() => run(async () => { await dispatch({ type: "setNote", tableId: table.id, note }); setMode("view"); })}>
                Save note
              </button>
            </div>
          </div>
        )}
      </div>
    </Sheet>
  );
}
