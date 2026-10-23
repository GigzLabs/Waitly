import { describe, expect, it } from "vitest";
import { computeInsights } from "@/lib/insights";
import { defaultFloor, defaultSettings, generateHistory } from "@/server/seed";

describe("your peak times", () => {
  const settings = defaultSettings();
  const { tables } = defaultFloor();
  const now = new Date(2026, 9, 23, 23, 30).getTime();
  const events = generateHistory(tables, settings, now, 14);
  const insights = computeInsights(events, tables, settings, now, 7);

  it("finds the dinner peak and recommends servers from covers", () => {
    expect(insights.peakHours.length).toBeGreaterThan(0);
    expect(insights.peakHours).toContain(19);
    expect(insights.peakHours.every((h) => h >= settings.openHour && h < settings.closeHour)).toBe(true);
    expect(insights.hours[16].occupancy).toBeLessThan(insights.hours[19].occupancy * 0.6);
    const peak = insights.hours[19];
    expect(peak.peak).toBe(true);
    expect(peak.occupancy).toBeGreaterThan(0.4);
    expect(peak.recommendedServers).toBe(Math.max(1, Math.ceil(peak.covers / settings.coversPerServer)));
    expect(insights.hours[3].covers).toBe(0);
    expect(insights.hours[3].recommendedServers).toBe(0);
  });

  it("reports service metrics inside realistic ranges", () => {
    const m = insights.metrics;
    expect(m.seatings).toBeGreaterThan(100);
    expect(m.avgGreetMin).toBeGreaterThan(1);
    expect(m.avgGreetMin!).toBeLessThan(6);
    expect(m.greetWithinSlaPct).toBeGreaterThan(60);
    expect(m.avgCleaningMin).toBeGreaterThan(1);
    expect(m.avgDiningMin).toBeGreaterThan(40);
    expect(m.turnsPerTablePerDay).toBeGreaterThan(3);
    expect(m.avgWaitMin).toBeGreaterThan(3);
  });

  it("weights weekends heavier", () => {
    const sat = insights.byWeekday[6].covers;
    const tue = insights.byWeekday[2].covers;
    expect(sat).toBeGreaterThan(tue);
  });
});
