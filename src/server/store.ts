import type { Action, ActionResult, Alert, EventRecord, Insights, Party, Section, Settings, Snapshot, Source, Staff, Table } from "@/lib/types";
import { evaluateAlerts } from "@/lib/alerts";
import { computeInsights } from "@/lib/insights";
import { predictNextFree, suggestQuote, suggestTables } from "@/lib/predict";
import { loadState, saveState } from "./persist";
import { newId, seedState, type State } from "./seed";
import { simulationStep } from "./sim";

const MIN = 60_000;
const MANUAL_LOCK_MS = 60_000;
const MAX_EVENTS = 40_000;
const TICK_MS = 2_000;

type Listener = (snapshot: Snapshot) => void;

export class WaitlyStore {
  state: State;
  version = 1;
  private listeners = new Set<Listener>();
  private saveTimer: NodeJS.Timeout | null = null;
  private tickTimer: NodeJS.Timeout | null = null;
  private dirty = false;

  constructor(initial?: State) {
    this.state = initial ?? loadState() ?? seedState();
    this.tick();
    this.tickTimer = setInterval(() => this.tick(), TICK_MS);
    // Do not keep the process alive just for the ticker (tests, build).
    this.tickTimer.unref?.();
  }

  // ---------- subscriptions ----------

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private notify(): void {
    this.version += 1;
    const snap = this.snapshot();
    for (const fn of this.listeners) {
      try {
        fn(snap);
      } catch (err) {
        console.error("[waitly] listener failed", err);
      }
    }
    this.scheduleSave();
  }

  private scheduleSave(): void {
    this.dirty = true;
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      if (this.dirty) {
        this.dirty = false;
        saveState(this.state);
      }
    }, 1000);
    this.saveTimer.unref?.();
  }

  // ---------- reads ----------

  snapshot(now = Date.now()): Snapshot {
    const { settings, sections, tables, alerts, parties, staff, events } = this.state;
    const predictions = predictNextFree(tables, events, settings, now);
    const suggestions = suggestTables(parties, predictions);
    const activeAlerts = alerts.filter((a) => !a.resolvedAt || now - a.resolvedAt < 30 * MIN);
    const activeParties = parties.filter((p) => p.status === "waiting" || p.status === "notified" || (p.leftAt && now - p.leftAt < 60 * MIN) || (p.seatedAt && now - p.seatedAt < 60 * MIN));
    return {
      version: this.version,
      now,
      settings: { ...settings, managerPin: "" , apiKey: settings.apiKey },
      sections,
      tables,
      alerts: activeAlerts,
      parties: activeParties,
      staff,
      predictions,
      suggestions,
      recentEvents: events.slice(-60),
    };
  }

  /** Settings including secrets, for the manager area after a PIN check. */
  secrets(): Pick<Settings, "managerPin" | "apiKey"> {
    return { managerPin: this.state.settings.managerPin, apiKey: this.state.settings.apiKey };
  }

  insights(days = 7, now = Date.now()): Insights {
    return computeInsights(this.state.events, this.state.tables, this.state.settings, now, days);
  }

  quoteFor(size: number, now = Date.now()): number {
    const predictions = predictNextFree(this.state.tables, this.state.events, this.state.settings, now);
    return suggestQuote(size, this.state.parties, predictions);
  }

  checkPin(pin?: string): boolean {
    return typeof pin === "string" && pin === this.state.settings.managerPin;
  }

  checkApiKey(key: string | null): boolean {
    return Boolean(key) && key === this.state.settings.apiKey;
  }

  // ---------- commands ----------

  dispatch(action: Action, source: Source = "manual", staffId?: string | null): ActionResult {
    const now = Date.now();
    try {
      const result = this.apply(action, source, staffId ?? null, now);
      if (result.ok) {
        this.applyAlertRules(now);
        this.notify();
        result.version = this.version;
      }
      return result;
    } catch (err) {
      console.error("[waitly] action failed", action.type, err);
      return { ok: false, error: err instanceof Error ? err.message : "Action failed" };
    }
  }

  private table(id: string): Table {
    const t = this.state.tables.find((x) => x.id === id);
    if (!t) throw new Error("Table not found");
    return t;
  }

  private party(id: string): Party {
    const p = this.state.parties.find((x) => x.id === id);
    if (!p) throw new Error("Party not found");
    return p;
  }

  private log(e: Omit<EventRecord, "id" | "ts"> & { ts?: number }): void {
    this.state.events.push({ id: newId("ev"), ts: e.ts ?? Date.now(), ...e });
    if (this.state.events.length > MAX_EVENTS) this.state.events.splice(0, this.state.events.length - MAX_EVENTS);
  }

  private lock(t: Table, source: Source, now: number): void {
    t.source = source;
    if (source === "manual") t.manualLockUntil = now + MANUAL_LOCK_MS;
  }

  private seatTable(t: Table, size: number, name: string | undefined, partyId: string | undefined, source: Source, staffId: string | null, now: number): void {
    if (t.status === "seated") throw new Error(`${t.label} is already seated`);
    if (t.status === "cleaning") {
      // Seating a dirty table counts as cleaned on the spot.
      this.log({ type: "cleaned", tableId: t.id, durationMs: now - t.statusSince, source, staffId });
    }
    t.status = "seated";
    t.statusSince = now;
    t.seatedAt = now;
    t.partySize = size;
    t.partyName = name ?? null;
    t.partyId = partyId ?? null;
    t.greetedAt = null;
    t.lastVisitAt = null;
    t.heldFor = null;
    this.lock(t, source, now);
    this.log({ type: "seated", tableId: t.id, partyId: partyId ?? null, size, source, staffId });
  }

  private apply(action: Action, source: Source, staffId: string | null, now: number): ActionResult {
    const s = this.state;
    switch (action.type) {
      case "seat": {
        const t = this.table(action.tableId);
        this.seatTable(t, action.size, action.name, action.partyId, source, action.staffId ?? staffId, now);
        return { ok: true, tableId: t.id };
      }
      case "serverArrived": {
        const t = this.table(action.tableId);
        if (t.status !== "seated") return { ok: false, error: `${t.label} is not seated` };
        const sid = action.staffId ?? staffId ?? this.serverFor(t)?.id ?? null;
        if (!t.greetedAt) {
          t.greetedAt = now;
          t.lastVisitAt = now;
          this.log({ type: "greeted", tableId: t.id, size: t.partySize ?? null, durationMs: now - (t.seatedAt ?? t.statusSince), source, staffId: sid });
        } else {
          this.log({ type: "visited", tableId: t.id, durationMs: now - (t.lastVisitAt ?? t.greetedAt), source, staffId: sid });
          t.lastVisitAt = now;
        }
        this.lock(t, source, now);
        this.resolveAlertsFor(t.id, ["no_greet", "no_revisit"], sid, now);
        return { ok: true, tableId: t.id };
      }
      case "guestsLeft": {
        const t = this.table(action.tableId);
        if (t.status !== "seated") return { ok: false, error: `${t.label} is not seated` };
        const seatedAt = t.seatedAt ?? t.statusSince;
        this.log({ type: "released", tableId: t.id, partyId: t.partyId ?? null, size: t.partySize ?? null, durationMs: now - seatedAt, source, staffId: action.staffId ?? staffId });
        t.status = "cleaning";
        t.statusSince = now;
        t.seatedAt = null;
        t.partySize = null;
        t.partyName = null;
        t.partyId = null;
        t.greetedAt = null;
        t.lastVisitAt = null;
        this.lock(t, source, now);
        this.resolveAlertsFor(t.id, ["no_greet", "no_revisit"], staffId, now);
        return { ok: true, tableId: t.id };
      }
      case "markCleaned": {
        const t = this.table(action.tableId);
        if (t.status !== "cleaning") return { ok: false, error: `${t.label} does not need cleaning` };
        this.log({ type: "cleaned", tableId: t.id, durationMs: now - t.statusSince, source, staffId: action.staffId ?? staffId });
        t.status = "free";
        t.statusSince = now;
        this.lock(t, source, now);
        this.resolveAlertsFor(t.id, ["needs_cleaning"], action.staffId ?? staffId, now);
        return { ok: true, tableId: t.id };
      }
      case "hold": {
        const t = this.table(action.tableId);
        if (t.status === "seated") return { ok: false, error: `${t.label} is seated` };
        t.status = "held";
        t.statusSince = now;
        t.heldFor = action.partyId ?? null;
        this.lock(t, source, now);
        this.log({ type: "held", tableId: t.id, partyId: action.partyId ?? null, source, staffId });
        return { ok: true, tableId: t.id };
      }
      case "unhold": {
        const t = this.table(action.tableId);
        if (t.status !== "held") return { ok: false, error: `${t.label} is not held` };
        t.status = "free";
        t.statusSince = now;
        t.heldFor = null;
        this.lock(t, source, now);
        this.log({ type: "unheld", tableId: t.id, source, staffId });
        return { ok: true, tableId: t.id };
      }
      case "setNote": {
        const t = this.table(action.tableId);
        t.note = action.note.trim() || null;
        return { ok: true, tableId: t.id };
      }
      case "assignServer": {
        const t = this.table(action.tableId);
        t.serverId = action.staffId;
        return { ok: true, tableId: t.id };
      }
      case "addParty": {
        const size = clampInt(action.size, 1, 20);
        const quoted = action.quotedMinutes ?? this.quoteFor(size, now);
        const p: Party = {
          id: newId("p"),
          name: (action.name || "Guest").trim().slice(0, 40),
          size,
          phone: action.phone?.trim() || null,
          notes: action.notes?.trim() || null,
          joinedAt: now,
          quotedMinutes: clampInt(quoted, 0, 240),
          status: "waiting",
          source: action.source ?? (source === "sim" ? "sim" : "host"),
        };
        s.parties.push(p);
        this.log({ type: "party_joined", partyId: p.id, size, source });
        return { ok: true, partyId: p.id };
      }
      case "updateParty": {
        const p = this.party(action.partyId);
        const patch = action.patch;
        if (patch.name !== undefined) p.name = patch.name.trim().slice(0, 40) || p.name;
        if (patch.size !== undefined) p.size = clampInt(patch.size, 1, 20);
        if (patch.phone !== undefined) p.phone = patch.phone?.trim() || null;
        if (patch.notes !== undefined) p.notes = patch.notes?.trim() || null;
        if (patch.quotedMinutes !== undefined) p.quotedMinutes = clampInt(patch.quotedMinutes, 0, 240);
        return { ok: true, partyId: p.id };
      }
      case "notifyParty": {
        const p = this.party(action.partyId);
        if (p.status !== "waiting" && p.status !== "notified") return { ok: false, error: "Party is not waiting" };
        p.status = "notified";
        p.notifiedAt = now;
        this.log({ type: "party_notified", partyId: p.id, source, staffId });
        return { ok: true, partyId: p.id };
      }
      case "seatParty": {
        const p = this.party(action.partyId);
        const t = this.table(action.tableId);
        if (p.status !== "waiting" && p.status !== "notified") return { ok: false, error: "Party is not waiting" };
        if (t.status === "held" && t.heldFor && t.heldFor !== p.id) return { ok: false, error: `${t.label} is held for another party` };
        this.seatTable(t, p.size, p.name, p.id, source, action.staffId ?? staffId, now);
        p.status = "seated";
        p.seatedAt = now;
        p.tableId = t.id;
        this.log({ type: "party_seated", partyId: p.id, tableId: t.id, size: p.size, durationMs: now - p.joinedAt, source, staffId });
        this.resolveAlertsForParty(p.id, staffId, now);
        return { ok: true, partyId: p.id, tableId: t.id };
      }
      case "partyLeft": {
        const p = this.party(action.partyId);
        if (p.status === "seated") return { ok: false, error: "Party is already seated" };
        p.status = "left";
        p.leftAt = now;
        this.log({ type: "party_left", partyId: p.id, size: p.size, durationMs: now - p.joinedAt, source, staffId });
        this.resolveAlertsForParty(p.id, staffId, now);
        for (const t of s.tables) if (t.status === "held" && t.heldFor === p.id) {
          t.status = "free";
          t.statusSince = now;
          t.heldFor = null;
        }
        return { ok: true, partyId: p.id };
      }
      case "ackAlert": {
        const a = s.alerts.find((x) => x.id === action.alertId);
        if (!a) return { ok: false, error: "Alert not found" };
        if (!a.acknowledgedAt) {
          a.acknowledgedAt = now;
          a.acknowledgedBy = action.staffId ?? staffId ?? null;
          this.log({ type: "alert_acknowledged", alertId: a.id, tableId: a.tableId ?? null, partyId: a.partyId ?? null, source, staffId });
        }
        return { ok: true };
      }
      case "resolveAlert": {
        const a = s.alerts.find((x) => x.id === action.alertId);
        if (!a) return { ok: false, error: "Alert not found" };
        this.resolveAlert(a, action.staffId ?? staffId ?? null, now);
        return { ok: true };
      }
      case "updateSettings": {
        if (!this.checkPin(action.pin)) return { ok: false, error: "Manager PIN required" };
        const patch = action.patch;
        const next: Settings = { ...s.settings };
        for (const key of Object.keys(patch) as Array<keyof Settings>) {
          const v = patch[key];
          if (v === undefined) continue;
          switch (key) {
            case "greetSlaMin":
            case "revisitSlaMin":
            case "cleaningSlaMin":
            case "longWaitSlaMin":
            case "coversPerServer":
            case "defaultDiningMin":
            case "openHour":
            case "closeHour":
              next[key] = clampInt(Number(v), key === "openHour" || key === "closeHour" ? 0 : 1, key === "openHour" || key === "closeHour" ? 24 : 600);
              break;
            case "venueName":
            case "slug":
            case "managerPin":
            case "apiKey":
              next[key] = String(v).trim().slice(0, 80);
              break;
            case "demoMode":
            case "soundOn":
              next[key] = Boolean(v);
              break;
          }
        }
        if (!next.venueName) next.venueName = s.settings.venueName;
        if (!next.managerPin) next.managerPin = s.settings.managerPin;
        if (!next.apiKey) next.apiKey = s.settings.apiKey;
        s.settings = next;
        return { ok: true };
      }
      case "upsertTable": {
        if (!this.checkPin(action.pin)) return { ok: false, error: "Manager PIN required" };
        const input = action.table;
        const existing = input.id ? s.tables.find((t) => t.id === input.id) : undefined;
        if (!s.sections.some((sec) => sec.id === input.sectionId)) return { ok: false, error: "Section not found" };
        if (existing) {
          existing.label = input.label.trim().slice(0, 8) || existing.label;
          existing.seats = clampInt(input.seats, 1, 30);
          existing.sectionId = input.sectionId;
          if (input.shape) existing.shape = input.shape;
          if (input.x !== undefined) existing.x = clamp(input.x, 0, 95);
          if (input.y !== undefined) existing.y = clamp(input.y, 0, 95);
          if (input.w !== undefined) existing.w = clamp(input.w, 6, 50);
          if (input.h !== undefined) existing.h = clamp(input.h, 6, 50);
          return { ok: true, tableId: existing.id };
        }
        const t: Table = {
          id: newId("t"),
          label: input.label.trim().slice(0, 8) || `T${s.tables.length + 1}`,
          seats: clampInt(input.seats, 1, 30),
          sectionId: input.sectionId,
          shape: input.shape ?? "square",
          x: input.x ?? 10 + (s.tables.length % 5) * 18,
          y: input.y ?? 10 + Math.floor(s.tables.length / 5) * 28,
          w: input.w ?? 16,
          h: input.h ?? 22,
          status: "free",
          statusSince: now,
        };
        s.tables.push(t);
        return { ok: true, tableId: t.id };
      }
      case "deleteTable": {
        if (!this.checkPin(action.pin)) return { ok: false, error: "Manager PIN required" };
        const idx = s.tables.findIndex((t) => t.id === action.tableId);
        if (idx < 0) return { ok: false, error: "Table not found" };
        if (s.tables[idx].status === "seated") return { ok: false, error: "Cannot delete a seated table" };
        s.tables.splice(idx, 1);
        for (const a of s.alerts) if (a.tableId === action.tableId && !a.resolvedAt) a.resolvedAt = now;
        return { ok: true };
      }
      case "upsertSection": {
        if (!this.checkPin(action.pin)) return { ok: false, error: "Manager PIN required" };
        const input = action.section;
        const existing = input.id ? s.sections.find((x) => x.id === input.id) : undefined;
        if (existing) {
          existing.name = input.name.trim().slice(0, 24) || existing.name;
          if (input.serverId !== undefined) existing.serverId = input.serverId;
          return { ok: true };
        }
        const sec: Section = { id: newId("sec"), name: input.name.trim().slice(0, 24) || "Section", serverId: input.serverId ?? null };
        s.sections.push(sec);
        return { ok: true };
      }
      case "deleteSection": {
        if (!this.checkPin(action.pin)) return { ok: false, error: "Manager PIN required" };
        if (s.sections.length <= 1) return { ok: false, error: "Keep at least one section" };
        if (s.tables.some((t) => t.sectionId === action.sectionId)) return { ok: false, error: "Move its tables first" };
        s.sections = s.sections.filter((x) => x.id !== action.sectionId);
        return { ok: true };
      }
      case "upsertStaff": {
        if (!this.checkPin(action.pin)) return { ok: false, error: "Manager PIN required" };
        const input = action.staff;
        const existing = input.id ? s.staff.find((x) => x.id === input.id) : undefined;
        if (existing) {
          existing.name = input.name.trim().slice(0, 24) || existing.name;
          existing.role = input.role;
          if (input.sectionIds) existing.sectionIds = input.sectionIds;
          if (input.onShift !== undefined) existing.onShift = input.onShift;
        } else {
          const st: Staff = { id: newId("st"), name: input.name.trim().slice(0, 24) || "Staff", role: input.role, sectionIds: input.sectionIds ?? [], onShift: input.onShift ?? true };
          s.staff.push(st);
          input.id = st.id;
        }
        // Keep section ownership in sync for servers.
        const member = s.staff.find((x) => x.id === input.id);
        if (member && member.role === "server") {
          for (const sec of s.sections) {
            if (member.sectionIds.includes(sec.id)) sec.serverId = member.id;
            else if (sec.serverId === member.id) sec.serverId = null;
          }
        }
        return { ok: true };
      }
      case "deleteStaff": {
        if (!this.checkPin(action.pin)) return { ok: false, error: "Manager PIN required" };
        s.staff = s.staff.filter((x) => x.id !== action.staffId);
        for (const sec of s.sections) if (sec.serverId === action.staffId) sec.serverId = null;
        for (const t of s.tables) if (t.serverId === action.staffId) t.serverId = null;
        return { ok: true };
      }
      case "toggleShift": {
        const st = s.staff.find((x) => x.id === action.staffId);
        if (!st) return { ok: false, error: "Staff not found" };
        st.onShift = !st.onShift;
        return { ok: true };
      }
      case "setDemo": {
        if (!this.checkPin(action.pin)) return { ok: false, error: "Manager PIN required" };
        s.settings.demoMode = action.on;
        return { ok: true };
      }
      case "resetDemo": {
        if (!this.checkPin(action.pin)) return { ok: false, error: "Manager PIN required" };
        const fresh = seedState(now);
        fresh.settings = { ...fresh.settings, managerPin: s.settings.managerPin, apiKey: s.settings.apiKey, venueName: s.settings.venueName, slug: s.settings.slug };
        this.state = fresh;
        return { ok: true };
      }
      case "ingest": {
        return this.ingest(action, now);
      }
    }
  }

  /** Camera-AI / POS events. A staff tap wins over the camera for a minute. */
  private ingest(action: Extract<Action, { type: "ingest" }>, now: number): ActionResult {
    const t = action.tableId
      ? this.state.tables.find((x) => x.id === action.tableId)
      : this.state.tables.find((x) => x.label.toLowerCase() === (action.label ?? "").toLowerCase());
    if (!t) return { ok: false, error: "Unknown table" };
    const source: Source = action.source ?? "camera";
    if ((action.confidence ?? 1) < 0.6) return { ok: true, tableId: t.id };
    if (t.manualLockUntil && now < t.manualLockUntil) return { ok: true, tableId: t.id };
    switch (action.state) {
      case "occupied":
        if (t.status === "free" || t.status === "cleaning") this.seatTable(t, action.partySize ?? Math.min(2, t.seats), undefined, undefined, source, null, now);
        return { ok: true, tableId: t.id };
      case "empty":
        if (t.status === "seated") return this.apply({ type: "guestsLeft", tableId: t.id }, source, null, now);
        return { ok: true, tableId: t.id };
      case "staff_present":
        if (t.status === "seated") return this.apply({ type: "serverArrived", tableId: t.id }, source, null, now);
        return { ok: true, tableId: t.id };
    }
  }

  serverFor(t: Table): Staff | undefined {
    const direct = t.serverId ? this.state.staff.find((x) => x.id === t.serverId) : undefined;
    if (direct) return direct;
    const sec = this.state.sections.find((x) => x.id === t.sectionId);
    return sec?.serverId ? this.state.staff.find((x) => x.id === sec.serverId) : undefined;
  }

  // ---------- alerts ----------

  private resolveAlert(a: Alert, staffId: string | null, now: number): void {
    if (a.resolvedAt) return;
    a.resolvedAt = now;
    a.resolvedBy = staffId;
    this.log({ type: "alert_resolved", alertId: a.id, alertType: a.type, tableId: a.tableId ?? null, partyId: a.partyId ?? null, durationMs: now - a.createdAt, staffId });
  }

  private resolveAlertsFor(tableId: string, types: Alert["type"][], staffId: string | null, now: number): void {
    for (const a of this.state.alerts) if (a.tableId === tableId && types.includes(a.type)) this.resolveAlert(a, staffId, now);
  }

  private resolveAlertsForParty(partyId: string, staffId: string | null, now: number): void {
    for (const a of this.state.alerts) if (a.partyId === partyId) this.resolveAlert(a, staffId, now);
  }

  /** Runs the SLA rules; returns whether anything changed. */
  private applyAlertRules(now: number): boolean {
    const s = this.state;
    const change = evaluateAlerts(s.tables, s.parties, s.alerts, s.settings, now);
    let changed = false;
    for (const o of change.open) {
      const a: Alert = { id: newId("al"), type: o.type, tableId: o.tableId ?? null, partyId: o.partyId ?? null, message: o.message, createdAt: now };
      s.alerts.push(a);
      this.log({ type: "alert_opened", alertId: a.id, alertType: a.type, tableId: a.tableId, partyId: a.partyId });
      changed = true;
    }
    for (const id of change.escalate) {
      const a = s.alerts.find((x) => x.id === id);
      if (a && !a.escalatedAt) {
        a.escalatedAt = now;
        this.log({ type: "alert_escalated", alertId: a.id, alertType: a.type, tableId: a.tableId ?? null, partyId: a.partyId ?? null });
        changed = true;
      }
    }
    for (const id of change.resolve) {
      const a = s.alerts.find((x) => x.id === id);
      if (a && !a.resolvedAt) {
        this.resolveAlert(a, null, now);
        changed = true;
      }
    }
    // Keep live messages fresh ("Seated 7 min, no server yet").
    for (const a of s.alerts) {
      if (a.resolvedAt) continue;
      const t = a.tableId ? s.tables.find((x) => x.id === a.tableId) : undefined;
      let msg = a.message;
      if (a.type === "no_greet" && t?.seatedAt) msg = `Seated ${Math.floor((now - t.seatedAt) / MIN)} min, no server yet`;
      if (a.type === "no_revisit" && t) msg = `No server visit for ${Math.floor((now - (t.lastVisitAt ?? t.greetedAt ?? t.statusSince)) / MIN)} min`;
      if (a.type === "needs_cleaning" && t) {
        const m = Math.floor((now - t.statusSince) / MIN);
        msg = m < 1 ? "Released, to be cleaned" : `Needs cleaning for ${m} min`;
      }
      if (a.type === "long_wait" && a.partyId) {
        const p = s.parties.find((x) => x.id === a.partyId);
        if (p) msg = `Waiting ${Math.floor((now - p.joinedAt) / MIN)} min, quoted ${p.quotedMinutes}`;
      }
      if (msg !== a.message) {
        a.message = msg;
        changed = true;
      }
    }
    // Drop resolved alerts older than a day from memory (history stays in events).
    const before = s.alerts.length;
    s.alerts = s.alerts.filter((a) => !a.resolvedAt || now - a.resolvedAt < 24 * 60 * MIN);
    if (s.alerts.length !== before) changed = true;
    return changed;
  }

  // ---------- ticker ----------

  tick(): void {
    const now = Date.now();
    let changed = false;
    if (this.state.settings.demoMode) {
      const versionBefore = this.version;
      simulationStep(this.state, now, (a, source) => {
        const r = this.apply(a, source, null, now);
        if (r.ok) changed = true;
      });
      if (this.version !== versionBefore) changed = true;
    }
    if (this.applyAlertRules(now)) changed = true;
    // Forget old guests from the live list.
    const before = this.state.parties.length;
    this.state.parties = this.state.parties.filter((p) => p.status === "waiting" || p.status === "notified" || now - (p.leftAt ?? p.seatedAt ?? p.joinedAt) < 6 * 60 * MIN);
    if (this.state.parties.length !== before) changed = true;
    if (changed) this.notify();
  }
}

function clampInt(n: number, lo: number, hi: number): number {
  const v = Math.round(Number.isFinite(n) ? n : lo);
  return Math.min(hi, Math.max(lo, v));
}
function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, Number.isFinite(n) ? n : lo));
}

// One store per process; survives Next.js hot reloads in development.
const g = globalThis as unknown as { __waitlyStore?: WaitlyStore };
export function getStore(): WaitlyStore {
  if (!g.__waitlyStore) g.__waitlyStore = new WaitlyStore();
  return g.__waitlyStore;
}
