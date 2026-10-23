import type { DayStat, EventRecord, HourStat, Insights, Settings, Table } from "./types";

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

interface Interval {
  start: number;
  end: number;
  size: number;
}

function mean(xs: number[]): number | null {
  if (!xs.length) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function pct(xs: number[], pred: (x: number) => boolean): number | null {
  if (!xs.length) return null;
  return (xs.filter(pred).length / xs.length) * 100;
}

/** Pairs seated/released events per table into dining intervals. */
export function seatingIntervals(events: EventRecord[], now: number): Interval[] {
  const open = new Map<string, { start: number; size: number }>();
  const out: Interval[] = [];
  const sorted = [...events].sort((a, b) => a.ts - b.ts);
  for (const e of sorted) {
    if (!e.tableId) continue;
    if (e.type === "seated") {
      open.set(e.tableId, { start: e.ts, size: e.size ?? 2 });
    } else if (e.type === "released") {
      const o = open.get(e.tableId);
      if (o) {
        out.push({ start: o.start, end: e.ts, size: o.size });
        open.delete(e.tableId);
      }
    }
  }
  for (const o of open.values()) out.push({ start: o.start, end: now, size: o.size });
  return out;
}

/**
 * "At the end of the week, managers can review peak hours and schedule the right number of waiters."
 * Averages concurrent occupancy and covers per hour across the window, flags peaks and
 * turns covers into a recommended number of servers per hour.
 */
export function computeInsights(events: EventRecord[], tables: Table[], settings: Settings, now: number, days = 7): Insights {
  // Whole days: today so far plus the previous days-1 days, so each weekday is counted once in a week.
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const from = startOfToday.getTime() - (days - 1) * DAY;
  const inWindow = events.filter((e) => e.ts >= from && e.ts <= now);
  const intervals = seatingIntervals(events, now).filter((i) => i.end > from);

  const occupied = new Array<number>(24).fill(0);
  const covers = new Array<number>(24).fill(0);
  const seatings = new Array<number>(24).fill(0);

  for (const iv of intervals) {
    const s = Math.max(iv.start, from);
    const e = Math.min(iv.end, now);
    if (e <= s) continue;
    // walk hour slots
    let t = s;
    while (t < e) {
      const d = new Date(t);
      const slotStart = new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()).getTime();
      const slotEnd = slotStart + HOUR;
      const overlap = Math.min(e, slotEnd) - Math.max(s, slotStart);
      if (overlap > 0) {
        const h = d.getHours();
        occupied[h] += overlap / HOUR;
        covers[h] += (overlap / HOUR) * iv.size;
      }
      t = slotEnd;
    }
  }

  const byWeekdayCovers = new Array<number>(7).fill(0);
  const byWeekdaySeatings = new Array<number>(7).fill(0);
  const weekdayHourCovers: number[][] = Array.from({ length: 7 }, () => new Array<number>(24).fill(0));
  for (const e of inWindow) {
    if (e.type === "seated") {
      const d = new Date(e.ts);
      seatings[d.getHours()] += 1;
      byWeekdayCovers[d.getDay()] += e.size ?? 2;
      byWeekdaySeatings[d.getDay()] += 1;
      weekdayHourCovers[d.getDay()][d.getHours()] += e.size ?? 2;
    }
  }

  const tableCount = Math.max(1, tables.length);
  const dayCount = Math.max(1, days);
  const maxCovers = Math.max(...covers.map((c) => c / dayCount), 0);
  const hours: HourStat[] = [];
  for (let h = 0; h < 24; h++) {
    const avgOcc = occupied[h] / dayCount;
    const avgCov = covers[h] / dayCount;
    const peak = maxCovers > 0 && avgCov >= maxCovers * 0.75;
    const recommendedServers = avgCov > 0 ? Math.max(1, Math.ceil(avgCov / settings.coversPerServer)) : 0;
    hours.push({
      hour: h,
      occupiedTables: round1(avgOcc),
      covers: round1(avgCov),
      seatings: round1(seatings[h] / dayCount),
      occupancy: Math.min(1, avgOcc / tableCount),
      recommendedServers,
      peak,
    });
  }
  const peakHours = [...hours]
    .filter((h) => h.covers > 0)
    .sort((a, b) => b.covers - a.covers)
    .slice(0, 3)
    .map((h) => h.hour)
    .sort((a, b) => a - b);

  const byWeekday: DayStat[] = [];
  for (let w = 0; w < 7; w++) {
    const hc = weekdayHourCovers[w];
    let peakHour: number | null = null;
    let best = 0;
    hc.forEach((c, h) => {
      if (c > best) {
        best = c;
        peakHour = h;
      }
    });
    byWeekday.push({ weekday: w, covers: byWeekdayCovers[w], seatings: byWeekdaySeatings[w], peakHour });
  }

  const greet = inWindow.filter((e) => e.type === "greeted" && e.durationMs != null).map((e) => (e.durationMs as number) / MIN);
  const revisit = inWindow.filter((e) => e.type === "visited" && e.durationMs != null).map((e) => (e.durationMs as number) / MIN);
  const cleaning = inWindow.filter((e) => e.type === "cleaned" && e.durationMs != null).map((e) => (e.durationMs as number) / MIN);
  const dining = inWindow.filter((e) => e.type === "released" && e.durationMs != null).map((e) => (e.durationMs as number) / MIN);
  const waits = inWindow.filter((e) => e.type === "party_seated" && e.durationMs != null).map((e) => (e.durationMs as number) / MIN);
  const alertResolve = inWindow.filter((e) => e.type === "alert_resolved" && e.durationMs != null).map((e) => (e.durationMs as number) / MIN);
  const totalSeatings = inWindow.filter((e) => e.type === "seated").length;
  const totalCovers = inWindow.filter((e) => e.type === "seated").reduce((a, e) => a + (e.size ?? 2), 0);

  const cleaningByHour: number[][] = Array.from({ length: 24 }, () => []);
  for (const e of inWindow) {
    if (e.type === "cleaned" && e.durationMs != null) cleaningByHour[new Date(e.ts).getHours()].push(e.durationMs / MIN);
  }
  let slowestCleaningHour: number | null = null;
  let slowest = 0;
  cleaningByHour.forEach((xs, h) => {
    const m = mean(xs);
    if (m !== null && xs.length >= 3 && m > slowest) {
      slowest = m;
      slowestCleaningHour = h;
    }
  });

  return {
    days,
    tableCount: tables.length,
    hours,
    byWeekday,
    metrics: {
      seatings: totalSeatings,
      covers: totalCovers,
      avgGreetMin: r(mean(greet)),
      greetWithinSlaPct: r(pct(greet, (x) => x <= settings.greetSlaMin)),
      avgRevisitMin: r(mean(revisit)),
      avgCleaningMin: r(mean(cleaning)),
      cleaningWithinSlaPct: r(pct(cleaning, (x) => x <= settings.cleaningSlaMin)),
      avgDiningMin: r(mean(dining)),
      turnsPerTablePerDay: totalSeatings ? round1(totalSeatings / tableCount / dayCount) : null,
      avgWaitMin: r(mean(waits)),
      walkAways: inWindow.filter((e) => e.type === "party_left").length,
      alertsOpened: inWindow.filter((e) => e.type === "alert_opened").length,
      lateGreets: inWindow.filter((e) => e.type === "alert_opened" && e.alertType === "no_greet").length,
      avgAlertResolveMin: r(mean(alertResolve)),
    },
    peakHours,
    slowestCleaningHour,
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
function r(n: number | null): number | null {
  return n === null ? null : round1(n);
}
