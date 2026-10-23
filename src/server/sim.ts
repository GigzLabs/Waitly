import type { Action } from "@/lib/types";
import { demandAt, diningMinutes, mulberry32, randomName } from "./seed";
import type { State } from "./seed";

const MIN = 60_000;

/**
 * Demo simulation. Runs on real time (timers are real), acting every tick with
 * probabilities tuned so a two minute demo shows a greet, an alert, a release,
 * a clean and a seating from the queue. Everything goes through the same
 * actions staff would use, tagged with source "sim".
 */
export function simulationStep(state: State, now: number, dispatch: (a: Action, source: "sim") => void): void {
  const rand = mulberry32(Math.floor(now / 1000));
  const hour = new Date(now).getHours() + new Date(now).getMinutes() / 60;
  const demand = Math.max(0.35, demandAt(hour, new Date(now).getDay()));
  const tables = state.tables;
  const seatedCount = tables.filter((t) => t.status === "seated").length;
  const occupancy = seatedCount / Math.max(1, tables.length);

  for (const t of tables) {
    if (t.status === "seated" && t.seatedAt) {
      const elapsedMin = (now - t.seatedAt) / MIN;
      // Expected stay is fixed per visit so a table does not leave at random.
      const visitRand = mulberry32(Math.floor(t.seatedAt / 1000) ^ t.id.length);
      const expected = diningMinutes(visitRand, t.partySize ?? 2);
      if (elapsedMin > expected && rand() < 0.08) {
        dispatch({ type: "guestsLeft", tableId: t.id }, "sim");
        continue;
      }
      if (!t.greetedAt) {
        // Median greet about 2.5 minutes; roughly one party in eight waits past five minutes.
        if (rand() < 0.014) dispatch({ type: "serverArrived", tableId: t.id }, "sim");
      } else {
        const sinceVisit = (now - (t.lastVisitAt ?? t.greetedAt)) / MIN;
        if (sinceVisit > 6 && rand() < 0.02) dispatch({ type: "serverArrived", tableId: t.id }, "sim");
      }
    } else if (t.status === "cleaning") {
      const dirtyMin = (now - t.statusSince) / MIN;
      // Most tables are reset inside three minutes; a few drift past the SLA.
      if ((dirtyMin > 1 && rand() < 0.03) || dirtyMin > 7) dispatch({ type: "markCleaned", tableId: t.id }, "sim");
    }
  }

  // The host seats waiting parties when a table that fits is free.
  const waiting = state.parties.filter((p) => p.status === "waiting" || p.status === "notified").sort((a, b) => a.joinedAt - b.joinedAt);
  for (const p of waiting) {
    const fit = tables.filter((t) => t.status === "free" && t.seats >= p.size).sort((a, b) => a.seats - b.seats)[0];
    if (fit && rand() < 0.25) {
      dispatch({ type: "seatParty", partyId: p.id, tableId: fit.id }, "sim");
      break;
    }
    const waitedMin = (now - p.joinedAt) / MIN;
    if (waitedMin > p.quotedMinutes + 12 && rand() < 0.01) {
      dispatch({ type: "partyLeft", partyId: p.id }, "sim");
    }
  }

  // Arrivals: more at peak, fewer when the room is full.
  const arrivalP = 0.045 * demand * (1.15 - occupancy);
  if (rand() < arrivalP && waiting.length < 6) {
    const size = pickSize(rand);
    const free = tables.filter((t) => t.status === "free" && t.seats >= size).sort((a, b) => a.seats - b.seats)[0];
    if (free && waiting.length === 0 && rand() < 0.75) {
      dispatch({ type: "seat", tableId: free.id, size, name: randomName(rand) }, "sim");
    } else {
      dispatch({ type: "addParty", name: randomName(rand), size, source: "sim" }, "sim");
    }
  }
}

function pickSize(rand: () => number): number {
  const r = rand();
  if (r < 0.32) return 2;
  if (r < 0.5) return 3;
  if (r < 0.78) return 4;
  if (r < 0.9) return 5;
  if (r < 0.97) return 6;
  return 8;
}
