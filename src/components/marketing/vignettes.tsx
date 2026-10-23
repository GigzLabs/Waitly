import clsx from "clsx";
import { ArrowRight, BellRing, Pointer, Utensils, Video } from "lucide-react";

type Status = "free" | "seated" | "cleaning" | "held";

const RING: Record<Status, { border: string; bg: string; text: string }> = {
  free: { border: "border-free", bg: "bg-free-soft", text: "text-free" },
  seated: { border: "border-seated", bg: "bg-seated-soft", text: "text-seated" },
  cleaning: { border: "border-cleaning", bg: "bg-cleaning-soft", text: "text-cleaning" },
  held: { border: "border-held", bg: "bg-held-soft", text: "text-held" },
};

/** A static table ring, the same drawing the app uses on the floor. */
export function Ring({ label, status, caption, size = 76, ripple, alert, className }: { label: string; status: Status; caption: string; size?: number; ripple?: boolean; alert?: boolean; className?: string }) {
  const c = RING[status];
  return (
    <span className={clsx("relative grid shrink-0 place-items-center rounded-full border-[3px]", c.border, c.bg, className)} style={{ width: size, height: size, borderStyle: status === "held" ? "dashed" : "solid" }} aria-label={`${label}, ${caption}`}>
      {ripple && (
        <>
          <span className="pointer-events-none absolute -inset-2.5 rounded-full border-2 border-next opacity-60" aria-hidden="true" />
          <span className="pointer-events-none absolute -inset-5 rounded-full border-2 border-next opacity-30" aria-hidden="true" />
        </>
      )}
      {alert && <span className="absolute -right-1 -top-1 h-3.5 w-3.5 rounded-full border-2 border-surface bg-cleaning" aria-hidden="true" />}
      <span className="flex flex-col items-center leading-none">
        <span className="font-bold tracking-tight text-ink" style={{ fontSize: Math.round(size * 0.21) }}>
          {label}
        </span>
        <span className={clsx("tnum mt-1 font-bold", c.text)} style={{ fontSize: Math.round(size * 0.14) }}>
          {caption}
        </span>
      </span>
    </span>
  );
}

interface MockTable {
  label: string;
  status: Status;
  caption: string;
  guests?: string;
  shape: "round" | "square" | "rect";
  x: number;
  y: number;
  w: number;
  h: number;
  ripple?: boolean;
  alert?: boolean;
}

const FLOOR: MockTable[] = [
  { label: "M1", status: "free", caption: "Free", shape: "round", x: 6, y: 12, w: 15, h: 24 },
  { label: "M2", status: "seated", caption: "25:29", guests: "4 guests", shape: "square", x: 27, y: 12, w: 17, h: 26, ripple: true },
  { label: "M3", status: "seated", caption: "1:41", guests: "3 guests", shape: "square", x: 50, y: 12, w: 17, h: 26 },
  { label: "B1", status: "cleaning", caption: "2:41", guests: "to clean", shape: "round", x: 79, y: 12, w: 13, h: 21, alert: true },
  { label: "M4", status: "seated", caption: "15:05", guests: "6 guests", shape: "rect", x: 6, y: 46, w: 24, h: 24 },
  { label: "M5", status: "free", caption: "Free", shape: "round", x: 36, y: 48, w: 15, h: 24 },
  { label: "M6", status: "seated", caption: "41:53", guests: "7 guests", shape: "rect", x: 56, y: 46, w: 26, h: 24 },
  { label: "P1", status: "seated", caption: "7:17", guests: "2 guests", shape: "round", x: 8, y: 76, w: 14, h: 22, alert: true },
  { label: "P2", status: "seated", caption: "0:51", guests: "4 guests", shape: "square", x: 30, y: 76, w: 16, h: 24 },
  { label: "B2", status: "held", caption: "Held", shape: "round", x: 80, y: 44, w: 13, h: 21 },
];

/** The hero vignette: a floor map drawn from plain divs, no data. */
export function FloorVignette({ className }: { className?: string }) {
  return (
    <div className={clsx("card overflow-hidden shadow-lg", className)} aria-hidden="true">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <span className="text-sm font-extrabold tracking-tight">Saloon</span>
        <span className="text-xs font-semibold text-ink-3">Friday · 20:41</span>
        <span className="pill ml-auto !border-transparent !bg-seated-soft !text-seated">
          <span className="h-2 w-2 rounded-full bg-seated" /> 7/10 seated
        </span>
        <span className="pill !border-transparent !bg-cleaning-soft !text-cleaning">
          <span className="h-2 w-2 rounded-full bg-cleaning" /> 2 alerts
        </span>
        <span className="pill hidden sm:inline-flex">
          <span className="h-2 w-2 rounded-full bg-free" /> Live
        </span>
      </div>
      <div className="relative w-full bg-surface" style={{ aspectRatio: "16 / 10" }}>
        <div className="pointer-events-none absolute inset-0 opacity-35" style={{ backgroundImage: "radial-gradient(var(--border-strong) 1px, transparent 1px)", backgroundSize: "22px 22px" }} />
        <span className="eyebrow absolute left-5 top-3">Main</span>
        <span className="eyebrow absolute left-5 top-[69%]">Patio</span>
        <span className="eyebrow absolute left-[78%] top-3">Bar</span>
        {FLOOR.map((t) => {
          const c = RING[t.status];
          const radius = t.shape === "round" ? "9999px" : t.shape === "square" ? "22%" : "18px";
          return (
            <div key={t.label} className={clsx("absolute grid place-items-center border-[3px]", c.border, c.bg)} style={{ left: `${t.x}%`, top: `${t.y}%`, width: `${t.w}%`, height: `${t.h}%`, borderRadius: radius, borderStyle: t.status === "held" ? "dashed" : "solid" }}>
              {t.ripple && (
                <>
                  <span className="pointer-events-none absolute -inset-2.5 border-2 border-next opacity-60" style={{ borderRadius: radius }} />
                  <span className="pointer-events-none absolute -inset-5 border-2 border-next opacity-30" style={{ borderRadius: radius }} />
                </>
              )}
              {t.alert && <span className="absolute -right-1.5 -top-1.5 h-4 w-4 rounded-full border-2 border-surface bg-cleaning" />}
              <span className="flex flex-col items-center leading-none">
                <span className="text-[clamp(11px,1.6vw,19px)] font-bold tracking-tight text-ink">{t.label}</span>
                <span className={clsx("tnum mt-1 text-[clamp(9px,1.15vw,13px)] font-bold", c.text)}>{t.caption}</span>
                {t.guests && <span className={clsx("mt-1 text-[clamp(8px,0.9vw,11px)] font-semibold", t.status === "cleaning" ? "text-cleaning" : "text-ink-2")}>{t.guests}</span>}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** The live list beside the camera view: every table, its state and how long it has been that way. */
export function LiveListVignette() {
  const rows: Array<{ label: string; status: Status; word: string; timer: string; meta: string }> = [
    { label: "M5", status: "free", word: "Free", timer: "08:02", meta: "2 seats · Main" },
    { label: "M4", status: "seated", word: "Seated", timer: "14:15", meta: "Party of 3 · Alex" },
    { label: "M2", status: "seated", word: "Seated", timer: "23:05", meta: "Party of 4 · Sam" },
    { label: "M7", status: "cleaning", word: "Needs cleaning", timer: "2:41", meta: "Released 20:38" },
    { label: "M1", status: "seated", word: "Seated", timer: "0:48", meta: "Party of 2 · Sam" },
  ];
  return (
    <div className="card w-full max-w-sm overflow-hidden" aria-hidden="true">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <span className="eyebrow">Tables M1–M8</span>
        <span className="pill !border-transparent !bg-seated-soft !text-seated">
          <span className="h-2 w-2 rounded-full bg-seated" /> Live
        </span>
      </div>
      <ul className="divide-y divide-border">
        {rows.map((r) => {
          const c = RING[r.status];
          return (
            <li key={r.label} className="flex items-center gap-3 px-4 py-2.5">
              <span className={clsx("grid h-10 w-10 shrink-0 place-items-center rounded-full border-[3px] text-xs font-bold", c.border, c.bg)}>{r.label}</span>
              <span className="min-w-0 flex-1">
                <span className={clsx("block text-[11px] font-extrabold uppercase tracking-wider", c.text)}>{r.word}</span>
                <span className="block truncate text-xs text-ink-2">{r.meta}</span>
              </span>
              <span className={clsx("tnum text-lg font-bold", r.status === "free" ? "text-ink-3" : r.status === "seated" ? "text-ink" : c.text)}>{r.timer}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** A phone lock screen with the alert, as in the video. */
export function NotificationVignette() {
  return (
    <div className="mx-auto w-[250px] rounded-[40px] border-[6px] border-ink/80 bg-bg p-3 shadow-lg" aria-hidden="true">
      <div className="mx-auto mb-5 h-5 w-24 rounded-full bg-ink/80" />
      <div className="text-center">
        <div className="tnum text-5xl font-extrabold tracking-tight">20:41</div>
        <div className="mt-1 text-xs font-semibold text-ink-2">Friday 23 October</div>
      </div>
      <div className="card mt-8 flex items-start gap-3 p-3 shadow-md">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand text-on-brand">
          <BellRing size={18} />
        </span>
        <div className="min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-ink-3">Waitly</span>
            <span className="text-[11px] text-ink-3">now</span>
          </div>
          <div className="text-sm font-bold">Table 2 · No server yet</div>
          <div className="text-xs text-ink-2">Seated 5 min, no server yet. Alex is on Main.</div>
        </div>
      </div>
      <div className="card mt-2 flex items-start gap-3 p-3 opacity-70">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand text-on-brand">
          <BellRing size={18} />
        </span>
        <div className="min-w-0">
          <div className="text-sm font-bold">Table 5 · Needs cleaning</div>
          <div className="text-xs text-ink-2">Released, to be cleaned.</div>
        </div>
      </div>
      <div className="mx-auto mt-10 h-1.5 w-28 rounded-full bg-ink/40" />
    </div>
  );
}

/** Amber to green: a released table becomes a clean one. */
export function TurnoverVignette() {
  return (
    <div className="flex flex-col items-center gap-5" aria-hidden="true">
      <div className="flex items-center gap-5 sm:gap-8">
        <div className="flex flex-col items-center gap-2">
          <Ring label="M5" status="cleaning" caption="3:02" size={96} alert />
          <span className="text-xs font-bold text-cleaning">Needs cleaning</span>
        </div>
        <ArrowRight className="text-ink-3" size={22} />
        <div className="flex flex-col items-center gap-2">
          <Ring label="M5" status="free" caption="Free" size={96} />
          <span className="text-xs font-bold text-free">Ready for guests</span>
        </div>
        <ArrowRight className="text-ink-3" size={22} />
        <div className="flex flex-col items-center gap-2">
          <Ring label="M5" status="seated" caption="0:19" size={96} />
          <span className="text-xs font-bold text-seated">Seated</span>
        </div>
      </div>
      <div className="card flex w-full max-w-sm items-center gap-3 p-3">
        <span className="h-2.5 w-2.5 rounded-full bg-cleaning" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold">
            Table 5 · <span className="text-cleaning">Released, to be cleaned</span>
          </span>
          <span className="block text-xs text-ink-2">Theo · reset usually takes 3 min</span>
        </span>
        <span className="btn btn-primary btn-sm">Mark cleaned</span>
      </div>
    </div>
  );
}

/** The host stand's answer to a line at the door. */
export function QueueVignette() {
  const parties = [
    { name: "Garcia", size: 2, waited: "11 min", table: "M1", eta: "now" },
    { name: "Walsh", size: 4, waited: "6 min", table: "M2", eta: "~6 min" },
    { name: "Hoffmann", size: 5, waited: "2 min", table: "M6", eta: "~14 min" },
  ];
  return (
    <div className="card w-full max-w-sm overflow-hidden" aria-hidden="true">
      <div className="border-b border-border px-4 py-3">
        <div className="eyebrow">Waiting queue</div>
        <div className="mt-2 flex items-center gap-5 pl-3">
          <Ring label="M2" status="seated" caption="24:39" size={64} ripple />
          <div>
            <div className="text-sm font-bold text-next">Next free table: M2 in ~6 min</div>
            <div className="text-xs text-ink-2">Sitting longest · party of 4 · usually 63 min</div>
          </div>
        </div>
      </div>
      <ul className="divide-y divide-border">
        {parties.map((p, i) => (
          <li key={p.name} className="flex items-center gap-3 px-4 py-2.5">
            <span className="tnum w-5 text-sm font-extrabold text-ink-3">{i + 1}</span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold">
                {p.name} <span className="font-semibold text-ink-2">· party of {p.size}</span>
              </span>
              <span className="block text-xs text-ink-2">waited {p.waited}</span>
            </span>
            <span className="pill !border-transparent !bg-next-soft !text-next">
              {p.table} {p.eta}
            </span>
          </li>
        ))}
      </ul>
      <div className="border-t border-border px-4 py-2 text-xs font-semibold text-ink-3">3 parties waiting · quotes come from the prediction</div>
    </div>
  );
}

/** Hours of the day, peaks in amber, servers to schedule beneath. */
export function PeakVignette() {
  const hours = [
    { h: "11", v: 12 },
    { h: "12", v: 68 },
    { h: "13", v: 55 },
    { h: "14", v: 30 },
    { h: "15", v: 18 },
    { h: "16", v: 16 },
    { h: "17", v: 34 },
    { h: "18", v: 62 },
    { h: "19", v: 92 },
    { h: "20", v: 84 },
    { h: "21", v: 46 },
    { h: "22", v: 22 },
  ];
  const servers = (v: number) => (v >= 60 ? 3 : v >= 28 ? 2 : 1);
  return (
    <div className="card w-full max-w-md p-4" aria-hidden="true">
      <div className="flex items-baseline justify-between">
        <div>
          <div className="eyebrow">Weekend</div>
          <div className="text-sm font-bold">Occupancy by hour</div>
        </div>
        <span className="pill !border-transparent !bg-cleaning-soft !text-cleaning">Peak 7–9pm</span>
      </div>
      <div className="mt-4 flex h-32 items-end gap-1.5">
        {hours.map((x) => (
          <div key={x.h} className="flex h-full flex-1 flex-col justify-end">
            <div className={clsx("w-full rounded-t-md", x.v >= 60 ? "bg-cleaning" : "bg-brand-soft")} style={{ height: `${x.v}%` }} />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-1.5">
        {hours.map((x) => (
          <div key={x.h} className="tnum flex-1 text-center text-[10px] font-semibold text-ink-3">
            {x.h}
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between rounded-xl bg-surface-2 px-3 py-2 text-xs font-semibold">
        <span className="text-ink-2">Servers to schedule</span>
        <span className="tnum flex gap-1.5">
          {hours.map((x) => (
            <span key={x.h} className={clsx("w-4 text-center", x.v >= 60 ? "text-cleaning" : "text-ink-3")}>
              {servers(x.v)}
            </span>
          ))}
        </span>
      </div>
      <div className="mt-2 text-xs text-ink-2">3 servers from 6pm, 2 at lunch, 1 in the afternoon. 16 covers per server.</div>
    </div>
  );
}

/** Three ways the floor learns what is happening. */
export function SourcesVignette() {
  const sources = [
    { icon: Pointer, title: "Staff taps", body: "Seat, server arrived, guests left, cleaned. Works on day one, no hardware." },
    { icon: Video, title: "Camera AI", body: "The security camera already on the ceiling sends occupied, empty or staff present." },
    { icon: Utensils, title: "POS", body: "An opened order means seated; a closed check means the table frees up soon." },
  ];
  return (
    <div className="grid w-full gap-3 sm:grid-cols-3" aria-hidden="true">
      {sources.map((s) => (
        <div key={s.title} className="card flex flex-col gap-2 p-4">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-soft text-brand">
            <s.icon size={20} strokeWidth={1.75} />
          </span>
          <div className="text-sm font-bold">{s.title}</div>
          <p className="text-xs leading-relaxed text-ink-2">{s.body}</p>
        </div>
      ))}
    </div>
  );
}
