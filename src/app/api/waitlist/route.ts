import { connection } from "next/server";
import { getStore } from "@/server/store";

/** Public: a guest joins the waitlist from the QR code page. */
export async function POST(request: Request) {
  await connection();
  const store = getStore();
  let body: { name?: string; size?: number; phone?: string; notes?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  const name = (body.name ?? "").trim();
  const size = Number(body.size);
  if (!name) return Response.json({ ok: false, error: "Please tell us your name" }, { status: 400 });
  if (!Number.isFinite(size) || size < 1 || size > 20) return Response.json({ ok: false, error: "Party size must be between 1 and 20" }, { status: 400 });
  const result = store.dispatch({ type: "addParty", name, size, phone: body.phone, notes: body.notes, source: "guest" }, "manual");
  if (!result.ok || !result.partyId) return Response.json(result, { status: 400 });
  const snap = store.snapshot();
  const party = snap.parties.find((p) => p.id === result.partyId);
  const position = snap.parties.filter((p) => (p.status === "waiting" || p.status === "notified") && p.joinedAt <= (party?.joinedAt ?? 0)).length;
  return Response.json({ ok: true, partyId: result.partyId, quotedMinutes: party?.quotedMinutes ?? null, position, venue: snap.settings.venueName });
}

/** Public: the current quote for a party size. */
export async function GET(request: Request) {
  await connection();
  const store = getStore();
  const size = Math.min(20, Math.max(1, Number(new URL(request.url).searchParams.get("size") ?? 2) || 2));
  const snap = store.snapshot();
  const waiting = snap.parties.filter((p) => p.status === "waiting" || p.status === "notified").length;
  return Response.json({ ok: true, size, quotedMinutes: store.quoteFor(size), waiting, venue: snap.settings.venueName });
}
