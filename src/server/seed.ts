import type { Alert, EventRecord, Party, Section, Settings, Staff, Table } from "@/lib/types";

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/** Deterministic PRNG so the demo venue looks the same every time it is reset. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let counter = 0;
export function newId(prefix: string): string {
  counter = (counter + 1) % 1_000_000;
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export interface State {
  settings: Settings;
  sections: Section[];
  tables: Table[];
  alerts: Alert[];
  parties: Party[];
  staff: Staff[];
  events: EventRecord[];
}

export function defaultSettings(): Settings {
  return {
    venueName: "Saloon",
    slug: "saloon",
    greetSlaMin: 5,
    revisitSlaMin: 15,
    cleaningSlaMin: 4,
    longWaitSlaMin: 5,
    coversPerServer: 16,
    defaultDiningMin: 55,
    openHour: 11,
    closeHour: 23,
    managerPin: "1234",
    apiKey: "wk_demo_" + Math.random().toString(36).slice(2, 12),
    demoMode: true,
    soundOn: true,
  };
}

const FIRST_NAMES = ["Alex", "Sam", "Jordan", "Taylor", "Morgan", "Casey", "Riley", "Jamie", "Avery", "Quinn", "Drew", "Reese", "Parker", "Rowan", "Emerson", "Skyler", "Harper", "Elliot", "Noor", "Mila", "Theo", "Ivy", "Luca", "Nia"];

export function randomName(rand: () => number): string {
  return FIRST_NAMES[Math.floor(rand() * FIRST_NAMES.length)];
}

/** Floor layout: three sections, twelve tables, positions in percent of the floor. */
export function defaultFloor(): { sections: Section[]; tables: Table[]; staff: Staff[] } {
  const staff: Staff[] = [
    { id: "st_host", name: "Noor", role: "host", sectionIds: [], onShift: true },
    { id: "st_sam", name: "Sam", role: "server", sectionIds: ["sec_main"], onShift: true },
    { id: "st_alex", name: "Alex", role: "server", sectionIds: ["sec_patio"], onShift: true },
    { id: "st_mila", name: "Mila", role: "server", sectionIds: ["sec_bar"], onShift: true },
    { id: "st_theo", name: "Theo", role: "busser", sectionIds: ["sec_main", "sec_patio", "sec_bar"], onShift: true },
    { id: "st_ivy", name: "Ivy", role: "manager", sectionIds: [], onShift: true },
  ];
  const sections: Section[] = [
    { id: "sec_main", name: "Main", serverId: "st_sam" },
    { id: "sec_patio", name: "Patio", serverId: "st_alex" },
    { id: "sec_bar", name: "Bar", serverId: "st_mila" },
  ];
  const base = { status: "free" as const, statusSince: Date.now() };
  const tables: Table[] = [
    { id: "t_m1", label: "M1", seats: 2, sectionId: "sec_main", shape: "round", x: 6, y: 8, w: 14, h: 20, ...base },
    { id: "t_m2", label: "M2", seats: 4, sectionId: "sec_main", shape: "square", x: 26, y: 8, w: 16, h: 22, ...base },
    { id: "t_m3", label: "M3", seats: 4, sectionId: "sec_main", shape: "square", x: 48, y: 8, w: 16, h: 22, ...base },
    { id: "t_m4", label: "M4", seats: 6, sectionId: "sec_main", shape: "rect", x: 6, y: 36, w: 22, h: 20, ...base },
    { id: "t_m5", label: "M5", seats: 2, sectionId: "sec_main", shape: "round", x: 34, y: 38, w: 14, h: 20, ...base },
    { id: "t_m6", label: "M6", seats: 8, sectionId: "sec_main", shape: "rect", x: 52, y: 36, w: 26, h: 20, ...base },
    { id: "t_p1", label: "P1", seats: 4, sectionId: "sec_patio", shape: "square", x: 6, y: 66, w: 16, h: 22, ...base },
    { id: "t_p2", label: "P2", seats: 4, sectionId: "sec_patio", shape: "square", x: 28, y: 66, w: 16, h: 22, ...base },
    { id: "t_p3", label: "P3", seats: 2, sectionId: "sec_patio", shape: "round", x: 50, y: 68, w: 14, h: 20, ...base },
    { id: "t_b1", label: "B1", seats: 2, sectionId: "sec_bar", shape: "round", x: 80, y: 8, w: 12, h: 16, ...base },
    { id: "t_b2", label: "B2", seats: 2, sectionId: "sec_bar", shape: "round", x: 80, y: 34, w: 12, h: 16, ...base },
    { id: "t_b3", label: "B3", seats: 4, sectionId: "sec_bar", shape: "square", x: 78, y: 62, w: 16, h: 22, ...base },
  ];
  return { sections, tables, staff };
}

/** Demand curve 0–1 by hour: a lunch peak and a bigger dinner peak. */
export function demandAt(hour: number, weekday: number): number {
  const lunch = Math.exp(-Math.pow((hour - 12.6) / 1.1, 2)) * 0.7;
  const dinner = Math.exp(-Math.pow((hour - 19.4) / 1.5, 2));
  const weekend = weekday === 5 || weekday === 6 ? 1.25 : weekday === 0 ? 1.05 : 0.9;
  return Math.min(1, (lunch + dinner) * weekend);
}

function gauss(rand: () => number, mean: number, sd: number): number {
  const u = 1 - rand();
  const v = rand();
  return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function diningMinutes(rand: () => number, size: number): number {
  const base = size <= 2 ? 46 : size <= 4 ? 63 : 86;
  const sd = size <= 2 ? 11 : size <= 4 ? 14 : 18;
  return Math.max(18, gauss(rand, base, sd));
}

function partySizeFor(rand: () => number, seats: number): number {
  const r = rand();
  if (seats <= 2) return r < 0.3 ? 1 : 2;
  if (seats <= 4) return r < 0.15 ? 2 : r < 0.6 ? 3 : 4;
  if (seats <= 6) return r < 0.3 ? 4 : r < 0.7 ? 5 : 6;
  return r < 0.3 ? 6 : r < 0.7 ? 7 : 8;
}

/**
 * Generates realistic history for the last `days` days so Insights has something to
 * show on first run: seatings, greets, visits, releases, cleanings, queue waits and alerts.
 */
export function generateHistory(tables: Table[], settings: Settings, now: number, days: number, seed = 7): EventRecord[] {
  const rand = mulberry32(seed);
  const events: EventRecord[] = [];
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  // Past days in full, plus today up to 90 minutes ago so the live floor (seeded separately) never overlaps.
  for (let d = days; d >= 0; d--) {
    const dayStart = todayStart.getTime() - d * DAY;
    const weekday = new Date(dayStart).getDay();
    const open = dayStart + settings.openHour * HOUR;
    const close = Math.min(dayStart + settings.closeHour * HOUR, d === 0 ? now - 90 * MIN : Infinity);
    if (close <= open + 30 * MIN) continue;
    for (const t of tables) {
      let cursor = open + rand() * 12 * MIN;
      while (cursor < close - 25 * MIN) {
        const hour = (cursor - dayStart) / HOUR;
        // Demand a little ahead of the cursor, so seatings lead the rush instead of trailing it.
        const demand = demandAt(hour + 0.6, weekday);
        // Idle gap before the next party: a few minutes at peak, often an hour or more when quiet.
        let gap = (3 + rand() * 6 + (1 - demand) * (40 + rand() * 60)) * MIN;
        if (rand() < 1 - demand - 0.15) gap += (40 + rand() * 80) * MIN;
        cursor += gap;
        if (cursor >= close - 20 * MIN) break;
        const size = partySizeFor(rand, t.seats);
        const seatedAt = cursor;
        const dining = diningMinutes(rand, size) * MIN;
        // Queue during peaks: a share of parties waited before sitting.
        if (demand > 0.55 && rand() < 0.45) {
          const wait = (3 + rand() * 14 + (demand > 0.85 ? rand() * 10 : 0)) * MIN;
          const pid = `hp_${d}_${t.id}_${Math.floor(cursor / MIN)}`;
          events.push({ id: newId("ev"), ts: seatedAt - wait, type: "party_joined", partyId: pid, size, source: "sim" });
          events.push({ id: newId("ev"), ts: seatedAt, type: "party_seated", partyId: pid, tableId: t.id, size, durationMs: wait, source: "sim" });
        } else if (demand > 0.8 && rand() < 0.06) {
          const pid = `hl_${d}_${t.id}_${Math.floor(cursor / MIN)}`;
          events.push({ id: newId("ev"), ts: seatedAt - 30 * MIN, type: "party_joined", partyId: pid, size, source: "sim" });
          events.push({ id: newId("ev"), ts: seatedAt - 5 * MIN, type: "party_left", partyId: pid, size, source: "sim" });
        }
        events.push({ id: newId("ev"), ts: seatedAt, type: "seated", tableId: t.id, size, source: "sim" });
        // Greet: usually within the SLA, later at peak.
        const greetMin = Math.max(0.5, gauss(rand, 2.4 + demand * 1.6, 1.4));
        const greetedAt = seatedAt + greetMin * MIN;
        events.push({ id: newId("ev"), ts: greetedAt, type: "greeted", tableId: t.id, size, durationMs: greetMin * MIN, source: "sim" });
        if (greetMin > settings.greetSlaMin) {
          const aid = newId("al");
          const openedAt = seatedAt + settings.greetSlaMin * MIN;
          events.push({ id: newId("ev"), ts: openedAt, type: "alert_opened", tableId: t.id, alertId: aid, alertType: "no_greet", source: "sim" });
          events.push({ id: newId("ev"), ts: greetedAt, type: "alert_resolved", tableId: t.id, alertId: aid, alertType: "no_greet", durationMs: greetedAt - openedAt, source: "sim" });
        }
        // Visits every ~12 minutes.
        let last = greetedAt;
        while (last + 9 * MIN < seatedAt + dining) {
          const gapV = Math.max(4, gauss(rand, 12, 4)) * MIN;
          last += gapV;
          if (last >= seatedAt + dining) break;
          events.push({ id: newId("ev"), ts: last, type: "visited", tableId: t.id, durationMs: gapV, source: "sim" });
        }
        const releasedAt = seatedAt + dining;
        events.push({ id: newId("ev"), ts: releasedAt, type: "released", tableId: t.id, size, durationMs: dining, source: "sim" });
        const cleanMin = Math.max(1, gauss(rand, 3 + demand * 1.5, 1.4));
        const cleanedAt = releasedAt + cleanMin * MIN;
        const caid = newId("al");
        events.push({ id: newId("ev"), ts: releasedAt, type: "alert_opened", tableId: t.id, alertId: caid, alertType: "needs_cleaning", source: "sim" });
        events.push({ id: newId("ev"), ts: cleanedAt, type: "cleaned", tableId: t.id, durationMs: cleanMin * MIN, source: "sim" });
        events.push({ id: newId("ev"), ts: cleanedAt, type: "alert_resolved", tableId: t.id, alertId: caid, alertType: "needs_cleaning", durationMs: cleanMin * MIN, source: "sim" });
        cursor = cleanedAt;
      }
    }
  }
  events.sort((a, b) => a.ts - b.ts);
  return events;
}

/**
 * A live floor that looks like a Friday at 20:41 the moment the app opens:
 * most tables seated with realistic timers, one waiting for a server, one to be cleaned,
 * a short queue at the host stand.
 */
export function seedLiveFloor(state: State, now: number, seed = 11): void {
  const rand = mulberry32(seed);
  const byLabel = Object.fromEntries(state.tables.map((t) => [t.label, t]));
  const seat = (label: string, size: number, minutesAgo: number, greetedAfterMin: number | null, name?: string) => {
    const t = byLabel[label];
    if (!t) return;
    const seatedAt = now - minutesAgo * MIN;
    t.status = "seated";
    t.statusSince = seatedAt;
    t.seatedAt = seatedAt;
    t.partySize = size;
    t.partyName = name ?? randomName(rand);
    t.greetedAt = greetedAfterMin === null ? null : seatedAt + greetedAfterMin * MIN;
    t.lastVisitAt = t.greetedAt ? Math.max(t.greetedAt, now - (3 + rand() * 9) * MIN) : null;
    t.source = "sim";
    state.events.push({ id: newId("ev"), ts: seatedAt, type: "seated", tableId: t.id, size, source: "sim" });
    if (t.greetedAt) state.events.push({ id: newId("ev"), ts: t.greetedAt, type: "greeted", tableId: t.id, size, durationMs: greetedAfterMin! * MIN, source: "sim" });
  };
  seat("M2", 4, 24.6, 2.1, "Okafor");
  seat("M4", 6, 14.2, 1.7, "Birthday · Lee");
  seat("M3", 3, 0.8, null, "Walk-in");
  seat("M6", 7, 41, 3.0, "Reyes");
  seat("P1", 4, 33, 2.5, "Nakamura");
  seat("P3", 2, 6.4, null, "Dubois");
  seat("B2", 2, 18, 1.2, "Chen");
  seat("B3", 4, 52, 2.8, "Patel");
  const m7 = byLabel["M1"];
  if (m7) {
    m7.status = "cleaning";
    m7.statusSince = now - 1.4 * MIN;
    m7.source = "sim";
    state.events.push({ id: newId("ev"), ts: now - 46 * MIN, type: "seated", tableId: m7.id, size: 2, source: "sim" });
    state.events.push({ id: newId("ev"), ts: now - 1.4 * MIN, type: "released", tableId: m7.id, size: 2, durationMs: 44.6 * MIN, source: "sim" });
  }
  const mk = (name: string, size: number, minutesAgo: number, quoted: number, phone?: string): Party => ({
    id: newId("p"),
    name,
    size,
    phone: phone ?? null,
    notes: null,
    joinedAt: now - minutesAgo * MIN,
    quotedMinutes: quoted,
    status: "waiting",
    source: "host",
  });
  state.parties.push(mk("Garcia", 2, 11, 15, "+1 555 0142"), mk("Walsh", 4, 6, 20), mk("Hoffmann", 5, 2, 25, "+1 555 0199"));
  state.events.push(...state.parties.map((p) => ({ id: newId("ev"), ts: p.joinedAt, type: "party_joined" as const, partyId: p.id, size: p.size, source: "sim" as const })));
}

export function seedState(now = Date.now()): State {
  const settings = defaultSettings();
  const { sections, tables, staff } = defaultFloor();
  const state: State = { settings, sections, tables, alerts: [], parties: [], staff, events: [] };
  state.events = generateHistory(tables, settings, now, 14);
  seedLiveFloor(state, now);
  state.events.sort((a, b) => a.ts - b.ts);
  return state;
}
