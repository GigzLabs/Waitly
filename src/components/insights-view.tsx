"use client";

import clsx from "clsx";
import { Download, UserRound } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useWaitly } from "@/lib/client";
import { WEEKDAYS, formatHour, formatMinutes } from "@/lib/format";
import type { HourStat, Insights } from "@/lib/types";
import { Empty, Segmented, Stat } from "./ui";

type Range = "7" | "14" | "30";

const FALLBACK = { openHour: 11, closeHour: 23, greetSlaMin: 5, cleaningSlaMin: 4, coversPerServer: 16 };

/**
 * "At the end of the week, managers can review peak hours and schedule the right number of waiters."
 * Covers by hour with the peaks in amber, a recommended-servers row under the bars, service
 * metrics, the busiest days and three sentences on where service slips.
 */
export function InsightsView() {
  const { snapshot } = useWaitly();
  const settings = snapshot?.settings;
  const openHour = settings?.openHour ?? FALLBACK.openHour;
  const closeHour = settings?.closeHour ?? FALLBACK.closeHour;
  const greetSla = settings?.greetSlaMin ?? FALLBACK.greetSlaMin;
  const cleaningSla = settings?.cleaningSlaMin ?? FALLBACK.cleaningSlaMin;
  const coversPerServer = settings?.coversPerServer ?? FALLBACK.coversPerServer;

  const [range, setRangeState] = useState<Range>("7");
  const [data, setData] = useState<Insights | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTable, setShowTable] = useState(false);
  const loading = data === null && error === null;

  // State only changes inside promise callbacks, never synchronously in the effect body.
  const applyResult = useCallback((result: Promise<Insights>, isCurrent: () => boolean) => {
    result.then(
      (json) => {
        if (!isCurrent()) return;
        setData(json);
        setError(null);
        setRefreshing(false);
      },
      (err: unknown) => {
        if (!isCurrent()) return;
        setError(err instanceof Error ? err.message : "Could not load insights");
        setRefreshing(false);
      },
    );
  }, []);

  const setRange = (r: Range) => {
    setRefreshing(true);
    setRangeState(r);
  };

  const reload = () => {
    setRefreshing(true);
    applyResult(fetchInsights(range), () => true);
  };

  useEffect(() => {
    let active = true;
    applyResult(fetchInsights(range), () => active);
    const id = setInterval(() => {
      setRefreshing(true);
      applyResult(fetchInsights(range), () => active);
    }, 60_000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [range, applyResult]);

  const hours = useMemo(() => {
    if (!data) return [] as HourStat[];
    const inService = data.hours.filter((h) => (openHour < closeHour ? h.hour >= openHour && h.hour < closeHour : true));
    return inService.length >= 2 ? inService : data.hours;
  }, [data, openHour, closeHour]);

  const summary = useMemo(() => (data ? summarise(data, hours) : ""), [data, hours]);

  const downloadCsv = () => {
    if (!data) return;
    const rows = [
      ["hour", "avg_covers", "avg_occupied_tables", "occupancy_pct", "seatings_per_day", "recommended_servers", "peak"],
      ...hours.map((h) => [formatHour(h.hour), h.covers, h.occupiedTables, Math.round(h.occupancy * 100), h.seatings, h.recommendedServers, h.peak ? "yes" : "no"]),
    ];
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `waitly-peak-times-${data.days}d.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const m = data?.metrics;
  const empty = Boolean(data && data.metrics.seatings === 0);

  return (
    <div className="flex flex-1 flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="eyebrow">Your peak times</div>
          <h1 className="text-3xl font-bold tracking-tight">Insights</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented<Range>
            value={range}
            onChange={setRange}
            options={[
              { value: "7", label: "Last 7 days" },
              { value: "14", label: "14 days" },
              { value: "30", label: "30 days" },
            ]}
          />
          <button className="btn btn-ghost btn-sm" onClick={downloadCsv} disabled={!data || empty} aria-label="Download the hourly table as CSV">
            <Download size={16} /> Download CSV
          </button>
        </div>
      </div>

      {loading && !data ? (
        <div className="text-sm font-semibold text-ink-3">Loading insights…</div>
      ) : error && !data ? (
        <Empty title="Insights are unavailable" body={`The server did not answer (${error}). Check the connection and try again.`} action={<button className="btn btn-secondary" onClick={reload}>Try again</button>} />
      ) : empty || !data || !m ? (
        <Empty title="No service yet" body="Insights fill in as tables are seated. Try a longer range, or come back after the next service." />
      ) : (
        <div className={clsx("flex flex-col gap-5 transition-opacity", refreshing && "opacity-60")}>
          {/* Hero: covers by hour */}
          <section className="card flex flex-col gap-4 p-4 md:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-lg font-bold tracking-tight">Covers by hour</h2>
                <p className="text-sm text-ink-2">Average guests seated at once, over the last {data.days} days across {data.tableCount} tables.</p>
              </div>
              <ChartLegend />
            </div>
            <p className="text-[15px] font-semibold leading-snug text-ink">{summary}</p>
            <HourChart hours={hours} coversPerServer={coversPerServer} />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-ink-3">Servers are recommended at one per {coversPerServer} covers seated at once. Change the ratio in Settings.</p>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowTable((v) => !v)} aria-expanded={showTable}>
                {showTable ? "Hide table" : "Show table"}
              </button>
            </div>
            {showTable && <HourTable hours={hours} />}
          </section>

          {/* Metrics */}
          <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            <Stat label="Seatings" value={m.seatings.toLocaleString()} hint={`${data.days} days`} />
            <Stat label="Covers" value={m.covers.toLocaleString()} hint={`${Math.round(m.covers / Math.max(1, m.seatings) * 10) / 10} guests per party`} />
            <Stat label="Time to first visit" value={mins(m.avgGreetMin)} hint={m.greetWithinSlaPct === null ? undefined : `${Math.round(m.greetWithinSlaPct)}% within ${greetSla} min`} tone={m.greetWithinSlaPct !== null && m.greetWithinSlaPct < 80 ? "cleaning" : undefined} />
            <Stat label="Table reset" value={mins(m.avgCleaningMin)} hint={m.cleaningWithinSlaPct === null ? undefined : `${Math.round(m.cleaningWithinSlaPct)}% within ${cleaningSla} min`} tone={m.cleaningWithinSlaPct !== null && m.cleaningWithinSlaPct < 80 ? "cleaning" : undefined} />
            <Stat label="Dining time" value={m.avgDiningMin === null ? "—" : formatMinutes(m.avgDiningMin)} hint="Average per party" />
            <Stat label="Turns per table" value={m.turnsPerTablePerDay === null ? "—" : m.turnsPerTablePerDay} hint="Per day" />
            <Stat label="Wait on the list" value={mins(m.avgWaitMin)} hint="From joining to seating" />
            <Stat label="Walk-aways" value={m.walkAways} hint="Left before a table" tone={m.walkAways > 0 ? "seated" : undefined} />
            <Stat label="Late greets" value={m.lateGreets} hint={`Past the ${greetSla} min rule`} tone={m.lateGreets > 0 ? "cleaning" : undefined} />
            <Stat label="Alert resolve time" value={mins(m.avgAlertResolveMin)} hint="Open to resolved" />
          </section>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
            {/* Busiest days */}
            <section className="card flex flex-col gap-3 p-4 md:p-5 lg:col-span-3">
              <div>
                <h2 className="text-lg font-bold tracking-tight">Busiest days</h2>
                <p className="text-sm text-ink-2">Covers by weekday, with each day&apos;s peak hour underneath.</p>
              </div>
              <WeekdayChart data={data} />
            </section>

            {/* Where service slips */}
            <section className="card flex flex-col gap-3 p-4 md:p-5 lg:col-span-2">
              <div>
                <h2 className="text-lg font-bold tracking-tight">Where service slips</h2>
                <p className="text-sm text-ink-2">Three things to plan around.</p>
              </div>
              <ul className="flex flex-col gap-3 text-sm">
                {slips(data, hours, greetSla).map((line, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="mt-[7px] h-2 w-2 shrink-0 rounded-full bg-cleaning" aria-hidden="true" />
                    <span className="text-ink">{line}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- helpers ----------

async function fetchInsights(days: Range): Promise<Insights> {
  const res = await fetch(`/api/insights?days=${days}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as Insights;
}

function mins(v: number | null): string {
  if (v === null) return "—";
  return v < 60 ? `${v} min` : formatMinutes(v);
}

function hourRanges(hoursList: number[]): string {
  if (!hoursList.length) return "";
  const sorted = [...hoursList].sort((a, b) => a - b);
  const groups: Array<[number, number]> = [];
  for (const h of sorted) {
    const last = groups[groups.length - 1];
    if (last && h === last[1] + 1) last[1] = h;
    else groups.push([h, h]);
  }
  const parts = groups.map(([a, b]) => (a === b ? `${formatHour(a)} to ${formatHour(a + 1)}` : `${formatHour(a)} to ${formatHour(b + 1)}`));
  return parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

function summarise(data: Insights, hours: HourStat[]): string {
  if (!data.peakHours.length) return "No service recorded in this range.";
  const peaks = `Peak hours are ${hourRanges(data.peakHours)}.`;
  const lunch = hours.filter((h) => h.hour >= 11 && h.hour < 15);
  const dinner = hours.filter((h) => h.hour >= 17);
  const lunchMax = Math.max(0, ...lunch.map((h) => h.recommendedServers));
  const dinnerMax = Math.max(0, ...dinner.map((h) => h.recommendedServers));
  const dinnerFrom = dinner.find((h) => h.recommendedServers === dinnerMax)?.hour;
  const plural = (n: number) => `${n} server${n === 1 ? "" : "s"}`;
  if (lunchMax && dinnerMax && dinnerFrom !== undefined) {
    return `${peaks} Plan ${plural(lunchMax)} at lunch and ${plural(dinnerMax)} from ${formatHour(dinnerFrom)}.`;
  }
  const overallMax = Math.max(0, ...hours.map((h) => h.recommendedServers));
  const from = hours.find((h) => h.recommendedServers === overallMax)?.hour;
  return overallMax && from !== undefined ? `${peaks} Plan ${plural(overallMax)} from ${formatHour(from)}.` : peaks;
}

function slips(data: Insights, hours: HourStat[], greetSla: number): string[] {
  const out: string[] = [];
  if (data.slowestCleaningHour !== null) out.push(`Table resets are slowest around ${formatHour(data.slowestCleaningHour)}. Put a busser on the floor then.`);
  else out.push("Table resets stay inside the target all day.");
  const maxServers = Math.max(0, ...hours.map((h) => h.recommendedServers));
  const heavy = hours.filter((h) => h.recommendedServers === maxServers && maxServers > 0).map((h) => h.hour);
  if (heavy.length) out.push(`The heaviest hours, ${hourRanges(heavy)}, need ${maxServers} server${maxServers === 1 ? "" : "s"} on the floor.`);
  else out.push("No hour needed more than one server.");
  const m = data.metrics;
  const pct = m.seatings ? Math.round((m.lateGreets / m.seatings) * 100) : 0;
  out.push(`${m.lateGreets.toLocaleString()} of ${m.seatings.toLocaleString()} parties (${pct}%) waited past ${greetSla} min for a first visit.`);
  return out;
}

function niceTicks(max: number, count = 4): number[] {
  if (max <= 0) return [0];
  const rough = max / count;
  const pow = Math.pow(10, Math.floor(Math.log10(rough)));
  const steps = [1, 2, 2.5, 5, 10];
  const step = (steps.find((s) => s * pow >= rough) ?? 10) * pow;
  const ticks: number[] = [];
  for (let v = 0; v <= max + step * 0.001 || ticks.length < 2; v += step) {
    ticks.push(Math.round(v * 100) / 100);
    if (v > max) break;
  }
  return ticks;
}

function useContainerWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

function barPath(x: number, y: number, w: number, h: number, r: number): string {
  // Rounded data-end (top), square at the baseline.
  const rr = Math.min(r, w / 2, h);
  if (h <= 0) return "";
  return `M${x} ${y + h} V${y + rr} Q${x} ${y} ${x + rr} ${y} H${x + w - rr} Q${x + w} ${y} ${x + w} ${y + rr} V${y + h} Z`;
}

function ChartLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-semibold text-ink-2" aria-label="Legend">
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: "var(--brand)" }} aria-hidden="true" /> Covers
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: "var(--cleaning)" }} aria-hidden="true" /> Peak hours
      </span>
    </div>
  );
}

interface Tip {
  x: number;
  y: number;
  node: ReactNode;
}

function HourChart({ hours, coversPerServer }: { hours: HourStat[]; coversPerServer: number }) {
  const [ref, width] = useContainerWidth<HTMLDivElement>();
  const [tip, setTip] = useState<Tip | null>(null);
  const n = hours.length;
  const margin = { top: 14, right: 12, bottom: 24, left: 36 };
  const serversBand = 34;
  const plotH = 190;
  const W = Math.max(width || 0, n * 44 + margin.left + margin.right);
  const plotW = W - margin.left - margin.right;
  const H = margin.top + plotH + margin.bottom + serversBand;
  const maxCovers = Math.max(0, ...hours.map((h) => h.covers));
  const ticks = niceTicks(maxCovers * 1.05 || 1);
  const yMax = ticks[ticks.length - 1] || 1;
  const band = n ? plotW / n : plotW;
  const barW = Math.min(24, band * 0.62);
  const y = (v: number) => margin.top + plotH - (v / yMax) * plotH;
  const labelEvery = band < 34 ? 2 : 1;
  const aria = `Covers by hour. ${hours.map((h) => `${formatHour(h.hour)}: ${h.covers} covers${h.peak ? ", peak" : ""}, ${h.recommendedServers} servers`).join("; ")}.`;

  return (
    <div ref={ref} className="w-full">
      <div className="scroll-thin relative overflow-x-auto overflow-y-hidden">
        <div className="relative" style={{ width: W }}>
          <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={aria} className="block select-none">
            {/* gridlines + y ticks */}
            {ticks.map((t) => (
              <g key={t}>
                <line x1={margin.left} x2={W - margin.right} y1={y(t)} y2={y(t)} style={{ stroke: "var(--border)" }} strokeWidth={1} />
                <text x={margin.left - 8} y={y(t)} textAnchor="end" dominantBaseline="middle" className="tnum" style={{ fill: "var(--ink-3)", fontSize: 11, fontWeight: 600 }}>
                  {t}
                </text>
              </g>
            ))}
            {/* bars */}
            {hours.map((h, i) => {
              const cx = margin.left + band * i + band / 2;
              const x = cx - barW / 2;
              const top = y(h.covers);
              const hgt = margin.top + plotH - top;
              const active = tip !== null && Math.abs(tip.x - cx) < 0.5;
              return (
                <g key={h.hour}>
                  <path d={barPath(x, top, barW, hgt, 4)} style={{ fill: h.peak ? "var(--cleaning)" : "var(--brand)", opacity: tip && !active ? 0.55 : 1, transition: "opacity 120ms ease" }} />
                  {active && <rect x={x - 2} y={top - 2} width={barW + 4} height={hgt + 2} rx={5} fill="none" style={{ stroke: "var(--ink)" }} strokeWidth={1.5} opacity={0.6} />}
                  {/* hit target: the whole band */}
                  <rect
                    x={margin.left + band * i}
                    y={margin.top}
                    width={band}
                    height={plotH}
                    fill="transparent"
                    tabIndex={0}
                    role="button"
                    aria-label={`${formatHour(h.hour)}: ${h.covers} covers, ${Math.round(h.occupancy * 100)}% of tables, ${h.recommendedServers} servers`}
                    style={{ cursor: "pointer", outline: "none" }}
                    onPointerEnter={() => setTip({ x: cx, y: top, node: tipFor(h, coversPerServer) })}
                    onFocus={() => setTip({ x: cx, y: top, node: tipFor(h, coversPerServer) })}
                    onPointerLeave={() => setTip(null)}
                    onBlur={() => setTip(null)}
                  />
                  {/* x label */}
                  {i % labelEvery === 0 && (
                    <text x={cx} y={margin.top + plotH + 16} textAnchor="middle" style={{ fill: h.peak ? "var(--ink)" : "var(--ink-3)", fontSize: 11, fontWeight: h.peak ? 700 : 600 }}>
                      {formatHour(h.hour)}
                    </text>
                  )}
                  {/* recommended servers */}
                  <text x={cx} y={H - 9} textAnchor="middle" className="tnum" style={{ fill: h.recommendedServers === 0 ? "var(--ink-3)" : h.peak ? "var(--cleaning)" : "var(--ink)", fontSize: h.peak ? 15 : 13, fontWeight: h.peak ? 800 : 700 }}>
                    {h.recommendedServers}
                  </text>
                </g>
              );
            })}
            {/* baseline */}
            <line x1={margin.left} x2={W - margin.right} y1={margin.top + plotH} y2={margin.top + plotH} style={{ stroke: "var(--border-strong)" }} strokeWidth={1} />
            {/* servers row divider + label */}
            <line x1={margin.left} x2={W - margin.right} y1={H - serversBand + 4} y2={H - serversBand + 4} style={{ stroke: "var(--border)" }} strokeWidth={1} />
            <UserRound x={margin.left - 32} y={H - 21} width={16} height={16} strokeWidth={1.75} style={{ color: "var(--ink-3)" }} aria-hidden="true" />
          </svg>
          {tip && (
            <div
              className="pointer-events-none absolute z-10 w-max max-w-[220px] rounded-xl border border-border bg-surface px-3 py-2 text-xs shadow-md"
              style={{ left: Math.min(Math.max(tip.x, 110), W - 110), top: Math.max(0, tip.y - 10), transform: "translate(-50%, -100%)" }}
              role="status"
            >
              {tip.node}
            </div>
          )}
        </div>
      </div>
      <div className="mt-1 flex items-center gap-2 text-xs font-semibold text-ink-3">
        <UserRound size={14} strokeWidth={1.75} aria-hidden="true" /> Recommended servers per hour
      </div>
    </div>
  );
}

function tipFor(h: HourStat, coversPerServer: number): ReactNode {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="text-[13px] font-extrabold text-ink">
        {h.covers} covers <span className="font-semibold text-ink-3">· {formatHour(h.hour)} to {formatHour(h.hour + 1)}</span>
      </div>
      <div className="text-ink-2">{Math.round(h.occupancy * 100)}% of tables · {h.occupiedTables} seated at once</div>
      <div className="text-ink-2">{h.seatings} parties seated per day</div>
      <div className="font-bold text-ink">
        {h.recommendedServers} server{h.recommendedServers === 1 ? "" : "s"} <span className="font-semibold text-ink-3">(1 per {coversPerServer} covers)</span>
        {h.peak ? <span className="ml-1 font-bold text-cleaning">· peak</span> : null}
      </div>
    </div>
  );
}

function HourTable({ hours }: { hours: HourStat[] }) {
  return (
    <div className="scroll-thin overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[560px] text-sm">
        <thead className="bg-surface-2 text-left text-xs font-bold uppercase tracking-wider text-ink-3">
          <tr>
            <th className="px-3 py-2">Hour</th>
            <th className="px-3 py-2 text-right">Covers</th>
            <th className="px-3 py-2 text-right">Tables seated</th>
            <th className="px-3 py-2 text-right">Occupancy</th>
            <th className="px-3 py-2 text-right">Seatings / day</th>
            <th className="px-3 py-2 text-right">Servers</th>
          </tr>
        </thead>
        <tbody className="tnum">
          {hours.map((h) => (
            <tr key={h.hour} className={clsx("border-t border-border", h.peak && "bg-cleaning-soft")}>
              <td className="px-3 py-1.5 font-semibold">
                {formatHour(h.hour)}
                {h.peak ? <span className="ml-2 text-xs font-bold text-cleaning">peak</span> : null}
              </td>
              <td className="px-3 py-1.5 text-right">{h.covers}</td>
              <td className="px-3 py-1.5 text-right">{h.occupiedTables}</td>
              <td className="px-3 py-1.5 text-right">{Math.round(h.occupancy * 100)}%</td>
              <td className="px-3 py-1.5 text-right">{h.seatings}</td>
              <td className="px-3 py-1.5 text-right font-bold">{h.recommendedServers}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function WeekdayChart({ data }: { data: Insights }) {
  const [ref, width] = useContainerWidth<HTMLDivElement>();
  const [tip, setTip] = useState<Tip | null>(null);
  const order = [1, 2, 3, 4, 5, 6, 0];
  const days = order.map((w) => data.byWeekday[w]);
  const max = Math.max(0, ...days.map((d) => d.covers));
  const busiest = days.reduce((best, d) => (d.covers > best.covers ? d : best), days[0]);
  const margin = { top: 22, right: 8, bottom: 40, left: 8 };
  const plotH = 150;
  const W = Math.max(width || 320, 320);
  const H = margin.top + plotH + margin.bottom;
  const plotW = W - margin.left - margin.right;
  const band = plotW / 7;
  const barW = Math.min(24, band * 0.5);
  const y = (v: number) => margin.top + plotH - (max ? (v / max) * plotH : 0);
  const aria = `Covers by weekday. ${days.map((d) => `${WEEKDAYS[d.weekday]}: ${d.covers}`).join("; ")}.`;
  return (
    <div ref={ref} className="relative w-full">
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={aria} className="block select-none">
        <line x1={margin.left} x2={W - margin.right} y1={margin.top + plotH} y2={margin.top + plotH} style={{ stroke: "var(--border-strong)" }} strokeWidth={1} />
        {days.map((d, i) => {
          const cx = margin.left + band * i + band / 2;
          const top = y(d.covers);
          const hgt = margin.top + plotH - top;
          const isBusiest = d.covers > 0 && d.weekday === busiest.weekday;
          const active = tip !== null && Math.abs(tip.x - cx) < 0.5;
          return (
            <g key={d.weekday}>
              <path d={barPath(cx - barW / 2, top, barW, hgt, 4)} style={{ fill: isBusiest ? "var(--cleaning)" : "var(--brand)", opacity: tip && !active ? 0.55 : 1, transition: "opacity 120ms ease" }} />
              {isBusiest && (
                <text x={cx} y={top - 8} textAnchor="middle" className="tnum" style={{ fill: "var(--ink)", fontSize: 12, fontWeight: 800 }}>
                  {d.covers.toLocaleString()}
                </text>
              )}
              <rect
                x={margin.left + band * i}
                y={margin.top - 12}
                width={band}
                height={plotH + 12}
                fill="transparent"
                tabIndex={0}
                role="button"
                aria-label={`${WEEKDAYS[d.weekday]}: ${d.covers} covers, ${d.seatings} seatings${d.peakHour !== null ? `, peak at ${formatHour(d.peakHour)}` : ""}`}
                style={{ cursor: "pointer", outline: "none" }}
                onPointerEnter={() => setTip({ x: cx, y: top, node: dayTip(d.weekday, d.covers, d.seatings, d.peakHour) })}
                onFocus={() => setTip({ x: cx, y: top, node: dayTip(d.weekday, d.covers, d.seatings, d.peakHour) })}
                onPointerLeave={() => setTip(null)}
                onBlur={() => setTip(null)}
              />
              <text x={cx} y={margin.top + plotH + 16} textAnchor="middle" style={{ fill: isBusiest ? "var(--ink)" : "var(--ink-2)", fontSize: 12, fontWeight: isBusiest ? 800 : 600 }}>
                {WEEKDAYS[d.weekday]}
              </text>
              <text x={cx} y={margin.top + plotH + 31} textAnchor="middle" style={{ fill: "var(--ink-3)", fontSize: 10.5, fontWeight: 600 }}>
                {d.peakHour !== null ? (band < 60 ? formatHour(d.peakHour) : `peak ${formatHour(d.peakHour)}`) : "—"}
              </text>
            </g>
          );
        })}
      </svg>
      {tip && (
        <div className="pointer-events-none absolute z-10 w-max rounded-xl border border-border bg-surface px-3 py-2 text-xs shadow-md" style={{ left: Math.min(Math.max(tip.x, 80), W - 80), top: Math.max(0, tip.y - 10), transform: "translate(-50%, -100%)" }} role="status">
          {tip.node}
        </div>
      )}
    </div>
  );
}

function dayTip(weekday: number, covers: number, seatings: number, peakHour: number | null): ReactNode {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="text-[13px] font-extrabold text-ink">
        {covers.toLocaleString()} covers <span className="font-semibold text-ink-3">· {WEEKDAYS[weekday]}</span>
      </div>
      <div className="text-ink-2">{seatings} parties seated</div>
      <div className="text-ink-2">{peakHour !== null ? `Peak at ${formatHour(peakHour)}` : "No peak"}</div>
    </div>
  );
}
