import { describe, expect, it } from "vitest";
import { compareAlerts, evaluateAlerts } from "@/lib/alerts";
import { defaultSettings, defaultFloor } from "@/server/seed";
import type { Alert, Party, Table } from "@/lib/types";

const MIN = 60_000;
const settings = defaultSettings();

function tableSeated(minutesAgo: number, greetedAfterMin: number | null, now: number): Table {
  const t = { ...defaultFloor().tables[0] };
  const seatedAt = now - minutesAgo * MIN;
  return { ...t, status: "seated", statusSince: seatedAt, seatedAt, partySize: 2, greetedAt: greetedAfterMin === null ? null : seatedAt + greetedAfterMin * MIN, lastVisitAt: greetedAfterMin === null ? null : seatedAt + greetedAfterMin * MIN };
}

describe("no forgotten guest (no_greet)", () => {
  const now = Date.now();
  it("stays quiet under five minutes", () => {
    const c = evaluateAlerts([tableSeated(4.9, null, now)], [], [], settings, now);
    expect(c.open).toHaveLength(0);
  });
  it("opens an alert at five minutes with the table named", () => {
    const t = tableSeated(5.2, null, now);
    const c = evaluateAlerts([t], [], [], settings, now);
    expect(c.open).toHaveLength(1);
    expect(c.open[0]).toMatchObject({ type: "no_greet", tableId: t.id });
    expect(c.open[0].message).toContain("no server yet");
  });
  it("escalates at twice the threshold and resolves once greeted", () => {
    const t = tableSeated(10.5, null, now);
    const existing: Alert = { id: "a1", type: "no_greet", tableId: t.id, message: "", createdAt: now - 5 * MIN };
    const c = evaluateAlerts([t], [], [existing], settings, now);
    expect(c.escalate).toEqual(["a1"]);
    const greeted = { ...t, greetedAt: now - MIN, lastVisitAt: now - MIN };
    const c2 = evaluateAlerts([greeted], [], [existing], settings, now);
    expect(c2.resolve).toEqual(["a1"]);
  });
});

describe("tables ready faster (needs_cleaning)", () => {
  const now = Date.now();
  it("opens the moment a table is released and escalates past the cleaning SLA", () => {
    const t: Table = { ...defaultFloor().tables[1], status: "cleaning", statusSince: now - 0.2 * MIN };
    const c = evaluateAlerts([t], [], [], settings, now);
    expect(c.open[0]).toMatchObject({ type: "needs_cleaning", tableId: t.id });
    const late: Table = { ...t, statusSince: now - (settings.cleaningSlaMin + 0.5) * MIN };
    const a: Alert = { id: "c1", type: "needs_cleaning", tableId: t.id, message: "", createdAt: late.statusSince };
    expect(evaluateAlerts([late], [], [a], settings, now).escalate).toEqual(["c1"]);
    const clean: Table = { ...t, status: "free" };
    expect(evaluateAlerts([clean], [], [a], settings, now).resolve).toEqual(["c1"]);
  });
});

describe("waiting too long (long_wait)", () => {
  const now = Date.now();
  it("opens once a party is past its quote by the threshold", () => {
    const p: Party = { id: "p1", name: "Garcia", size: 2, joinedAt: now - 21 * MIN, quotedMinutes: 15, status: "waiting", source: "host" };
    const c = evaluateAlerts([], [p], [], settings, now);
    expect(c.open[0]).toMatchObject({ type: "long_wait", partyId: "p1" });
    const seated: Party = { ...p, status: "seated" };
    const a: Alert = { id: "w1", type: "long_wait", partyId: "p1", message: "", createdAt: now };
    expect(evaluateAlerts([], [seated], [a], settings, now).resolve).toEqual(["w1"]);
  });
});

describe("attention order", () => {
  const now = Date.now();
  const mk = (id: string, type: Alert["type"], ageMin: number, escalated = false): Alert => ({ id, type, message: "", createdAt: now - ageMin * MIN, escalatedAt: escalated ? now : null });
  it("puts escalated first, then the most urgent rule, then the oldest", () => {
    const list = [mk("clean", "needs_cleaning", 9), mk("greet-new", "no_greet", 1), mk("revisit-esc", "no_revisit", 2, true), mk("greet-old", "no_greet", 4), mk("wait", "long_wait", 6)];
    expect([...list].sort(compareAlerts).map((a) => a.id)).toEqual(["revisit-esc", "greet-old", "greet-new", "wait", "clean"]);
  });
});
