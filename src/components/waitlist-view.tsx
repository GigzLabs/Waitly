"use client";

import clsx from "clsx";
import { ArrowUpRight, Bell, Pencil, Plus, Trash2, UserRound } from "lucide-react";
import { useMemo, useState } from "react";
import { useNow, useWaitly } from "@/lib/client";
import { formatElapsed, formatMinutes } from "@/lib/format";
import { suggestQuote } from "@/lib/predict";
import type { Party, Prediction } from "@/lib/types";
import { TableSheet } from "./table-sheet";
import { Empty, Field, Sheet, Stat, Stepper } from "./ui";

/**
 * "If there's a line at the entrance, staff can see which table will be available first."
 * The queue in order, each party matched to the table that should be ready first, plus
 * the venue-wide ranking of tables by when they will free up.
 */
export function WaitlistView() {
  const { snapshot, dispatch, notify } = useWaitly();
  const now = useNow(1000);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Party | null>(null);
  const [seating, setSeating] = useState<Party | null>(null);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  const waiting = useMemo(() => (snapshot?.parties ?? []).filter((p) => p.status === "waiting" || p.status === "notified").sort((a, b) => a.joinedAt - b.joinedAt), [snapshot]);
  const recent = useMemo(() => (snapshot?.parties ?? []).filter((p) => p.status === "seated" || p.status === "left" || p.status === "no_show").sort((a, b) => (b.seatedAt ?? b.leftAt ?? 0) - (a.seatedAt ?? a.leftAt ?? 0)), [snapshot]);
  const ranked = useMemo(() => (snapshot?.predictions ?? []).filter((p) => p.status !== "held"), [snapshot]);
  const nextUp = useMemo(() => ranked.find((p) => p.status === "seated" || p.status === "cleaning") ?? null, [ranked]);
  const freeNow = ranked.filter((p) => p.status === "free");

  if (!snapshot || !now) return <div className="text-sm font-semibold text-ink-3">Connecting…</div>;

  const suggestionFor = (p: Party) => snapshot.suggestions.find((s) => s.partyId === p.id) ?? null;
  const longest = waiting.length ? Math.max(...waiting.map((p) => now - p.joinedAt)) : 0;
  const overQuote = waiting.filter((p) => (now - p.joinedAt) / 60000 > p.quotedMinutes).length;

  return (
    <div className="flex flex-1 flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="eyebrow">Waiting queue</div>
          <h1 className="text-3xl font-bold tracking-tight">Waitlist</h1>
        </div>
        <button className="btn btn-primary" onClick={() => setAdding(true)}>
          <Plus size={18} /> Add party
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Waiting" value={waiting.length} tone={waiting.length ? "next" : undefined} hint={overQuote ? `${overQuote} past their quote` : "All inside their quote"} />
        <Stat label="Longest wait" value={waiting.length ? formatElapsed(longest) : "—"} tone={overQuote ? "cleaning" : undefined} />
        <Stat label="Free now" value={freeNow.length} tone={freeNow.length ? "free" : undefined} hint={freeNow.length ? freeNow.map((p) => p.label).join(", ") : "No free tables"} />
        <Stat label="Next free" value={nextUp ? nextUp.label : "—"} tone="next" hint={nextUp ? (nextUp.etaMin <= 0.5 ? "any moment" : `in about ${formatMinutes(nextUp.etaMin)}`) : undefined} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        {/* The queue */}
        <section className="flex flex-col gap-3">
          {waiting.length === 0 ? (
            <Empty title="No one is waiting" body="Add a party at the host stand, or let guests join from their phone at /join." action={<button className="btn btn-primary" onClick={() => setAdding(true)}>Add party</button>} />
          ) : (
            <ul className="flex flex-col gap-2">
              {waiting.map((p, i) => {
                const s = suggestionFor(p);
                const waited = now - p.joinedAt;
                const over = waited / 60000 - p.quotedMinutes;
                const table = s?.tableId ? snapshot.tables.find((t) => t.id === s.tableId) : null;
                const ready = table?.status === "free";
                return (
                  <li key={p.id} className={clsx("card flex flex-col gap-3 p-3 md:flex-row md:items-center md:p-4", p.status === "notified" && "border-free/50")}>
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <span className="tnum grid h-10 w-10 shrink-0 place-items-center rounded-full bg-surface-2 text-sm font-extrabold">{i + 1}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 text-[15px] font-bold">
                          <span className="truncate">{p.name}</span>
                          <span className="text-ink-2">· party of {p.size}</span>
                          {p.status === "notified" && <span className="pill !h-5 !border-transparent !bg-free-soft !px-2 !text-free">Notified</span>}
                          {p.source === "guest" && <span className="pill !h-5 !px-2">From phone</span>}
                        </div>
                        <div className="truncate text-xs text-ink-2">
                          {p.phone ? `${p.phone} · ` : ""}
                          {p.notes ? `${p.notes} · ` : ""}quoted {formatMinutes(p.quotedMinutes)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-3 md:justify-end">
                      <div className="text-right">
                        <div className={clsx("timer text-xl leading-none", over > snapshot.settings.longWaitSlaMin ? "text-seated" : over > 0 ? "text-cleaning" : "text-ink")}>{formatElapsed(waited)}</div>
                        <div className="mt-1 text-[11px] font-semibold text-ink-3">waiting</div>
                      </div>
                      <button
                        className={clsx("pill !h-8 !px-3", ready ? "!border-transparent !bg-free-soft !text-free" : s?.tableId ? "!border-transparent !bg-next-soft !text-next" : "")}
                        onClick={() => table && setSelectedTable(table.id)}
                        title={s?.tableId ? "Open the table" : "No table fits this party yet"}
                      >
                        {ready ? `${table?.label} is free` : s?.tableId ? `${s.label} in ~${formatMinutes(s.etaMin)}` : "No fit yet"}
                      </button>
                      <div className="flex items-center gap-1">
                        {p.phone && p.status === "waiting" && (
                          <button className="btn btn-ghost btn-sm !px-2" title="Notify guest" aria-label="Notify guest" onClick={async () => { const r = await dispatch({ type: "notifyParty", partyId: p.id }); if (r.ok) notify({ title: `${p.name} notified`, body: "Marked as notified. Connect SMS in Settings to text guests automatically.", tone: "success" }); }}>
                            <Bell size={16} />
                          </button>
                        )}
                        <button className="btn btn-ghost btn-sm !px-2" title="Edit" aria-label="Edit party" onClick={() => setEditing(p)}>
                          <Pencil size={16} />
                        </button>
                        {confirmRemove === p.id ? (
                          <button className="btn btn-danger btn-sm" onClick={async () => { await dispatch({ type: "partyLeft", partyId: p.id }); setConfirmRemove(null); }}>
                            Remove?
                          </button>
                        ) : (
                          <button className="btn btn-ghost btn-sm !px-2" title="Remove from list" aria-label="Remove from list" onClick={() => setConfirmRemove(p.id)}>
                            <Trash2 size={16} />
                          </button>
                        )}
                        <button className={clsx("btn btn-sm", ready ? "btn-primary" : "btn-secondary")} onClick={() => setSeating(p)}>
                          <UserRound size={16} /> Seat
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {recent.length > 0 && (
            <details className="card p-3">
              <summary className="cursor-pointer text-sm font-bold text-ink-2">Recently seated or left ({recent.length})</summary>
              <ul className="mt-2 flex flex-col gap-1">
                {recent.slice(0, 12).map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-sm">
                    <span className="truncate">
                      <span className="font-bold">{p.name}</span> <span className="text-ink-2">· party of {p.size}</span>
                    </span>
                    <span className={clsx("text-xs font-semibold", p.status === "seated" ? "text-free" : "text-ink-3")}>
                      {p.status === "seated" ? `Seated at ${snapshot.tables.find((t) => t.id === p.tableId)?.label ?? "table"} · waited ${formatMinutes(((p.seatedAt ?? 0) - p.joinedAt) / 60000)}` : `Left after ${formatMinutes(((p.leftAt ?? 0) - p.joinedAt) / 60000)}`}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>

        {/* Which table frees up first */}
        <aside className="flex flex-col gap-4">
          <section className="card flex flex-col gap-4 p-4">
            <h2 className="flex items-center gap-2 text-sm font-extrabold tracking-tight">
              <ArrowUpRight size={16} className="text-next" /> The next free table
            </h2>
            {nextUp ? (
              <button className="flex items-center gap-4 rounded-2xl border border-next/40 bg-next-soft p-4 text-left" onClick={() => setSelectedTable(nextUp.tableId)}>
                <span className={clsx("relative grid h-16 w-16 shrink-0 place-items-center rounded-full border-[3px] bg-surface text-lg font-bold", nextUp.status === "cleaning" ? "border-cleaning" : "border-seated")}>
                  <span className="pointer-events-none absolute -inset-2 rounded-full border-2 border-next opacity-60" />
                  <span className="pointer-events-none absolute -inset-4 rounded-full border-2 border-next opacity-30" />
                  {nextUp.label}
                </span>
                <span className="min-w-0">
                  <span className="block text-lg font-extrabold tracking-tight text-next">{nextUp.etaMin <= 0.5 ? "Any moment" : `In about ${formatMinutes(nextUp.etaMin)}`}</span>
                  <span className="block text-xs text-ink-2">{nextUp.reason}</span>
                  <span className="mt-1 block text-[11px] font-bold uppercase tracking-wider text-ink-3">{nextUp.confidence} confidence · {nextUp.seats} seats</span>
                </span>
              </button>
            ) : (
              <p className="text-sm text-ink-2">{freeNow.length ? `${freeNow.length} table${freeNow.length === 1 ? " is" : "s are"} free right now.` : "No tables are seated."}</p>
            )}
            <ol className="flex flex-col gap-1">
              {ranked.slice(0, 8).map((p, i) => (
                <li key={p.tableId}>
                  <button className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-surface-2" onClick={() => setSelectedTable(p.tableId)}>
                    <span className="tnum w-4 text-xs font-bold text-ink-3">{i + 1}</span>
                    <span className={clsx("h-2.5 w-2.5 rounded-full", p.status === "free" ? "bg-free" : p.status === "cleaning" ? "bg-cleaning" : "bg-seated")} />
                    <span className="font-bold">{p.label}</span>
                    <span className="text-ink-2">{p.seats} seats</span>
                    <span className={clsx("tnum ml-auto text-xs font-bold", p.status === "free" ? "text-free" : "text-ink")}>{p.status === "free" ? "now" : p.etaMin <= 0.5 ? "any moment" : `~${formatMinutes(p.etaMin)}`}</span>
                  </button>
                </li>
              ))}
            </ol>
            <p className="text-[11px] text-ink-3">Estimates use this venue&apos;s own dining times by party size and hour, plus the usual table reset.</p>
          </section>
          <section className="card p-4 text-sm text-ink-2">
            <div className="mb-1 text-sm font-extrabold tracking-tight text-ink">Guests can join from their phone</div>
            Put a QR code of <span className="font-semibold text-ink">/join</span> at the door. Guests see their place in line and get told when their table is ready.
          </section>
        </aside>
      </div>

      {(adding || editing) && <PartySheet key={editing?.id ?? "new"} party={editing} onClose={() => { setAdding(false); setEditing(null); }} predictions={ranked} />}
      <SeatSheet party={seating} onClose={() => setSeating(null)} now={now} />
      <TableSheet tableId={selectedTable} now={now} onClose={() => setSelectedTable(null)} />
    </div>
  );
}

function PartySheet({ party, onClose, predictions }: { party: Party | null; onClose: () => void; predictions: Prediction[] }) {
  const { snapshot, dispatch } = useWaitly();
  const [name, setName] = useState(party?.name ?? "");
  const [size, setSize] = useState(party?.size ?? 2);
  const [phone, setPhone] = useState(party?.phone ?? "");
  const [notes, setNotes] = useState(party?.notes ?? "");
  const [quoted, setQuoted] = useState<number | null>(party ? party.quotedMinutes : null);
  const [busy, setBusy] = useState(false);

  const suggested = useMemo(() => (snapshot ? suggestQuote(size, snapshot.parties, predictions) : 15), [snapshot, size, predictions]);
  const quote = quoted ?? suggested;

  const save = async () => {
    setBusy(true);
    try {
      const r = party
        ? await dispatch({ type: "updateParty", partyId: party.id, patch: { name, size, phone, notes, quotedMinutes: quote } })
        : await dispatch({ type: "addParty", name, size, phone, notes, quotedMinutes: quote, source: "host" });
      if (r.ok) onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open onClose={onClose} eyebrow={party ? "Edit party" : "New party"} title={party ? party.name : "Add to the waitlist"} footer={<button className="btn btn-primary btn-lg w-full" disabled={busy || !name.trim()} onClick={save}>{party ? "Save changes" : `Add party of ${size} · quote ${formatMinutes(quote)}`}</button>}>
      <div className="flex flex-col gap-4">
        <Field label="Name">
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Garcia" autoFocus />
        </Field>
        <Field label="Party size">
          <Stepper value={size} onChange={setSize} min={1} max={20} label="Party size" />
        </Field>
        <Field label="Phone (optional)" hint="Needed to notify the guest when the table is ready.">
          <input className="input" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 555 0142" />
        </Field>
        <Field label="Notes (optional)">
          <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Highchair, window seat, birthday" />
        </Field>
        <Field label="Quoted wait" hint={quoted === null ? `Suggested from the next free table that fits ${size}: ${formatMinutes(suggested)}.` : `Waitly suggests ${formatMinutes(suggested)}.`}>
          <div className="flex items-center gap-2">
            <input className="input w-28" type="number" min={0} max={240} step={5} value={quote} onChange={(e) => setQuoted(Number(e.target.value))} />
            <span className="text-sm text-ink-2">minutes</span>
            {quoted !== null && (
              <button className="btn btn-ghost btn-sm" onClick={() => setQuoted(null)}>
                Use suggestion
              </button>
            )}
          </div>
        </Field>
      </div>
    </Sheet>
  );
}

function SeatSheet({ party, onClose, now }: { party: Party | null; onClose: () => void; now: number }) {
  const { snapshot, dispatch, staff } = useWaitly();
  const [busy, setBusy] = useState(false);
  if (!snapshot || !party) return null;
  const suggestion = snapshot.suggestions.find((s) => s.partyId === party.id);
  const candidates = snapshot.predictions
    .filter((p) => p.seats >= party.size && p.status !== "held")
    .sort((a, b) => (a.tableId === suggestion?.tableId ? -1 : b.tableId === suggestion?.tableId ? 1 : 0) || a.etaMin - b.etaMin || a.seats - b.seats);
  const seat = async (tableId: string) => {
    setBusy(true);
    try {
      const r = await dispatch({ type: "seatParty", partyId: party.id, tableId, staffId: staff?.id });
      if (r.ok) onClose();
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet open onClose={onClose} eyebrow={`Party of ${party.size} · waited ${formatElapsed(now - party.joinedAt)}`} title={`Seat ${party.name}`}>
      <div className="flex flex-col gap-2">
        {candidates.length === 0 && <p className="text-sm text-ink-2">No table seats {party.size}. Add a larger table in Settings or combine tables.</p>}
        {candidates.map((p) => {
          const t = snapshot.tables.find((x) => x.id === p.tableId);
          const free = p.status === "free";
          const sec = snapshot.sections.find((s) => s.id === t?.sectionId);
          return (
            <button key={p.tableId} disabled={busy} onClick={() => seat(p.tableId)} className={clsx("flex items-center gap-3 rounded-xl border p-3 text-left transition-colors", free ? "border-free/50 bg-free-soft hover:bg-free-soft" : "border-border bg-surface hover:bg-surface-2")}>
              <span className={clsx("grid h-11 w-11 shrink-0 place-items-center rounded-full border-[3px] text-sm font-bold", free ? "border-free" : p.status === "cleaning" ? "border-cleaning" : "border-seated")}>{p.label}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold">
                  {p.label} · {p.seats} seats{sec ? ` · ${sec.name}` : ""}
                  {suggestion?.tableId === p.tableId && <span className="ml-2 rounded-full bg-next-soft px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-next">Suggested</span>}
                </span>
                <span className="block text-xs text-ink-2">{free ? "Free now" : p.status === "cleaning" ? `Being reset · ready in ~${formatMinutes(p.etaMin)}` : `Seated · likely free in ~${formatMinutes(p.etaMin)}`}</span>
              </span>
              <span className={clsx("text-xs font-bold", free ? "text-free" : "text-ink-3")}>{free ? "Seat now" : "Seat anyway"}</span>
            </button>
          );
        })}
      </div>
    </Sheet>
  );
}
