import { connection } from "next/server";
import { getStore } from "@/server/store";

export async function GET(request: Request) {
  await connection();
  const days = Math.min(90, Math.max(1, Number(new URL(request.url).searchParams.get("days") ?? 7) || 7));
  return Response.json(getStore().insights(days), { headers: { "Cache-Control": "no-store" } });
}
