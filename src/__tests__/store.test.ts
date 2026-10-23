import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WaitlyStore } from "@/server/store";
import { defaultFloor, defaultSettings, type State } from "@/server/seed";

const MIN = 60_000;

function freshState(): State {
  const { sections, tables, staff } = defaultFloor();
  return { settings: { ...defaultSettings(), demoMode: false, managerPin: "4321" }, sections, tables, alerts: [], parties: [], staff, events: [] };
}

describe("the floor", () => {
  let store: WaitlyStore;
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 23, 19, 0));
    store = new WaitlyStore(freshState());
  });
  afterEach(() => vi.useRealTimers());

  it("runs a full visit: seat, greet, leave, clean", () => {
    const t = store.state.tables[0];
    expect(store.dispatch({ type: "seat", tableId: t.id, size: 2, name: "Okafor" }).ok).toBe(true);
    expect(t.status).toBe("seated");
    expect(t.partyName).toBe("Okafor");
    vi.advanceTimersByTime(3 * MIN);
    expect(store.dispatch({ type: "serverArrived", tableId: t.id }).ok).toBe(true);
    expect(t.greetedAt).toBeTruthy();
    vi.advanceTimersByTime(40 * MIN);
    expect(store.dispatch({ type: "guestsLeft", tableId: t.id }).ok).toBe(true);
    expect(t.status).toBe("cleaning");
    expect(store.state.alerts.some((a) => a.type === "needs_cleaning" && a.tableId === t.id && !a.resolvedAt)).toBe(true);
    vi.advanceTimersByTime(2 * MIN);
    expect(store.dispatch({ type: "markCleaned", tableId: t.id }).ok).toBe(true);
    expect(t.status).toBe("free");
    expect(store.state.alerts.every((a) => a.resolvedAt)).toBe(true);
    const types = store.state.events.map((e) => e.type);
    expect(types).toEqual(expect.arrayContaining(["seated", "greeted", "released", "cleaned", "alert_opened", "alert_resolved"]));
    const released = store.state.events.find((e) => e.type === "released");
    expect(released?.durationMs).toBe(43 * MIN);
  });

  it("raises the no-server alert at five minutes and clears it when the server arrives", () => {
    const t = store.state.tables[1];
    store.dispatch({ type: "seat", tableId: t.id, size: 3 });
    vi.advanceTimersByTime(4 * MIN);
    store.tick();
    expect(store.state.alerts.filter((a) => !a.resolvedAt)).toHaveLength(0);
    vi.advanceTimersByTime(1.5 * MIN);
    store.tick();
    const open = store.state.alerts.filter((a) => !a.resolvedAt);
    expect(open).toHaveLength(1);
    expect(open[0].type).toBe("no_greet");
    store.dispatch({ type: "serverArrived", tableId: t.id, staffId: "st_sam" });
    expect(store.state.alerts[0].resolvedAt).toBeTruthy();
    expect(store.state.alerts[0].resolvedBy).toBe("st_sam");
  });

  it("accepts camera events but lets a staff tap win for a minute", () => {
    const t = store.state.tables[2];
    const r = store.dispatch({ type: "ingest", label: t.label, state: "occupied", confidence: 0.9, partySize: 4 }, "camera");
    expect(r.ok).toBe(true);
    expect(t.status).toBe("seated");
    expect(t.source).toBe("camera");
    store.dispatch({ type: "serverArrived", tableId: t.id }); // manual, locks the table
    store.dispatch({ type: "ingest", label: t.label, state: "empty" }, "camera");
    expect(t.status).toBe("seated");
    vi.advanceTimersByTime(61_000);
    store.dispatch({ type: "ingest", label: t.label, state: "empty" }, "camera");
    expect(t.status).toBe("cleaning");
    expect(store.dispatch({ type: "ingest", label: "ZZ", state: "empty" }, "camera").ok).toBe(false);
    expect(store.dispatch({ type: "ingest", label: t.label, state: "occupied", confidence: 0.3 }, "camera").ok).toBe(true);
    expect(t.status).toBe("cleaning");
  });

  it("protects manager settings with the PIN", () => {
    expect(store.dispatch({ type: "updateSettings", patch: { greetSlaMin: 7 } }).ok).toBe(false);
    expect(store.dispatch({ type: "updateSettings", patch: { greetSlaMin: 7 }, pin: "0000" }).ok).toBe(false);
    expect(store.dispatch({ type: "updateSettings", patch: { greetSlaMin: 7 }, pin: "4321" }).ok).toBe(true);
    expect(store.state.settings.greetSlaMin).toBe(7);
    expect(store.snapshot().settings.managerPin).toBe("");
  });

  it("runs the waitlist: quote, seat from the queue, record the wait", () => {
    for (const t of store.state.tables) if (t.seats >= 4) store.dispatch({ type: "seat", tableId: t.id, size: 4 });
    const r = store.dispatch({ type: "addParty", name: "Walsh", size: 4 });
    expect(r.ok).toBe(true);
    const party = store.state.parties.find((p) => p.id === r.partyId)!;
    expect(party.quotedMinutes).toBeGreaterThan(0);
    const snap = store.snapshot();
    expect(snap.suggestions.find((s) => s.partyId === party.id)?.tableId).toBeTruthy();
    const target = store.state.tables.find((t) => t.seats >= 4)!;
    vi.advanceTimersByTime(12 * MIN);
    store.dispatch({ type: "guestsLeft", tableId: target.id });
    store.dispatch({ type: "markCleaned", tableId: target.id });
    expect(store.dispatch({ type: "seatParty", partyId: party.id, tableId: target.id }).ok).toBe(true);
    expect(party.status).toBe("seated");
    expect(target.partyName).toBe("Walsh");
    const seatedEv = store.state.events.find((e) => e.type === "party_seated" && e.partyId === party.id);
    expect(seatedEv?.durationMs).toBe(12 * MIN);
  });
});
