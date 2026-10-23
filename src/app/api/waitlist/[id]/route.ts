import { connection } from "next/server";
import { getStore } from "@/server/store";

/** Public: a guest checks their place in line. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await ctx.params;
  const store = getStore();
  const snap = store.snapshot();
  const party = store.state.parties.find((p) => p.id === id);
  if (!party) return Response.json({ ok: false, error: "We could not find that spot in line" }, { status: 404 });
  const ahead = snap.parties.filter((p) => (p.status === "waiting" || p.status === "notified") && p.joinedAt < party.joinedAt).length;
  const suggestion = snap.suggestions.find((s) => s.partyId === party.id);
  const table = party.tableId ? snap.tables.find((t) => t.id === party.tableId) : null;
  return Response.json({
    ok: true,
    venue: snap.settings.venueName,
    party: { id: party.id, name: party.name, size: party.size, status: party.status, joinedAt: party.joinedAt, quotedMinutes: party.quotedMinutes, notifiedAt: party.notifiedAt ?? null, seatedAt: party.seatedAt ?? null },
    position: party.status === "waiting" || party.status === "notified" ? ahead + 1 : null,
    etaMin: suggestion && suggestion.tableId ? suggestion.etaMin : null,
    tableLabel: table?.label ?? null,
    now: snap.now,
  });
}

/** Public: a guest leaves the line. */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await ctx.params;
  const result = getStore().dispatch({ type: "partyLeft", partyId: id }, "manual");
  return Response.json(result, { status: result.ok ? 200 : 400 });
}
