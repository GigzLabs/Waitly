import type { EventRecord, Party, Prediction, Settings, Table, WaitSuggestion } from "./types";

const MIN = 60_000;

export type SizeBand = "1-2" | "3-4" | "5+";
export type HourBand = "lunch" | "dinner" | "other";

export function sizeBand(size: number): SizeBand {
  if (size <= 2) return "1-2";
  if (size <= 4) return "3-4";
  return "5+";
}

export function hourBand(ts: number): HourBand {
  const h = new Date(ts).getHours();
  if (h >= 11 && h < 15) return "lunch";
  if (h >= 17 && h < 23) return "dinner";
  return "other";
}

export interface DurationModel {
  /** Mean dining minutes by size band and hour band, with sample counts. */
  cells: Record<string, { mean: number; n: number }>;
  overall: { mean: number; n: number };
  cleaningMean: number;
  cleaningN: number;
}

/** Learns typical dining and cleaning durations from the venue's own history. */
export function buildDurationModel(events: EventRecord[]): DurationModel {
  const cells: Record<string, { sum: number; n: number }> = {};
  let sum = 0;
  let n = 0;
  let cSum = 0;
  let cN = 0;
  for (const e of events) {
    if (e.type === "released" && e.durationMs && e.durationMs > 5 * MIN && e.durationMs < 6 * 60 * MIN) {
      const key = `${sizeBand(e.size ?? 2)}|${hourBand(e.ts - e.durationMs)}`;
      const c = (cells[key] ??= { sum: 0, n: 0 });
      c.sum += e.durationMs / MIN;
      c.n += 1;
      sum += e.durationMs / MIN;
      n += 1;
    } else if (e.type === "cleaned" && e.durationMs && e.durationMs > 0 && e.durationMs < 60 * MIN) {
      cSum += e.durationMs / MIN;
      cN += 1;
    }
  }
  const out: DurationModel["cells"] = {};
  for (const [k, v] of Object.entries(cells)) out[k] = { mean: v.sum / v.n, n: v.n };
  return {
    cells: out,
    overall: { mean: n ? sum / n : 0, n },
    cleaningMean: cN ? cSum / cN : 4,
    cleaningN: cN,
  };
}

export function expectedDiningMin(model: DurationModel, size: number, seatedAt: number, settings: Settings): { mean: number; n: number } {
  const cell = model.cells[`${sizeBand(size)}|${hourBand(seatedAt)}`];
  if (cell && cell.n >= 5) return cell;
  if (model.overall.n >= 5) return model.overall;
  return { mean: settings.defaultDiningMin, n: 0 };
}

/**
 * "If there's a line at the entrance, staff can see which table will be available first."
 * Ranks every table by when it should be ready for the next party: free tables now,
 * tables being cleaned when the clean is expected to finish, seated tables when the
 * venue's own dining durations say the party should leave, plus a clean.
 */
export function predictNextFree(tables: Table[], events: EventRecord[], settings: Settings, now: number): Prediction[] {
  const model = buildDurationModel(events);
  const cleaning = model.cleaningN >= 5 ? model.cleaningMean : 4;
  const preds: Prediction[] = tables.map((t) => {
    if (t.status === "free") {
      return { tableId: t.id, label: t.label, seats: t.seats, status: t.status, etaMin: 0, confidence: "high", reason: "Free now" };
    }
    if (t.status === "cleaning") {
      const dirtyMin = (now - t.statusSince) / MIN;
      const eta = Math.max(0, cleaning - dirtyMin);
      return {
        tableId: t.id,
        label: t.label,
        seats: t.seats,
        status: t.status,
        etaMin: round(eta),
        confidence: "high",
        reason: eta <= 0.5 ? "Being cleaned now" : `Cleaning usually takes ${Math.round(cleaning)} min`,
      };
    }
    if (t.status === "held") {
      return { tableId: t.id, label: t.label, seats: t.seats, status: t.status, etaMin: 999, confidence: "low", reason: "Held for a party" };
    }
    const seatedAt = t.seatedAt ?? t.statusSince;
    const size = t.partySize ?? Math.min(t.seats, 2);
    const { mean, n } = expectedDiningMin(model, size, seatedAt, settings);
    const elapsed = (now - seatedAt) / MIN;
    const remaining = mean - elapsed;
    const eta = Math.max(0, remaining) + cleaning;
    let confidence: Prediction["confidence"] = n >= 20 ? "high" : n >= 5 ? "medium" : "low";
    if (elapsed > mean * 1.3) confidence = "low";
    const reason =
      remaining <= 0
        ? `Seated ${Math.round(elapsed)} min, past the usual ${Math.round(mean)} min for a party of ${size}`
        : `Seated ${Math.round(elapsed)} min of a usual ${Math.round(mean)} min for a party of ${size}`;
    return { tableId: t.id, label: t.label, seats: t.seats, status: t.status, etaMin: round(eta), confidence, reason };
  });
  return preds.sort((a, b) => a.etaMin - b.etaMin || a.seats - b.seats || a.label.localeCompare(b.label));
}

function round(n: number): number {
  return Math.round(n * 2) / 2;
}

/**
 * Matches each waiting party, in queue order, to the table that should be ready first
 * and fits the party. Bigger parties cannot take smaller tables; a table may be
 * up to three seats larger than the party before a tighter fit is preferred.
 */
export function suggestTables(parties: Party[], predictions: Prediction[]): WaitSuggestion[] {
  const waiting = parties.filter((p) => p.status === "waiting" || p.status === "notified").sort((a, b) => a.joinedAt - b.joinedAt);
  const taken = new Set<string>();
  const out: WaitSuggestion[] = [];
  for (const p of waiting) {
    const candidates = predictions
      .filter((x) => !taken.has(x.tableId) && x.status !== "held" && x.seats >= p.size)
      .map((x) => ({ x, score: x.etaMin + Math.max(0, x.seats - p.size - 1) * 4 }))
      .sort((a, b) => a.score - b.score);
    const best = candidates[0]?.x;
    if (best) {
      taken.add(best.tableId);
      out.push({ partyId: p.id, tableId: best.tableId, label: best.label, etaMin: best.etaMin, confidence: best.confidence });
    } else {
      out.push({ partyId: p.id, tableId: null, label: null, etaMin: 999, confidence: "low" });
    }
  }
  return out;
}

/** A quote to give a new party, derived from the prediction rather than guessed. */
export function suggestQuote(size: number, parties: Party[], predictions: Prediction[]): number {
  const probe: Party = {
    id: "__probe__",
    name: "",
    size,
    joinedAt: Number.MAX_SAFE_INTEGER,
    quotedMinutes: 0,
    status: "waiting",
    source: "host",
  };
  const s = suggestTables([...parties, probe], predictions).find((x) => x.partyId === "__probe__");
  if (!s || s.tableId === null) return 30;
  // Round up to the next 5 minutes and add a 2 minute buffer for walking and resetting.
  return Math.max(0, Math.ceil((s.etaMin + 2) / 5) * 5);
}
