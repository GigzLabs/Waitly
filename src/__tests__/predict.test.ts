import { describe, expect, it } from "vitest";
import { buildDurationModel, predictNextFree, suggestQuote, suggestTables } from "@/lib/predict";
import { defaultFloor, defaultSettings, generateHistory } from "@/server/seed";
import type { Party, Table } from "@/lib/types";

const MIN = 60_000;
const settings = defaultSettings();

describe("the next free table", () => {
  const now = new Date(2026, 9, 23, 20, 0).getTime();
  const { tables } = defaultFloor();
  const events = generateHistory(tables, settings, now, 14);

  it("learns dining durations from history by party size", () => {
    const model = buildDurationModel(events);
    expect(model.overall.n).toBeGreaterThan(200);
    const small = model.cells["1-2|dinner"];
    const large = model.cells["5+|dinner"];
    expect(small.n).toBeGreaterThan(5);
    expect(large.mean).toBeGreaterThan(small.mean);
  });

  it("ranks free tables first, then the table that has been sitting longest", () => {
    const [m1, m2, m3] = tables;
    const live: Table[] = [
      { ...m1, status: "free" },
      { ...m2, status: "seated", seatedAt: now - 50 * MIN, statusSince: now - 50 * MIN, partySize: 4 },
      { ...m3, status: "seated", seatedAt: now - 5 * MIN, statusSince: now - 5 * MIN, partySize: 4 },
    ];
    const preds = predictNextFree(live, events, settings, now);
    expect(preds[0].tableId).toBe(m1.id);
    expect(preds[0].etaMin).toBe(0);
    expect(preds[1].tableId).toBe(m2.id);
    expect(preds[1].etaMin).toBeLessThan(preds[2].etaMin);
    expect(preds[1].reason).toMatch(/party of 4/);
  });

  it("matches waiting parties to tables that fit, biggest first in queue order", () => {
    const [m1, m2, , m4] = tables; // 2, 4, 6 seats
    const live: Table[] = [
      { ...m1, status: "free" },
      { ...m2, status: "seated", seatedAt: now - 60 * MIN, statusSince: now - 60 * MIN, partySize: 4 },
      { ...m4, status: "seated", seatedAt: now - 70 * MIN, statusSince: now - 70 * MIN, partySize: 6 },
    ];
    const preds = predictNextFree(live, events, settings, now);
    const parties: Party[] = [
      { id: "a", name: "A", size: 5, joinedAt: now - 10 * MIN, quotedMinutes: 20, status: "waiting", source: "host" },
      { id: "b", name: "B", size: 2, joinedAt: now - 5 * MIN, quotedMinutes: 10, status: "waiting", source: "host" },
    ];
    const s = suggestTables(parties, preds);
    expect(s.find((x) => x.partyId === "a")?.tableId).toBe(m4.id);
    expect(s.find((x) => x.partyId === "b")?.tableId).toBe(m1.id);
  });

  it("quotes zero when a fitting table is free and rounds up otherwise", () => {
    const [m1, m2] = tables;
    const live: Table[] = [
      { ...m1, status: "free" },
      { ...m2, status: "seated", seatedAt: now - 10 * MIN, statusSince: now - 10 * MIN, partySize: 4 },
    ];
    const preds = predictNextFree(live, events, settings, now);
    expect(suggestQuote(2, [], preds)).toBe(5);
    const q = suggestQuote(4, [], preds);
    expect(q % 5).toBe(0);
    expect(q).toBeGreaterThan(5);
  });
});
