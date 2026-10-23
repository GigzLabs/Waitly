import { connection } from "next/server";
import { getStore } from "@/server/store";

export async function GET() {
  await connection();
  const store = getStore();
  return Response.json({ ok: true, version: store.version, tables: store.state.tables.length, demoMode: store.state.settings.demoMode });
}
