"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import type { Action, ActionResult, Alert, Snapshot, Staff } from "./types";
import { alertTitle } from "./alerts";

export interface Toast {
  id: string;
  title: string;
  body?: string;
  tone: "info" | "alert" | "success" | "danger";
  createdAt: number;
}

interface WaitlyContextValue {
  snapshot: Snapshot | null;
  connected: boolean;
  dispatch: (action: Action) => Promise<ActionResult>;
  staff: Staff | null;
  setStaffId: (id: string | null) => void;
  toasts: Toast[];
  notify: (t: Omit<Toast, "id" | "createdAt">) => void;
  dismissToast: (id: string) => void;
  pin: string | null;
  setPin: (pin: string | null) => void;
  theme: "light" | "dark";
  setTheme: (t: "light" | "dark") => void;
}

const WaitlyContext = createContext<WaitlyContextValue | null>(null);

const LOCAL_EVENT = "waitly-local";

function readLocal(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeLocal(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* storage unavailable */
  }
  window.dispatchEvent(new Event(LOCAL_EVENT));
}
function subscribeLocal(cb: () => void): () => void {
  window.addEventListener("storage", cb);
  window.addEventListener(LOCAL_EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(LOCAL_EVENT, cb);
  };
}
/** A localStorage value as React state: null on the server, live in the browser. */
function useLocal(key: string): string | null {
  return useSyncExternalStore(
    subscribeLocal,
    () => readLocal(key),
    () => null,
  );
}
function readTheme(): "light" | "dark" {
  const stored = readLocal("waitly-theme");
  if (stored === "light" || stored === "dark") return stored;
  return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
}

let audioCtx: AudioContext | null = null;
/** Two soft tones, generated so no audio file is needed. */
export function playChime(): void {
  try {
    audioCtx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const ctx = audioCtx;
    const t0 = ctx.currentTime;
    [660, 880].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t0 + i * 0.16);
      gain.gain.exponentialRampToValueAtTime(0.18, t0 + i * 0.16 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.16 + 0.3);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0 + i * 0.16);
      osc.stop(t0 + i * 0.16 + 0.32);
    });
  } catch {
    /* no audio */
  }
}

export function WaitlyProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [connected, setConnected] = useState(false);
  const staffId = useLocal("waitly-staff");
  const pin = useLocal("waitly-pin");
  const theme = useSyncExternalStore(subscribeLocal, readTheme, () => "dark" as const);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const knownAlerts = useRef<Set<string> | null>(null);
  const snapshotRef = useRef<Snapshot | null>(null);

  const notify = useCallback((t: Omit<Toast, "id" | "createdAt">) => {
    const toast: Toast = { ...t, id: Math.random().toString(36).slice(2), createdAt: Date.now() };
    setToasts((xs) => [toast, ...xs].slice(0, 4));
    setTimeout(() => setToasts((xs) => xs.filter((x) => x.id !== toast.id)), 7000);
  }, []);

  const dismissToast = useCallback((id: string) => setToasts((xs) => xs.filter((x) => x.id !== id)), []);

  // Live connection with automatic reconnect.
  useEffect(() => {
    let es: EventSource | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;
    const connect = () => {
      if (stopped) return;
      es = new EventSource("/api/stream");
      es.addEventListener("snapshot", (e) => {
        const snap = JSON.parse((e as MessageEvent).data) as Snapshot;
        snapshotRef.current = snap;
        setSnapshot(snap);
        setConnected(true);
      });
      es.onerror = () => {
        setConnected(false);
        es?.close();
        retry = setTimeout(connect, 2000);
      };
    };
    connect();
    return () => {
      stopped = true;
      es?.close();
      if (retry) clearTimeout(retry);
    };
  }, []);

  // Surface new alerts: toast, chime, and a browser notification when the tab is hidden.
  useEffect(() => {
    if (!snapshot) return;
    const open = snapshot.alerts.filter((a) => !a.resolvedAt);
    if (knownAlerts.current === null) {
      knownAlerts.current = new Set(open.map((a) => a.id));
      return;
    }
    const fresh: Alert[] = open.filter((a) => !knownAlerts.current!.has(a.id));
    knownAlerts.current = new Set(open.map((a) => a.id));
    if (!fresh.length) return;
    for (const a of fresh) {
      const table = a.tableId ? snapshot.tables.find((t) => t.id === a.tableId) : null;
      const party = a.partyId ? snapshot.parties.find((p) => p.id === a.partyId) : null;
      const where = table ? `Table ${table.label}` : party ? `${party.name}, party of ${party.size}` : "Floor";
      notify({ title: `${where} · ${alertTitle(a.type)}`, body: a.message, tone: "alert" });
      if (typeof Notification !== "undefined" && Notification.permission === "granted" && document.visibilityState === "hidden") {
        try {
          new Notification(`${snapshot.settings.venueName} · ${where}`, { body: a.message, tag: a.id, icon: "/icon.svg" });
        } catch {
          /* notifications unavailable */
        }
      }
    }
    if (snapshot.settings.soundOn && readLocal("waitly-sound") !== "off") playChime();
  }, [snapshot, notify]);

  const dispatch = useCallback(
    async (action: Action): Promise<ActionResult> => {
      try {
        const res = await fetch("/api/actions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: withPin(action, pin), staffId }),
        });
        const result = (await res.json()) as ActionResult;
        if (!result.ok) notify({ title: "That did not work", body: result.error ?? "Please try again.", tone: "danger" });
        return result;
      } catch {
        notify({ title: "No connection", body: "The change was not saved. Check the network and try again.", tone: "danger" });
        return { ok: false, error: "network" };
      }
    },
    [notify, pin, staffId],
  );

  const setStaffId = useCallback((id: string | null) => writeLocal("waitly-staff", id), []);
  const setPin = useCallback((p: string | null) => writeLocal("waitly-pin", p), []);
  const setTheme = useCallback((t: "light" | "dark") => {
    document.documentElement.setAttribute("data-theme", t);
    writeLocal("waitly-theme", t);
  }, []);

  const staff = useMemo(() => snapshot?.staff.find((s) => s.id === staffId) ?? null, [snapshot, staffId]);

  const value = useMemo<WaitlyContextValue>(
    () => ({ snapshot, connected, dispatch, staff, setStaffId, toasts, notify, dismissToast, pin, setPin, theme, setTheme }),
    [snapshot, connected, dispatch, staff, setStaffId, toasts, notify, dismissToast, pin, setPin, theme, setTheme],
  );

  return <WaitlyContext.Provider value={value}>{children}</WaitlyContext.Provider>;
}

function withPin(action: Action, pin: string | null): Action {
  if (!pin) return action;
  switch (action.type) {
    case "updateSettings":
    case "upsertTable":
    case "deleteTable":
    case "upsertSection":
    case "deleteSection":
    case "upsertStaff":
    case "deleteStaff":
    case "setDemo":
    case "resetDemo":
      return { ...action, pin: action.pin ?? pin };
    default:
      return action;
  }
}

export function useWaitly(): WaitlyContextValue {
  const ctx = useContext(WaitlyContext);
  if (!ctx) throw new Error("useWaitly must be used inside WaitlyProvider");
  return ctx;
}

/** A clock that ticks every `intervalMs`, for timers that must keep running between server updates. */
export function useNow(intervalMs = 1000): number {
  // 0 on the server so the static shell never bakes in a timestamp. In the browser the value
  // is quantised to the interval, so React re-renders exactly once per tick.
  const subscribe = useCallback(
    (cb: () => void) => {
      const id = setInterval(cb, Math.max(100, intervalMs / 4));
      return () => clearInterval(id);
    },
    [intervalMs],
  );
  const getSnapshot = useCallback(() => Math.floor(Date.now() / intervalMs) * intervalMs, [intervalMs]);
  return useSyncExternalStore(subscribe, getSnapshot, () => 0);
}
