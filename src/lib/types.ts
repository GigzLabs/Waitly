// Shared domain types for Waitly. Used by the server store, the API and the client.

export type TableStatus = "free" | "seated" | "cleaning" | "held";
export type Source = "manual" | "camera" | "pos" | "sim";
export type TableShape = "round" | "square" | "rect";

export interface Section {
  id: string;
  name: string;
  /** Staff id of the server who owns this section, if any. */
  serverId?: string | null;
}

export interface Table {
  id: string;
  label: string;
  seats: number;
  sectionId: string;
  shape: TableShape;
  /** Floor-map position and size in percent of the floor (0–100). */
  x: number;
  y: number;
  w: number;
  h: number;
  status: TableStatus;
  /** When the current status began (ms since epoch). */
  statusSince: number;
  seatedAt?: number | null;
  partySize?: number | null;
  partyName?: string | null;
  partyId?: string | null;
  /** First server visit of the current party. */
  greetedAt?: number | null;
  /** Most recent server visit of the current party. */
  lastVisitAt?: number | null;
  /** Explicit server override; otherwise the section's server. */
  serverId?: string | null;
  /** Party id the table is held for. */
  heldFor?: string | null;
  note?: string | null;
  /** Where the last status change came from. */
  source?: Source;
  /** Last manual change; camera/POS events are ignored for a minute after it. */
  manualLockUntil?: number | null;
}

export type AlertType = "no_greet" | "no_revisit" | "needs_cleaning" | "long_wait";

export interface Alert {
  id: string;
  type: AlertType;
  tableId?: string | null;
  partyId?: string | null;
  message: string;
  createdAt: number;
  escalatedAt?: number | null;
  acknowledgedAt?: number | null;
  acknowledgedBy?: string | null;
  resolvedAt?: number | null;
  resolvedBy?: string | null;
}

export type PartyStatus = "waiting" | "notified" | "seated" | "left" | "no_show";

export interface Party {
  id: string;
  name: string;
  size: number;
  phone?: string | null;
  notes?: string | null;
  joinedAt: number;
  quotedMinutes: number;
  status: PartyStatus;
  notifiedAt?: number | null;
  seatedAt?: number | null;
  leftAt?: number | null;
  tableId?: string | null;
  source: "host" | "guest" | "sim";
}

export type StaffRole = "host" | "server" | "busser" | "manager";

export interface Staff {
  id: string;
  name: string;
  role: StaffRole;
  sectionIds: string[];
  onShift: boolean;
}

export interface Settings {
  venueName: string;
  slug: string;
  /** Minutes a seated party may wait for a first server visit. Video default: 5. */
  greetSlaMin: number;
  /** Minutes between server visits before a re-visit alert. */
  revisitSlaMin: number;
  /** Minutes a released table may stay dirty before the cleaning alert escalates. */
  cleaningSlaMin: number;
  /** Minutes over the quoted wait before a long-wait alert. */
  longWaitSlaMin: number;
  /** Covers one server can handle at once; drives the staffing recommendation. */
  coversPerServer: number;
  /** Fallback dining duration when the venue has no history yet. */
  defaultDiningMin: number;
  openHour: number;
  closeHour: number;
  managerPin: string;
  /** Key that camera-AI and POS integrations send in the x-waitly-key header. */
  apiKey: string;
  demoMode: boolean;
  soundOn: boolean;
}

export type EventType =
  | "seated"
  | "greeted"
  | "visited"
  | "released"
  | "cleaned"
  | "held"
  | "unheld"
  | "party_joined"
  | "party_notified"
  | "party_seated"
  | "party_left"
  | "alert_opened"
  | "alert_escalated"
  | "alert_acknowledged"
  | "alert_resolved";

export interface EventRecord {
  id: string;
  ts: number;
  type: EventType;
  tableId?: string | null;
  partyId?: string | null;
  alertId?: string | null;
  alertType?: AlertType | null;
  /** Party size for seating events. */
  size?: number | null;
  /** Duration the event closes (dining time for released, cleaning time for cleaned, greet time for greeted, wait for party_seated). */
  durationMs?: number | null;
  source?: Source;
  staffId?: string | null;
}

export interface Prediction {
  tableId: string;
  label: string;
  seats: number;
  status: TableStatus;
  /** Minutes until the table is expected to be free and clean. 0 for free tables. */
  etaMin: number;
  confidence: "high" | "medium" | "low";
  reason: string;
}

export interface WaitSuggestion {
  partyId: string;
  tableId: string | null;
  label: string | null;
  etaMin: number;
  confidence: "high" | "medium" | "low";
}

export interface Snapshot {
  version: number;
  now: number;
  settings: Settings;
  sections: Section[];
  tables: Table[];
  alerts: Alert[];
  parties: Party[];
  staff: Staff[];
  predictions: Prediction[];
  suggestions: WaitSuggestion[];
  recentEvents: EventRecord[];
}

export interface HourStat {
  hour: number;
  /** Average concurrent occupied tables during the hour. */
  occupiedTables: number;
  /** Average concurrent covers during the hour. */
  covers: number;
  /** Parties seated during the hour. */
  seatings: number;
  /** Share of tables occupied, 0–1. */
  occupancy: number;
  recommendedServers: number;
  peak: boolean;
}

export interface DayStat {
  /** 0 = Sunday. */
  weekday: number;
  covers: number;
  seatings: number;
  peakHour: number | null;
}

export interface Insights {
  days: number;
  tableCount: number;
  hours: HourStat[];
  byWeekday: DayStat[];
  metrics: {
    seatings: number;
    covers: number;
    avgGreetMin: number | null;
    greetWithinSlaPct: number | null;
    avgRevisitMin: number | null;
    avgCleaningMin: number | null;
    cleaningWithinSlaPct: number | null;
    avgDiningMin: number | null;
    turnsPerTablePerDay: number | null;
    avgWaitMin: number | null;
    walkAways: number;
    alertsOpened: number;
    /** Parties that waited past the greet SLA. */
    lateGreets: number;
    avgAlertResolveMin: number | null;
  };
  peakHours: number[];
  slowestCleaningHour: number | null;
}

/** Commands the UI (and the simulation) can send to the store. */
export type Action =
  | { type: "seat"; tableId: string; size: number; name?: string; partyId?: string; staffId?: string }
  | { type: "serverArrived"; tableId: string; staffId?: string }
  | { type: "guestsLeft"; tableId: string; staffId?: string }
  | { type: "markCleaned"; tableId: string; staffId?: string }
  | { type: "hold"; tableId: string; partyId?: string }
  | { type: "unhold"; tableId: string }
  | { type: "setNote"; tableId: string; note: string }
  | { type: "assignServer"; tableId: string; staffId: string | null }
  | { type: "addParty"; name: string; size: number; phone?: string; notes?: string; quotedMinutes?: number; source?: Party["source"] }
  | { type: "updateParty"; partyId: string; patch: Partial<Pick<Party, "name" | "size" | "phone" | "notes" | "quotedMinutes">> }
  | { type: "notifyParty"; partyId: string }
  | { type: "seatParty"; partyId: string; tableId: string; staffId?: string }
  | { type: "partyLeft"; partyId: string }
  | { type: "ackAlert"; alertId: string; staffId?: string }
  | { type: "resolveAlert"; alertId: string; staffId?: string }
  | { type: "updateSettings"; patch: Partial<Settings>; pin?: string }
  | { type: "upsertTable"; table: Partial<Table> & { label: string; seats: number; sectionId: string } & { id?: string }; pin?: string }
  | { type: "deleteTable"; tableId: string; pin?: string }
  | { type: "upsertSection"; section: Partial<Section> & { name: string } & { id?: string }; pin?: string }
  | { type: "deleteSection"; sectionId: string; pin?: string }
  | { type: "upsertStaff"; staff: Partial<Staff> & { name: string; role: StaffRole } & { id?: string }; pin?: string }
  | { type: "deleteStaff"; staffId: string; pin?: string }
  | { type: "toggleShift"; staffId: string }
  | { type: "setDemo"; on: boolean; pin?: string }
  | { type: "resetDemo"; pin?: string }
  | { type: "ingest"; tableId?: string; label?: string; state: "occupied" | "empty" | "staff_present"; ts?: number; confidence?: number; source?: Source; partySize?: number };

export interface ActionResult {
  ok: boolean;
  error?: string;
  version?: number;
  partyId?: string;
  tableId?: string;
}
