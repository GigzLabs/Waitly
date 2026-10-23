"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Lockup } from "@/components/logo";
import { Field, Stepper } from "@/components/ui";

interface Quote {
  venue: string;
  quotedMinutes: number;
  waiting: number;
}

/** Public page behind the QR code at the door: join the line from your phone. */
export default function JoinPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [size, setSize] = useState(2);
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/waitlist?size=${size}`, { signal: ctrl.signal })
        .then((r) => r.json())
        .then((j: Quote & { ok: boolean }) => j.ok && setQuote({ venue: j.venue, quotedMinutes: j.quotedMinutes, waiting: j.waiting }))
        .catch(() => undefined);
    }, 150);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [size]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Please tell us your name.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/waitlist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name.trim(), size, phone: phone.trim() || undefined, notes: notes.trim() || undefined }) });
      const j = (await res.json()) as { ok: boolean; partyId?: string; error?: string };
      if (!j.ok || !j.partyId) {
        setError(j.error ?? "We could not add you to the line. Please see the host.");
        return;
      }
      router.push(`/join/${j.partyId}`);
    } catch {
      setError("No connection. Please check your signal and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 py-8" style={{ paddingLeft: "max(16px, env(safe-area-inset-left, 0px))", paddingRight: "max(16px, env(safe-area-inset-right, 0px))" }}>
      <div className="flex flex-col items-center gap-2 text-center">
        <Lockup size={28} />
        <div className="eyebrow mt-3">{quote?.venue ?? "Waitlist"}</div>
        <h1 className="text-3xl font-bold tracking-tight">Join the line</h1>
      </div>

      <div className="card flex items-center justify-between gap-4 p-4">
        <div>
          <div className="text-xs font-bold text-ink-2">Current wait for a party of {size}</div>
          <div className="text-xs text-ink-3">{quote ? (quote.waiting === 0 ? "No one is ahead of you" : `${quote.waiting} part${quote.waiting === 1 ? "y" : "ies"} ahead of you`) : "Checking the floor…"}</div>
        </div>
        <div className="tnum text-3xl font-extrabold tracking-tight text-next">{quote ? (quote.quotedMinutes === 0 ? "Now" : `~${quote.quotedMinutes} min`) : "—"}</div>
      </div>

      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <Field label="Your name">
          <input id="join-name" className="input h-12" value={name} onChange={(e) => setName(e.target.value)} placeholder="Garcia" autoComplete="name" required />
        </Field>
        <Field label="Party size">
          <Stepper value={size} onChange={setSize} min={1} max={20} label="Party size" />
        </Field>
        <Field label="Mobile number (optional)" hint="So the host can reach you if you step away.">
          <input id="join-phone" className="input h-12" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 555 0142" autoComplete="tel" inputMode="tel" />
        </Field>
        <Field label="Anything we should know? (optional)">
          <input id="join-notes" className="input h-12" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Highchair, wheelchair access, birthday" />
        </Field>
        {error && (
          <p role="alert" className="rounded-xl bg-seated-soft px-3 py-2 text-sm font-semibold text-seated">
            {error}
          </p>
        )}
        <button type="submit" className="btn btn-primary btn-lg w-full" disabled={busy}>
          {busy ? "Adding you…" : `Join as a party of ${size}`}
        </button>
        <p className="text-center text-xs text-ink-3">You will get a page with your place in line. Keep it open, or come back to it any time.</p>
      </form>
    </main>
  );
}
