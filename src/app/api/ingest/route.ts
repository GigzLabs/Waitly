import { connection } from "next/server";
import type { Source } from "@/lib/types";
import { getStore } from "@/server/store";

interface IngestEvent {
  table?: string;
  tableId?: string;
  state: "occupied" | "empty" | "staff_present";
  confidence?: number;
  ts?: number;
  partySize?: number;
  source?: Source;
}

/**
 * Camera-AI and POS integrations. "You don't always need a new camera": any system
 * that can say which table is occupied, empty or being served can drive Waitly.
 *
 * POST /api/ingest
 * Headers: x-waitly-key: <api key from Settings>
 * Body: { "table": "M4", "state": "occupied", "confidence": 0.93, "partySize": 3 }
 *    or { "events": [ ...same shape... ] }
 */
export async function POST(request: Request) {
  await connection();
  const store = getStore();
  const key = request.headers.get("x-waitly-key") ?? new URL(request.url).searchParams.get("key");
  if (!store.checkApiKey(key)) return Response.json({ ok: false, error: "Invalid API key" }, { status: 401 });
  let body: IngestEvent | { events: IngestEvent[] };
  try {
    body = (await request.json()) as IngestEvent | { events: IngestEvent[] };
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  const events = "events" in body && Array.isArray(body.events) ? body.events : [body as IngestEvent];
  const results = events.map((e) => {
    if (!e || !["occupied", "empty", "staff_present"].includes(e.state)) return { ok: false, error: "state must be occupied, empty or staff_present" };
    const source: Source = e.source === "pos" ? "pos" : "camera";
    return store.dispatch(
      { type: "ingest", tableId: e.tableId, label: e.table, state: e.state, confidence: e.confidence, ts: e.ts, partySize: e.partySize, source },
      source,
    );
  });
  const ok = results.every((r) => r.ok);
  return Response.json({ ok, results }, { status: ok ? 200 : 207 });
}
