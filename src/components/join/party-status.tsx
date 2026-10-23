"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Lockup } from "@/components/logo";
import { formatElapsed } from "@/lib/format";

interface Status {
  venue: string;
  party: { name: string; size: number; status: "waiting" | "notified" | "seated" | "left" | "no_show"; joinedAt: number; quotedMinutes: number; notifiedAt: number | null; seatedAt: number | null };
  position: number | null;
  etaMin: number | null;
  tableLabel: string | null;
  now: number;
}

const GUTTER = { paddingLeft: "max(16px, env(safe-area-inset-left, 0px))", paddingRight: "max(16px, env(safe-area-inset-right, 0px))" } as const;

function Frame({ venue, children }: { venue: string | null; children: React.ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 py-8" style={GUTTER}>
      <div className="flex flex-col items-center gap-2 text-center">
        <Lockup size={28} />
        <div className="eyebrow mt-3">{venue ?? "Waitlist"}</div>
      </div>
      {children}
    </main>
  );
}

/** A guest's place in line, refreshed every few seconds. */
export function PartyStatus({ id }: { id: string }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [gone, setGone] = useState(false);
  const [offline, setOffline] = useState(false);
  const [now, setNow] = useState(() => 0);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!id) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const load = async () => {
      try {
        const res = await fetch(`/api/waitlist/${id}`, { cache: "no-store" });
        if (res.status === 404) {
          setGone(true);
          return;
        }
        const j = (await res.json()) as Status & { ok: boolean };
        if (!j.ok) {
          setGone(true);
          return;
        }
        setStatus(j);
        setNow(Date.now());
        setOffline(false);
        if (j.party.status === "seated" || j.party.status === "left" || j.party.status === "no_show") return;
      } catch {
        setOffline(true);
      }
      if (!stopped) timer = setTimeout(load, 8000);
    };
    load();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, [id]);

  const leave = async () => {
    if (!id) return;
    setLeaving(true);
    try {
      const res = await fetch(`/api/waitlist/${id}`, { method: "DELETE" });
      const j = (await res.json()) as { ok: boolean };
      if (j.ok) setStatus((s) => (s ? { ...s, party: { ...s.party, status: "left" }, position: null } : s));
    } finally {
      setLeaving(false);
      setConfirmLeave(false);
    }
  };

  const venue = status?.venue ?? null;

  if (gone) {
    return (
      <Frame venue={venue}>
        <div className="card flex flex-col items-center gap-3 p-6 text-center">
          <h1 className="text-2xl font-bold tracking-tight">This link has expired</h1>
          <p className="text-sm text-ink-2">We could not find your spot in line. If you were waiting, please see the host, or join again.</p>
          <Link href="/join" className="btn btn-primary mt-2">
            Join the line
          </Link>
        </div>
      </Frame>
    );
  }

  if (!status) {
    return (
      <Frame venue={venue}>
        <div className="card p-6 text-center text-sm font-semibold text-ink-3">{offline ? "No connection. Trying again…" : "Finding your place in line…"}</div>
      </Frame>
    );
  }

  const p = status.party;
  const waited = now ? formatElapsed(now - p.joinedAt) : "0:00";

  return (
    <Frame venue={venue}>
      {p.status === "waiting" && (
        <>
          <div className="card flex flex-col items-center gap-1 p-6 text-center">
            <div className="text-sm font-bold text-ink-2">
              {p.name}, party of {p.size}
            </div>
            <div className="tnum text-[72px] font-extrabold leading-none tracking-tight text-next">#{status.position ?? "—"}</div>
            <div className="text-lg font-bold tracking-tight">{status.position === 1 ? "You're next in line" : `You're #${status.position} in line`}</div>
            <div className="mt-3 text-sm text-ink-2">{status.etaMin === null ? "We'll update this as tables turn." : status.etaMin <= 0.5 ? "A table is being prepared for you." : `Likely ready in ~${Math.round(status.etaMin)} min`}</div>
          </div>
          <dl className="grid grid-cols-2 gap-3">
            <div className="card p-4">
              <dt className="eyebrow">Waiting</dt>
              <dd className="tnum mt-1 text-2xl font-extrabold tracking-tight">{waited}</dd>
            </div>
            <div className="card p-4">
              <dt className="eyebrow">Quoted</dt>
              <dd className="tnum mt-1 text-2xl font-extrabold tracking-tight">{p.quotedMinutes === 0 ? "Now" : `${p.quotedMinutes} min`}</dd>
            </div>
          </dl>
          <p className="text-center text-xs text-ink-3">Keep this page open. We will tell the host when your table is ready, and this page will update.</p>
        </>
      )}

      {p.status === "notified" && (
        <div className="card flex flex-col items-center gap-2 border-free bg-free-soft p-6 text-center">
          <div className="grid h-14 w-14 place-items-center rounded-full border-[3px] border-free bg-surface text-lg font-bold">{status.tableLabel ?? "✓"}</div>
          <h1 className="text-2xl font-bold tracking-tight text-free">Your table is ready</h1>
          <p className="text-sm text-ink-2">
            {p.name}, party of {p.size}. Please see the host.
          </p>
        </div>
      )}

      {p.status === "seated" && (
        <div className="card flex flex-col items-center gap-2 p-6 text-center">
          <div className="grid h-14 w-14 place-items-center rounded-full border-[3px] border-seated bg-seated-soft text-lg font-bold">{status.tableLabel ?? "—"}</div>
          <h1 className="text-2xl font-bold tracking-tight">Enjoy your meal{status.tableLabel ? ` at table ${status.tableLabel}` : ""}</h1>
          <p className="text-sm text-ink-2">You waited {p.seatedAt ? formatElapsed(p.seatedAt - p.joinedAt) : waited}. Thank you for your patience.</p>
        </div>
      )}

      {(p.status === "left" || p.status === "no_show") && (
        <div className="card flex flex-col items-center gap-3 p-6 text-center">
          <h1 className="text-2xl font-bold tracking-tight">You left the line</h1>
          <p className="text-sm text-ink-2">Your spot has been released. You are welcome back any time.</p>
          <Link href="/join" className="btn btn-primary mt-1">
            Join again
          </Link>
        </div>
      )}

      {(p.status === "waiting" || p.status === "notified") && (
        <div className="mt-2 flex flex-col gap-2">
          {!confirmLeave ? (
            <button className="btn btn-secondary w-full" onClick={() => setConfirmLeave(true)}>
              Leave the line
            </button>
          ) : (
            <div className="card flex flex-col gap-3 p-4">
              <p className="text-sm font-semibold">Leave the line? Your spot goes to the next party.</p>
              <div className="flex gap-2">
                <button className="btn btn-secondary flex-1" onClick={() => setConfirmLeave(false)} disabled={leaving}>
                  Stay
                </button>
                <button className="btn btn-danger flex-1" onClick={leave} disabled={leaving}>
                  {leaving ? "Leaving…" : "Yes, leave"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </Frame>
  );
}
