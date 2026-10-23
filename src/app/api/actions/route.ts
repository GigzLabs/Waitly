import { connection } from "next/server";
import type { Action } from "@/lib/types";
import { getStore } from "@/server/store";

interface Body {
  action?: Action;
  staffId?: string | null;
}

/** Staff actions from the host stand and phones. Integrations use /api/ingest instead. */
export async function POST(request: Request) {
  await connection();
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  const action = body.action;
  if (!action || typeof action !== "object" || typeof action.type !== "string") {
    return Response.json({ ok: false, error: "Missing action" }, { status: 400 });
  }
  if (action.type === "ingest") {
    return Response.json({ ok: false, error: "Use /api/ingest with an API key" }, { status: 400 });
  }
  const result = getStore().dispatch(action, "manual", body.staffId ?? null);
  return Response.json(result, { status: result.ok ? 200 : 400 });
}
