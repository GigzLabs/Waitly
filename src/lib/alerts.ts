import type { Alert, AlertType, Party, Settings, Table } from "./types";

const MIN = 60_000;

export interface AlertChange {
  open: Array<{ type: AlertType; tableId?: string; partyId?: string; message: string }>;
  escalate: string[]; // alert ids
  resolve: string[]; // alert ids resolved because the condition cleared
}

function openAlert(alerts: Alert[], type: AlertType, key: "tableId" | "partyId", id: string): Alert | undefined {
  return alerts.find((a) => a.type === type && !a.resolvedAt && a[key] === id);
}

/**
 * Evaluates every SLA from the current state and returns what should change.
 * Pure: the store applies the result. Each rule maps to a sentence in the source video:
 *  - no_greet: "seated for five minutes without a waiter arriving"
 *  - needs_cleaning: "a table becomes free but hasn't been cleaned yet"
 *  - no_revisit and long_wait are Waitly additions.
 */
export function evaluateAlerts(tables: Table[], parties: Party[], alerts: Alert[], settings: Settings, now: number): AlertChange {
  const change: AlertChange = { open: [], escalate: [], resolve: [] };

  for (const t of tables) {
    const noGreet = openAlert(alerts, "no_greet", "tableId", t.id);
    const noRevisit = openAlert(alerts, "no_revisit", "tableId", t.id);
    const cleaning = openAlert(alerts, "needs_cleaning", "tableId", t.id);

    if (t.status === "seated" && t.seatedAt) {
      const sinceSeated = now - t.seatedAt;
      if (!t.greetedAt) {
        if (sinceSeated >= settings.greetSlaMin * MIN) {
          if (!noGreet) {
            change.open.push({
              type: "no_greet",
              tableId: t.id,
              message: `Seated ${Math.floor(sinceSeated / MIN)} min, no server yet`,
            });
          } else if (!noGreet.escalatedAt && sinceSeated >= settings.greetSlaMin * 2 * MIN) {
            change.escalate.push(noGreet.id);
          }
        }
      } else {
        if (noGreet) change.resolve.push(noGreet.id);
        const lastVisit = t.lastVisitAt ?? t.greetedAt;
        const sinceVisit = now - lastVisit;
        if (sinceVisit >= settings.revisitSlaMin * MIN) {
          if (!noRevisit) {
            change.open.push({
              type: "no_revisit",
              tableId: t.id,
              message: `No server visit for ${Math.floor(sinceVisit / MIN)} min`,
            });
          } else if (!noRevisit.escalatedAt && sinceVisit >= settings.revisitSlaMin * 1.5 * MIN) {
            change.escalate.push(noRevisit.id);
          }
        } else if (noRevisit) {
          change.resolve.push(noRevisit.id);
        }
      }
      if (cleaning) change.resolve.push(cleaning.id);
    } else {
      if (noGreet) change.resolve.push(noGreet.id);
      if (noRevisit) change.resolve.push(noRevisit.id);
      if (t.status === "cleaning") {
        const dirtyFor = now - t.statusSince;
        if (!cleaning) {
          change.open.push({ type: "needs_cleaning", tableId: t.id, message: "Released, to be cleaned" });
        } else if (!cleaning.escalatedAt && dirtyFor >= settings.cleaningSlaMin * MIN) {
          change.escalate.push(cleaning.id);
        }
      } else if (cleaning) {
        change.resolve.push(cleaning.id);
      }
    }
  }

  for (const p of parties) {
    const longWait = openAlert(alerts, "long_wait", "partyId", p.id);
    if (p.status === "waiting" || p.status === "notified") {
      const waited = (now - p.joinedAt) / MIN;
      const over = waited - p.quotedMinutes;
      if (over >= settings.longWaitSlaMin) {
        if (!longWait) {
          change.open.push({
            type: "long_wait",
            partyId: p.id,
            message: `Waiting ${Math.floor(waited)} min, quoted ${p.quotedMinutes}`,
          });
        } else if (!longWait.escalatedAt && over >= settings.longWaitSlaMin * 2) {
          change.escalate.push(longWait.id);
        }
      }
    } else if (longWait) {
      change.resolve.push(longWait.id);
    }
  }

  return change;
}

/** Human text for an alert type, used in lists and notifications. */
export function alertTitle(type: AlertType): string {
  switch (type) {
    case "no_greet":
      return "No server yet";
    case "no_revisit":
      return "Check on the table";
    case "needs_cleaning":
      return "Needs cleaning";
    case "long_wait":
      return "Waiting too long";
  }
}

/** The action verb that resolves the alert, matching the table sheet. */
export function alertActionLabel(type: AlertType): string {
  switch (type) {
    case "no_greet":
    case "no_revisit":
      return "Server arrived";
    case "needs_cleaning":
      return "Mark cleaned";
    case "long_wait":
      return "Seat party";
  }
}

export function isEscalated(a: Alert): boolean {
  return Boolean(a.escalatedAt) && !a.resolvedAt;
}

const TYPE_RANK: Record<AlertType, number> = { no_greet: 0, long_wait: 1, needs_cleaning: 2, no_revisit: 3 };

/** Sort order for anything that lists open alerts: escalated first, then by urgency of the rule, then oldest first. */
export function compareAlerts(a: Alert, b: Alert): number {
  const esc = Number(Boolean(b.escalatedAt)) - Number(Boolean(a.escalatedAt));
  if (esc) return esc;
  const rank = TYPE_RANK[a.type] - TYPE_RANK[b.type];
  if (rank) return rank;
  return a.createdAt - b.createdAt;
}
