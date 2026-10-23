import { connection } from "next/server";
import { getStore } from "@/server/store";

export async function GET() {
  await connection();
  return Response.json(getStore().snapshot(), { headers: { "Cache-Control": "no-store" } });
}
