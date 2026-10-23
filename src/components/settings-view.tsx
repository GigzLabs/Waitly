"use client";

import clsx from "clsx";
import { Bell, Check, Copy, Eye, EyeOff, KeyRound, LayoutGrid, Lock, Map, Play, Plus, Rows3, Users, Utensils, Volume2, type LucideIcon } from "lucide-react";
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { useWaitly } from "@/lib/client";
import type { Action, ActionResult, Section, Settings, Snapshot, Staff, StaffRole, Table, TableShape } from "@/lib/types";
import { FloorMap } from "./floor-map";
import { Field, Pill, Segmented, Stepper } from "./ui";

type SectionKey = "venue" | "rules" | "floor" | "sections" | "staff" | "integrations" | "notifications" | "demo";
type Dispatch = (action: Action) => Promise<ActionResult>;
type Notify = (t: { title: string; body?: string; tone: "info" | "alert" | "success" | "danger" }) => void;

const SECTIONS: Array<{ key: SectionKey; label: string; icon: LucideIcon }> = [
  { key: "venue", label: "Venue", icon: Utensils },
  { key: "rules", label: "Service rules", icon: Bell },
  { key: "floor", label: "Floor plan", icon: Map },
  { key: "sections", label: "Sections", icon: LayoutGrid },
  { key: "staff", label: "Staff", icon: Users },
  { key: "integrations", label: "Integrations", icon: KeyRound },
  { key: "notifications", label: "Notifications", icon: Volume2 },
  { key: "demo", label: "Demo", icon: Play },
];

// ---------- small helpers ----------

const subscribeNever = () => () => {};
function useOrigin(): string {
  return useSyncExternalStore(subscribeNever, () => window.location.origin, () => "");
}

const permissionListeners = new Set<() => void>();
function subscribePermission(cb: () => void) {
  permissionListeners.add(cb);
  return () => {
    permissionListeners.delete(cb);
  };
}
function readPermission(): "unsupported" | NotificationPermission {
  return typeof Notification === "undefined" ? "unsupported" : Notification.permission;
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

function randomKey(): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "wk_";
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return out;
}

/** A clock for the floor preview; starts after mount so nothing is prerendered with a timestamp. */
function useTick(ms: number): number {
  const [now, setNow] = useState(0);
  useEffect(() => {
    const first = setTimeout(() => setNow(Date.now()), 0);
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [ms]);
  return now;
}

function Card({ title, lead, children, aside }: { title: string; lead: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="card flex flex-col gap-4 p-4 md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-bold tracking-tight">{title}</h2>
          <p className="mt-0.5 max-w-prose text-sm text-ink-2">{lead}</p>
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

function Switch({ checked, onChange, label, busy }: { checked: boolean; onChange: (v: boolean) => void; label: string; busy?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={busy} onClick={() => onChange(!checked)} className="flex min-h-11 shrink-0 items-center disabled:opacity-50">
      <span className={clsx("relative block h-7 w-12 rounded-full border transition-colors", checked ? "border-brand bg-brand" : "border-border-strong bg-surface-3")}>
        <span className={clsx("absolute top-[3px] left-[3px] block h-5 w-5 rounded-full shadow-sm transition-transform", checked ? "translate-x-5 bg-on-brand" : "translate-x-0 bg-surface")} />
      </span>
    </button>
  );
}

function SwitchRow({ label, hint, checked, onChange, busy }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void; busy?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-border px-4 py-2">
      <div className="min-w-0">
        <div className="text-sm font-bold">{label}</div>
        {hint && <div className="text-xs text-ink-2">{hint}</div>}
      </div>
      <Switch checked={checked} onChange={onChange} label={label} busy={busy} />
    </div>
  );
}

function NumberField({ label, hint, value, onChange, min, max, step = 1, suffix }: { label: string; hint?: string; value: number; onChange: (v: number) => void; min: number; max: number; step?: number; suffix?: string }) {
  return (
    <Field label={label} hint={hint}>
      <div className="flex items-center gap-2">
        <input type="number" inputMode="numeric" className="input tnum" value={Number.isFinite(value) ? value : ""} min={min} max={max} step={step} onChange={(e) => onChange(e.target.value === "" ? NaN : Number(e.target.value))} />
        {suffix && <span className="shrink-0 text-sm font-semibold text-ink-3">{suffix}</span>}
      </div>
    </Field>
  );
}

function CopyButton({ text, label = "Copy", onDone }: { text: string; label?: string; onDone?: (ok: boolean) => void }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="btn btn-secondary btn-sm"
      onClick={async () => {
        const ok = await copyText(text);
        setDone(ok);
        onDone?.(ok);
        setTimeout(() => setDone(false), 1500);
      }}
    >
      {done ? <Check size={14} /> : <Copy size={14} />} {done ? "Copied" : label}
    </button>
  );
}

function ConfirmButton({ label, confirmText, confirmLabel, onConfirm, danger, busy }: { label: string; confirmText: string; confirmLabel: string; onConfirm: () => Promise<void> | void; danger?: boolean; busy?: boolean }) {
  const [arm, setArm] = useState(false);
  if (!arm) {
    return (
      <button type="button" className={clsx("btn", danger ? "btn-danger" : "btn-secondary")} disabled={busy} onClick={() => setArm(true)}>
        {label}
      </button>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-seated/40 bg-seated-soft p-2">
      <span className="px-1 text-sm font-semibold text-seated">{confirmText}</span>
      <button type="button" className="btn btn-secondary btn-sm" onClick={() => setArm(false)}>
        Cancel
      </button>
      <button
        type="button"
        className="btn btn-primary btn-sm"
        disabled={busy}
        onClick={async () => {
          await onConfirm();
          setArm(false);
        }}
      >
        {confirmLabel}
      </button>
    </div>
  );
}

function useBusy(): [boolean, <T>(fn: () => Promise<T>) => Promise<T>] {
  const [busy, setBusy] = useState(false);
  const run = async <T,>(fn: () => Promise<T>): Promise<T> => {
    setBusy(true);
    try {
      return await fn();
    } finally {
      setBusy(false);
    }
  };
  return [busy, run];
}

// ---------- the screen ----------

export function SettingsView() {
  const { snapshot, dispatch, pin, setPin, notify, theme, setTheme } = useWaitly();
  const [verified, setVerified] = useState<"pending" | "ok" | "bad">("pending");
  const [section, setSection] = useState<SectionKey>("venue");

  // Re-check a stored PIN against the server whenever it changes.
  useEffect(() => {
    if (pin === null) return;
    let cancelled = false;
    dispatch({ type: "updateSettings", patch: {} }).then((r) => {
      if (cancelled) return;
      if (r.ok) setVerified("ok");
      else {
        setVerified("bad");
        setPin(null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [pin, dispatch, setPin]);

  if (!snapshot) return <div className="text-sm font-semibold text-ink-3">Connecting…</div>;

  const locked = pin === null;

  const unlock = async (candidate: string): Promise<boolean> => {
    const r = await dispatch({ type: "updateSettings", patch: {}, pin: candidate });
    if (r.ok) {
      setVerified("ok");
      setPin(candidate);
    }
    return r.ok;
  };

  return (
    <div className="flex flex-1 flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="eyebrow">Manager</div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        </div>
        {!locked && verified === "ok" && (
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPin(null)}>
            <Lock size={14} /> Lock
          </button>
        )}
      </div>

      {locked ? (
        <PinGate onUnlock={unlock} />
      ) : verified !== "ok" ? (
        <div className="text-sm font-semibold text-ink-3">Checking PIN…</div>
      ) : (
        <div className="flex flex-col gap-4 md:flex-row md:gap-6">
          <nav className="scroll-thin -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 md:mx-0 md:w-52 md:shrink-0 md:flex-col md:overflow-visible md:px-0" aria-label="Settings sections">
            {SECTIONS.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setSection(s.key)}
                aria-current={section === s.key ? "page" : undefined}
                className={clsx("flex h-10 shrink-0 items-center gap-2 rounded-xl px-3 text-sm font-semibold transition-colors", section === s.key ? "bg-brand-soft text-brand" : "text-ink-2 hover:bg-surface-2 hover:text-ink")}
              >
                <s.icon size={16} strokeWidth={1.75} /> {s.label}
              </button>
            ))}
          </nav>
          <div className="min-w-0 flex-1">
            {section === "venue" && <VenueSection key="venue" settings={snapshot.settings} dispatch={dispatch} notify={notify} />}
            {section === "rules" && <RulesSection key="rules" settings={snapshot.settings} dispatch={dispatch} notify={notify} />}
            {section === "floor" && <FloorSection snapshot={snapshot} dispatch={dispatch} notify={notify} />}
            {section === "sections" && <SectionsSection snapshot={snapshot} dispatch={dispatch} notify={notify} />}
            {section === "staff" && <StaffSection snapshot={snapshot} dispatch={dispatch} notify={notify} />}
            {section === "integrations" && <IntegrationsSection settings={snapshot.settings} dispatch={dispatch} notify={notify} />}
            {section === "notifications" && <NotificationsSection settings={snapshot.settings} dispatch={dispatch} notify={notify} theme={theme} setTheme={setTheme} />}
            {section === "demo" && <DemoSection settings={snapshot.settings} dispatch={dispatch} notify={notify} />}
          </div>
        </div>
      )}
    </div>
  );
}

function PinGate({ onUnlock }: { onUnlock: (pin: string) => Promise<boolean> }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, run] = useBusy();
  return (
    <div className="flex flex-1 items-start justify-center pt-6">
      <form
        className="card flex w-full max-w-sm flex-col gap-4 p-6"
        onSubmit={(e) => {
          e.preventDefault();
          if (value.length < 4) {
            setError("Enter at least 4 digits.");
            return;
          }
          run(async () => {
            const ok = await onUnlock(value);
            setError(ok ? null : "That PIN is not right.");
          });
        }}
      >
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-soft text-brand">
            <KeyRound size={20} />
          </span>
          <div>
            <h2 className="text-lg font-bold tracking-tight">Manager PIN</h2>
            <p className="text-sm text-ink-2">Settings are for managers only.</p>
          </div>
        </div>
        <Field label="PIN" hint="Default demo PIN is 1234">
          <input id="manager-pin" className="input tnum h-12 text-center text-xl tracking-[0.4em]" type="password" inputMode="numeric" autoComplete="off" pattern="[0-9]*" maxLength={6} value={value} onChange={(e) => setValue(e.target.value.replace(/\D/g, ""))} autoFocus />
        </Field>
        {error && (
          <p className="text-sm font-semibold text-seated" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="btn btn-primary btn-lg" disabled={busy}>
          Unlock
        </button>
      </form>
    </div>
  );
}

// ---------- Venue ----------

function VenueSection({ settings, dispatch, notify }: { settings: Settings; dispatch: Dispatch; notify: Notify }) {
  const [form, setForm] = useState({ venueName: settings.venueName, slug: settings.slug, openHour: settings.openHour, closeHour: settings.closeHour });
  const [busy, run] = useBusy();
  const save = () =>
    run(async () => {
      const r = await dispatch({ type: "updateSettings", patch: form });
      if (r.ok) notify({ title: "Saved", body: "Venue details updated.", tone: "success" });
    });
  return (
    <Card title="Venue" lead="The name guests and staff see, and the hours Waitly expects service. Peak-time insights use the opening hours to know which hours to show.">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Venue name">
          <input id="venue-name" className="input" value={form.venueName} onChange={(e) => setForm({ ...form, venueName: e.target.value })} />
        </Field>
        <Field label="Slug" hint="Short name used in links, lowercase.">
          <input id="venue-slug" className="input" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })} />
        </Field>
        <NumberField label="Opens at" hint="Hour of the day, 0 to 24." value={form.openHour} onChange={(v) => setForm({ ...form, openHour: v })} min={0} max={24} suffix="h" />
        <NumberField label="Closes at" hint="Hour of the day, 0 to 24." value={form.closeHour} onChange={(v) => setForm({ ...form, closeHour: v })} min={0} max={24} suffix="h" />
      </div>
      <div>
        <button type="button" className="btn btn-primary" disabled={busy || !form.venueName.trim()} onClick={save}>
          Save venue
        </button>
      </div>
    </Card>
  );
}

// ---------- Service rules ----------

function RulesSection({ settings, dispatch, notify }: { settings: Settings; dispatch: Dispatch; notify: Notify }) {
  const [form, setForm] = useState({
    greetSlaMin: settings.greetSlaMin,
    revisitSlaMin: settings.revisitSlaMin,
    cleaningSlaMin: settings.cleaningSlaMin,
    longWaitSlaMin: settings.longWaitSlaMin,
    coversPerServer: settings.coversPerServer,
    defaultDiningMin: settings.defaultDiningMin,
  });
  const [busy, run] = useBusy();
  const valid = Object.values(form).every((v) => Number.isFinite(v) && v >= 1);
  const save = () =>
    run(async () => {
      const r = await dispatch({ type: "updateSettings", patch: form });
      if (r.ok) notify({ title: "Saved", body: "Service rules updated. They apply to the floor straight away.", tone: "success" });
    });
  return (
    <Card title="Service rules" lead="When Waitly raises an alert and how it plans staffing. Every number is minutes unless it says otherwise.">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <NumberField label="No server yet" hint="Alert when a seated party has no server visit after this many minutes. The video's rule: 5." value={form.greetSlaMin} onChange={(v) => setForm({ ...form, greetSlaMin: v })} min={1} max={60} suffix="min" />
        <NumberField label="Check on the table" hint="Alert when a seated table has had no server visit for this long." value={form.revisitSlaMin} onChange={(v) => setForm({ ...form, revisitSlaMin: v })} min={1} max={120} suffix="min" />
        <NumberField label="Time to reset a table" hint="A released table that is not cleaned by then escalates to red." value={form.cleaningSlaMin} onChange={(v) => setForm({ ...form, cleaningSlaMin: v })} min={1} max={60} suffix="min" />
        <NumberField label="Waiting too long" hint="Alert when a party on the waitlist is this far past its quoted wait." value={form.longWaitSlaMin} onChange={(v) => setForm({ ...form, longWaitSlaMin: v })} min={1} max={120} suffix="min" />
        <NumberField label="Covers per server" hint="Drives the staffing recommendation in Insights: guests one server can look after at once." value={form.coversPerServer} onChange={(v) => setForm({ ...form, coversPerServer: v })} min={1} max={60} suffix="covers" />
        <NumberField label="Typical dining time" hint="Used for the next-free-table prediction until the venue has enough history of its own." value={form.defaultDiningMin} onChange={(v) => setForm({ ...form, defaultDiningMin: v })} min={10} max={300} suffix="min" />
      </div>
      <div>
        <button type="button" className="btn btn-primary" disabled={busy || !valid} onClick={save}>
          Save rules
        </button>
      </div>
    </Card>
  );
}

// ---------- Floor plan ----------

const SHAPES: TableShape[] = ["round", "square", "rect"];

interface TableDraft {
  label: string;
  seats: number;
  sectionId: string;
  shape: TableShape;
  x: number;
  y: number;
  w: number;
  h: number;
}

function FloorSection({ snapshot, dispatch, notify }: { snapshot: Snapshot; dispatch: Dispatch; notify: Notify }) {
  const now = useTick(5000);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const selected = snapshot.tables.find((t) => t.id === selectedId) ?? null;
  const sectionName = (id: string) => snapshot.sections.find((s) => s.id === id)?.name ?? "—";

  return (
    <Card
      title="Floor plan"
      lead="Tables as they are laid out in the room. Tap a table on the map or in the list to edit it. Positions and sizes are percentages of the floor, so the plan fits every screen."
      aside={
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => {
            setSelectedId(null);
            setAdding(true);
          }}
        >
          <Plus size={14} /> Add table
        </button>
      }
    >
      <FloorMap
        tables={snapshot.tables}
        sections={snapshot.sections}
        alerts={[]}
        nextUpId={null}
        now={now}
        selectedId={selectedId}
        onSelect={(id) => {
          setAdding(false);
          setSelectedId(id);
        }}
        onMove={(id, x, y) => {
          const t = snapshot.tables.find((tb) => tb.id === id);
          if (!t) return;
          dispatch({ type: "upsertTable", table: { id, x, y, label: t.label, seats: t.seats, sectionId: t.sectionId } });
        }}
      />
      <p className="-mt-2 text-xs text-ink-3">Drag a table to move it. Tap it to edit seats, section, shape and size.</p>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-ink-3">
                <th className="px-3 py-2">Table</th>
                <th className="px-3 py-2">Seats</th>
                <th className="px-3 py-2">Section</th>
                <th className="px-3 py-2">Shape</th>
                <th className="px-3 py-2">Position</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.tables.map((t) => (
                <tr key={t.id} className={clsx("cursor-pointer border-t border-border hover:bg-surface-2", selectedId === t.id && "bg-brand-soft")} onClick={() => { setAdding(false); setSelectedId(t.id); }}>
                  <td className="px-3 py-2.5 font-bold">{t.label}</td>
                  <td className="tnum px-3 py-2.5">{t.seats}</td>
                  <td className="px-3 py-2.5">{sectionName(t.sectionId)}</td>
                  <td className="px-3 py-2.5 capitalize">{t.shape}</td>
                  <td className="tnum px-3 py-2.5 text-ink-2">
                    {t.x},{t.y} · {t.w}×{t.h}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="min-w-0">
          {selected ? (
            <TableForm key={selected.id} table={selected} sections={snapshot.sections} dispatch={dispatch} notify={notify} onClose={() => setSelectedId(null)} />
          ) : adding ? (
            <TableForm key="new" table={null} sections={snapshot.sections} dispatch={dispatch} notify={notify} onClose={() => setAdding(false)} />
          ) : (
            <div className="flex h-full min-h-32 items-center justify-center rounded-xl border border-dashed border-border-strong p-4 text-center text-sm text-ink-3">Select a table to edit it, or add a new one.</div>
          )}
        </div>
      </div>
    </Card>
  );
}

function TableForm({ table, sections, dispatch, notify, onClose }: { table: Table | null; sections: Section[]; dispatch: Dispatch; notify: Notify; onClose: () => void }) {
  const [draft, setDraft] = useState<TableDraft>(
    table
      ? { label: table.label, seats: table.seats, sectionId: table.sectionId, shape: table.shape, x: table.x, y: table.y, w: table.w, h: table.h }
      : { label: "", seats: 4, sectionId: sections[0]?.id ?? "", shape: "square", x: 10, y: 10, w: 16, h: 22 },
  );
  const [busy, run] = useBusy();
  const set = <K extends keyof TableDraft>(k: K, v: TableDraft[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const valid = draft.label.trim().length > 0 && draft.seats >= 1 && draft.sectionId && [draft.x, draft.y, draft.w, draft.h].every((n) => Number.isFinite(n));

  const save = () =>
    run(async () => {
      const r = await dispatch({ type: "upsertTable", table: { ...(table ? { id: table.id } : {}), ...draft, label: draft.label.trim() } });
      if (r.ok) {
        notify({ title: "Saved", body: `Table ${draft.label.trim()} ${table ? "updated" : "added"}.`, tone: "success" });
        if (!table) onClose();
      }
    });
  const remove = () =>
    run(async () => {
      if (!table) return;
      const r = await dispatch({ type: "deleteTable", tableId: table.id });
      if (r.ok) {
        notify({ title: "Table removed", body: `Table ${table.label} is gone from the floor.`, tone: "info" });
        onClose();
      }
    });

  return (
    <form
      className="flex flex-col gap-3 rounded-xl border border-border bg-surface-2 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) save();
      }}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold tracking-tight">{table ? `Table ${table.label}` : "New table"}</h3>
        {table && <Pill tone={table.status === "seated" ? "seated" : table.status === "cleaning" ? "cleaning" : table.status === "held" ? "held" : "free"}>{table.status === "cleaning" ? "Needs cleaning" : table.status}</Pill>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Label">
          <input id={`tbl-label-${table?.id ?? "new"}`} className="input" value={draft.label} maxLength={8} placeholder="M7" onChange={(e) => set("label", e.target.value)} />
        </Field>
        <Field label="Seats">
          <Stepper value={draft.seats} onChange={(v) => set("seats", v)} min={1} max={30} label="Seats" />
        </Field>
        <Field label="Section">
          <select id={`tbl-section-${table?.id ?? "new"}`} className="input" value={draft.sectionId} onChange={(e) => set("sectionId", e.target.value)}>
            {sections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Shape">
          <select id={`tbl-shape-${table?.id ?? "new"}`} className="input capitalize" value={draft.shape} onChange={(e) => set("shape", e.target.value as TableShape)}>
            {SHAPES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>
        <NumberField label="Left (x)" value={draft.x} onChange={(v) => set("x", v)} min={0} max={95} suffix="%" />
        <NumberField label="Top (y)" value={draft.y} onChange={(v) => set("y", v)} min={0} max={95} suffix="%" />
        <NumberField label="Width" value={draft.w} onChange={(v) => set("w", v)} min={6} max={50} suffix="%" />
        <NumberField label="Height" value={draft.h} onChange={(v) => set("h", v)} min={6} max={50} suffix="%" />
      </div>
      <p className="text-xs text-ink-3">Position and size are percent of the floor: 0 is the left or top edge, 100 the right or bottom.</p>
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="btn btn-primary" disabled={busy || !valid}>
          {table ? "Save table" : "Add table"}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onClose}>
          Close
        </button>
        {table && (
          <span className="ml-auto">
            <ConfirmButton label="Delete" confirmText={`Delete ${table.label}?`} confirmLabel="Delete table" onConfirm={remove} danger busy={busy || table.status === "seated"} />
          </span>
        )}
      </div>
      {table?.status === "seated" && <p className="text-xs text-ink-3">A seated table cannot be deleted. Wait until the guests have left.</p>}
    </form>
  );
}

// ---------- Sections ----------

function SectionsSection({ snapshot, dispatch, notify }: { snapshot: Snapshot; dispatch: Dispatch; notify: Notify }) {
  const servers = snapshot.staff.filter((s) => s.role === "server");
  const [newName, setNewName] = useState("");
  const [busy, run] = useBusy();
  const add = () =>
    run(async () => {
      const r = await dispatch({ type: "upsertSection", section: { name: newName.trim() } });
      if (r.ok) {
        notify({ title: "Saved", body: `Section ${newName.trim()} added.`, tone: "success" });
        setNewName("");
      }
    });
  return (
    <Card title="Sections" lead="Areas of the room, each owned by one server. Alerts for a table go to the server of its section first.">
      <div className="flex flex-col gap-2">
        {snapshot.sections.map((s) => (
          <SectionRow key={s.id} section={s} servers={servers} tableCount={snapshot.tables.filter((t) => t.sectionId === s.id).length} dispatch={dispatch} notify={notify} />
        ))}
      </div>
      <form
        className="flex flex-col gap-2 sm:flex-row sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          if (newName.trim()) add();
        }}
      >
        <div className="flex-1">
          <Field label="New section">
            <input id="new-section" className="input" value={newName} maxLength={24} placeholder="Terrace" onChange={(e) => setNewName(e.target.value)} />
          </Field>
        </div>
        <button type="submit" className="btn btn-primary" disabled={busy || !newName.trim()}>
          <Plus size={16} /> Add section
        </button>
      </form>
    </Card>
  );
}

function SectionRow({ section, servers, tableCount, dispatch, notify }: { section: Section; servers: Staff[]; tableCount: number; dispatch: Dispatch; notify: Notify }) {
  const [name, setName] = useState(section.name);
  const [serverId, setServerId] = useState<string>(section.serverId ?? "");
  const [busy, run] = useBusy();
  const dirty = name.trim() !== section.name || (serverId || null) !== (section.serverId ?? null);
  const save = () =>
    run(async () => {
      const r = await dispatch({ type: "upsertSection", section: { id: section.id, name: name.trim(), serverId: serverId || null } });
      if (r.ok) notify({ title: "Saved", body: `Section ${name.trim()} updated.`, tone: "success" });
    });
  const remove = () =>
    run(async () => {
      const r = await dispatch({ type: "deleteSection", sectionId: section.id });
      if (r.ok) notify({ title: "Section removed", body: `${section.name} is gone.`, tone: "info" });
    });
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border p-3 md:flex-row md:items-end">
      <div className="flex-1">
        <Field label="Name" hint={tableCount ? `${tableCount} table${tableCount === 1 ? "" : "s"} · move them before deleting this section` : "No tables yet"}>
          <input id={`sec-name-${section.id}`} className="input" value={name} maxLength={24} onChange={(e) => setName(e.target.value)} />
        </Field>
      </div>
      <div className="flex-1">
        <Field label="Server">
          <select id={`sec-server-${section.id}`} className="input" value={serverId} onChange={(e) => setServerId(e.target.value)}>
            <option value="">No server assigned</option>
            {servers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="flex gap-2">
        <button type="button" className="btn btn-primary" disabled={busy || !dirty || !name.trim()} onClick={save}>
          Save
        </button>
        {tableCount > 0 ? (
          <button type="button" className="btn btn-danger" disabled title="Move its tables to another section first">
            Delete
          </button>
        ) : (
          <ConfirmButton label="Delete" confirmText={`Delete ${section.name}?`} confirmLabel="Delete" onConfirm={remove} danger busy={busy} />
        )}
      </div>
    </div>
  );
}

// ---------- Staff ----------

const ROLES: StaffRole[] = ["host", "server", "busser", "manager"];

function StaffSection({ snapshot, dispatch, notify }: { snapshot: Snapshot; dispatch: Dispatch; notify: Notify }) {
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<StaffRole>("server");
  const [busy, run] = useBusy();
  const add = () =>
    run(async () => {
      const r = await dispatch({ type: "upsertStaff", staff: { name: newName.trim(), role: newRole, sectionIds: [], onShift: true } });
      if (r.ok) {
        notify({ title: "Saved", body: `${newName.trim()} added as ${newRole}.`, tone: "success" });
        setNewName("");
      }
    });
  return (
    <Card title="Staff" lead="Who works the floor. Servers own sections; bussers reset tables. Staff pick their name at the top of the app so actions are recorded under them.">
      <div className="flex flex-col gap-2">
        {snapshot.staff.map((s) => (
          <StaffRow key={s.id} member={s} sections={snapshot.sections} dispatch={dispatch} notify={notify} />
        ))}
      </div>
      <form
        className="flex flex-col gap-2 sm:flex-row sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          if (newName.trim()) add();
        }}
      >
        <div className="flex-1">
          <Field label="New staff member">
            <input id="new-staff-name" className="input" value={newName} maxLength={24} placeholder="Name" onChange={(e) => setNewName(e.target.value)} />
          </Field>
        </div>
        <div className="sm:w-40">
          <Field label="Role">
            <select id="new-staff-role" className="input capitalize" value={newRole} onChange={(e) => setNewRole(e.target.value as StaffRole)}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <button type="submit" className="btn btn-primary" disabled={busy || !newName.trim()}>
          <Plus size={16} /> Add
        </button>
      </form>
    </Card>
  );
}

function StaffRow({ member, sections, dispatch, notify }: { member: Staff; sections: Section[]; dispatch: Dispatch; notify: Notify }) {
  const [name, setName] = useState(member.name);
  const [role, setRole] = useState<StaffRole>(member.role);
  const [sectionIds, setSectionIds] = useState<string[]>(member.sectionIds);
  const [busy, run] = useBusy();
  const dirty = name.trim() !== member.name || role !== member.role || sectionIds.join() !== member.sectionIds.join();
  const worksSections = role === "server" || role === "busser";
  const save = () =>
    run(async () => {
      const r = await dispatch({ type: "upsertStaff", staff: { id: member.id, name: name.trim(), role, sectionIds: worksSections ? sectionIds : [] } });
      if (r.ok) notify({ title: "Saved", body: `${name.trim()} updated.`, tone: "success" });
    });
  const remove = () =>
    run(async () => {
      const r = await dispatch({ type: "deleteStaff", staffId: member.id });
      if (r.ok) notify({ title: "Staff removed", body: `${member.name} is no longer on the roster.`, tone: "info" });
    });
  const toggle = (on: boolean) =>
    run(async () => {
      const r = await dispatch({ type: "toggleShift", staffId: member.id });
      if (r.ok) notify({ title: on ? `${member.name} is on shift` : `${member.name} is off shift`, tone: "info" });
    });
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border p-3">
      <div className="flex flex-col gap-3 md:flex-row md:items-end">
        <div className="flex-1">
          <Field label="Name">
            <input id={`staff-name-${member.id}`} className="input" value={name} maxLength={24} onChange={(e) => setName(e.target.value)} />
          </Field>
        </div>
        <div className="md:w-40">
          <Field label="Role">
            <select id={`staff-role-${member.id}`} className="input capitalize" value={role} onChange={(e) => setRole(e.target.value as StaffRole)}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="flex items-center gap-3 md:pb-0.5">
          <span className="text-xs font-bold text-ink-2">On shift</span>
          <Switch checked={member.onShift} onChange={toggle} label={`${member.name} on shift`} busy={busy} />
        </div>
      </div>
      {worksSections && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold tracking-wide text-ink-2">Sections</span>
          {sections.map((s) => {
            const on = sectionIds.includes(s.id);
            return (
              <label key={s.id} className={clsx("flex h-10 cursor-pointer items-center gap-2 rounded-xl border px-3 text-sm font-semibold", on ? "border-brand bg-brand-soft text-brand" : "border-border text-ink-2")}>
                <input type="checkbox" className="sr-only" checked={on} onChange={(e) => setSectionIds(e.target.checked ? [...sectionIds, s.id] : sectionIds.filter((x) => x !== s.id))} />
                {on && <Check size={14} />}
                {s.name}
              </label>
            );
          })}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-primary btn-sm" disabled={busy || !dirty || !name.trim()} onClick={save}>
          Save
        </button>
        <span className="ml-auto">
          <ConfirmButton label="Remove" confirmText={`Remove ${member.name}?`} confirmLabel="Remove" onConfirm={remove} danger busy={busy} />
        </span>
      </div>
    </div>
  );
}

// ---------- Integrations ----------

function IntegrationsSection({ settings, dispatch, notify }: { settings: Settings; dispatch: Dispatch; notify: Notify }) {
  const origin = useOrigin();
  const [show, setShow] = useState(false);
  const [busy, run] = useBusy();
  const base = origin || "https://your-waitly.example";
  const masked = settings.apiKey.slice(0, 3) + "•".repeat(Math.max(8, settings.apiKey.length - 3));
  const curl = `curl -X POST ${base}/api/ingest \\
  -H "Content-Type: application/json" \\
  -H "x-waitly-key: ${show ? settings.apiKey : "<your key>"}" \\
  -d '{ "table": "M4", "state": "occupied", "confidence": 0.93, "partySize": 3 }'`;
  const regenerate = () =>
    run(async () => {
      const r = await dispatch({ type: "updateSettings", patch: { apiKey: randomKey() } });
      if (r.ok) notify({ title: "New API key", body: "Update it in your camera or POS integration.", tone: "success" });
    });
  return (
    <div className="flex flex-col gap-4">
      <Card title="Camera and POS" lead="You do not always need a new camera. Any system that can tell which table is occupied, empty or being served can drive the floor through this API, including the vision software on the security cameras you already have.">
        <Field label="API key" hint="Send it in the x-waitly-key header. Keep it private.">
          <div className="flex flex-wrap items-center gap-2">
            <code className="tnum min-w-0 flex-1 truncate rounded-xl border border-border bg-surface-2 px-3 py-2.5 text-sm">{show ? settings.apiKey : masked}</code>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShow((v) => !v)} aria-pressed={show}>
              {show ? <EyeOff size={14} /> : <Eye size={14} />} {show ? "Hide" : "Show"}
            </button>
            <CopyButton text={settings.apiKey} onDone={(ok) => notify({ title: ok ? "API key copied" : "Could not copy", body: ok ? undefined : "Select the key and copy it by hand.", tone: ok ? "success" : "danger" })} />
            <ConfirmButton label="Regenerate key" confirmText="The old key stops working." confirmLabel="Regenerate" onConfirm={regenerate} busy={busy} />
          </div>
        </Field>
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold tracking-wide text-ink-2">Example request</span>
            <CopyButton text={curl} />
          </div>
          <pre className="scroll-thin overflow-x-auto rounded-xl border border-border bg-surface-2 p-3 text-xs leading-relaxed">
            <code>{curl}</code>
          </pre>
        </div>
        <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div className="rounded-xl border border-border p-3">
            <dt className="text-xs font-bold tracking-wide text-ink-2">States</dt>
            <dd className="mt-1 flex flex-col gap-1 text-ink-2">
              <span>
                <code className="font-bold text-ink">occupied</code> guests sat down; a free or dirty table becomes Seated
              </span>
              <span>
                <code className="font-bold text-ink">empty</code> guests left; a seated table becomes Needs cleaning
              </span>
              <span>
                <code className="font-bold text-ink">staff_present</code> a server is at the table; counts as a visit
              </span>
            </dd>
          </div>
          <div className="rounded-xl border border-border p-3">
            <dt className="text-xs font-bold tracking-wide text-ink-2">Rules</dt>
            <dd className="mt-1 flex flex-col gap-1 text-ink-2">
              <span>
                Send several at once as <code className="font-bold text-ink">{`{ "events": [ … ] }`}</code>.
              </span>
              <span>
                Name the table by <code className="font-bold text-ink">table</code> (its label) or <code className="font-bold text-ink">tableId</code>.
              </span>
              <span>
                Events with <code className="font-bold text-ink">confidence</code> under 0.6 are ignored.
              </span>
              <span>A staff tap overrides camera events for 60 seconds, so the floor never fights the camera.</span>
              <span>
                POS systems send <code className="font-bold text-ink">{`"source": "pos"`}</code>: an opened check is <code className="font-bold text-ink">occupied</code>, a closed one <code className="font-bold text-ink">empty</code>.
              </span>
            </dd>
          </div>
        </dl>
      </Card>
      <Card title="Guest waitlist" lead="Guests join the line themselves from a QR code at the host stand and see their place and quoted wait on their phone.">
        <div className="flex flex-wrap items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-xl border border-border bg-surface-2 px-3 py-2.5 text-sm">{`${base}/join`}</code>
          <CopyButton text={`${base}/join`} label="Copy link" onDone={(ok) => notify({ title: ok ? "Link copied" : "Could not copy", tone: ok ? "success" : "danger" })} />
        </div>
        <p className="text-xs text-ink-3">Print a QR code of this link for the host stand or the door. Parties who join this way appear on the Waitlist like any other.</p>
      </Card>
    </div>
  );
}

// ---------- Notifications ----------

function NotificationsSection({ settings, dispatch, notify, theme, setTheme }: { settings: Settings; dispatch: Dispatch; notify: Notify; theme: "light" | "dark"; setTheme: (t: "light" | "dark") => void }) {
  const permission = useSyncExternalStore(subscribePermission, readPermission, () => "unsupported" as const);
  const [busy, run] = useBusy();
  const setSound = (on: boolean) =>
    run(async () => {
      try {
        localStorage.setItem("waitly-sound", on ? "on" : "off");
      } catch {
        /* storage unavailable */
      }
      const r = await dispatch({ type: "updateSettings", patch: { soundOn: on } });
      if (r.ok) notify({ title: on ? "Sound on" : "Sound off", body: on ? "New alerts play a short chime on this device." : "Alerts stay silent.", tone: "info" });
    });
  const ask = async () => {
    if (typeof Notification === "undefined") return;
    try {
      await Notification.requestPermission();
    } finally {
      permissionListeners.forEach((l) => l());
    }
  };
  const permissionText = permission === "unsupported" ? "Not available in this browser" : permission === "granted" ? "Allowed" : permission === "denied" ? "Blocked in the browser settings" : "Not asked yet";
  return (
    <Card title="Notifications" lead="How this device tells staff about a new alert. Every device keeps its own choices; the sound setting is shared.">
      <div className="flex flex-col gap-2">
        <SwitchRow label="Alert sound" hint="Two soft tones when an alert opens." checked={settings.soundOn} onChange={setSound} busy={busy} />
        <div className="flex items-center justify-between gap-4 rounded-xl border border-border px-4 py-2">
          <div className="min-w-0">
            <div className="text-sm font-bold">Browser notifications</div>
            <div className="text-xs text-ink-2">Shows the alert on the lock screen or desktop when Waitly is in the background. {permissionText}.</div>
          </div>
          <button type="button" className="btn btn-secondary btn-sm shrink-0" disabled={permission === "unsupported" || permission === "granted"} onClick={ask}>
            <Bell size={14} /> {permission === "granted" ? "Enabled" : "Enable"}
          </button>
        </div>
        <div className="flex items-center justify-between gap-4 rounded-xl border border-border px-4 py-2">
          <div className="min-w-0">
            <div className="text-sm font-bold">Theme</div>
            <div className="text-xs text-ink-2">Dark suits a dim dining room; light suits the office.</div>
          </div>
          <Segmented value={theme} onChange={setTheme} options={[{ value: "dark", label: "Dark" }, { value: "light", label: "Light" }]} />
        </div>
      </div>
    </Card>
  );
}

// ---------- Demo ----------

function DemoSection({ settings, dispatch, notify }: { settings: Settings; dispatch: Dispatch; notify: Notify }) {
  const [busy, run] = useBusy();
  const setDemo = (on: boolean) =>
    run(async () => {
      const r = await dispatch({ type: "setDemo", on });
      if (r.ok) notify({ title: on ? "Demo mode on" : "Demo mode off", body: on ? "The floor now moves on its own." : "The floor only changes when staff or integrations act.", tone: "info" });
    });
  const reset = () =>
    run(async () => {
      const r = await dispatch({ type: "resetDemo" });
      if (r.ok) notify({ title: "Demo data reset", body: "A fresh Friday evening floor with two weeks of history.", tone: "success" });
    });
  return (
    <Card title="Demo" lead="Demo mode makes the floor move on its own: guests arrive, servers greet, tables turn. Turn it off before opening service.">
      <SwitchRow label="Demo mode" hint={settings.demoMode ? "Running. Guests and staff are simulated." : "Off. Waiting for real activity."} checked={settings.demoMode} onChange={setDemo} busy={busy} />
      <div className="flex flex-col gap-2 rounded-xl border border-border px-4 py-3">
        <div className="text-sm font-bold">Reset demo data</div>
        <p className="text-xs text-ink-2">Replaces the floor, the waitlist and the history with the sample venue. Your venue name, PIN and API key are kept.</p>
        <div>
          <ConfirmButton label="Reset demo data" confirmText="Are you sure? This replaces the floor and history." confirmLabel="Confirm reset" onConfirm={reset} danger busy={busy} />
        </div>
      </div>
      <p className="flex items-center gap-2 text-xs text-ink-3">
        <Rows3 size={14} /> History feeds Insights; resetting generates fourteen days of sample service.
      </p>
    </Card>
  );
}
