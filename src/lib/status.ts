import type { Table, TableStatus } from "./types";

export const STATUS_LABEL: Record<TableStatus, string> = {
  free: "Free",
  seated: "Seated",
  cleaning: "Needs cleaning",
  held: "Held",
};

/** Tailwind class fragments per status, built on the brand tokens. */
export const STATUS_CLASS: Record<TableStatus, { text: string; border: string; bg: string; dot: string }> = {
  free: { text: "text-free", border: "border-free", bg: "bg-free-soft", dot: "bg-free" },
  seated: { text: "text-seated", border: "border-seated", bg: "bg-seated-soft", dot: "bg-seated" },
  cleaning: { text: "text-cleaning", border: "border-cleaning", bg: "bg-cleaning-soft", dot: "bg-cleaning" },
  held: { text: "text-held", border: "border-held", bg: "bg-held-soft", dot: "bg-held" },
};

/** The timestamp a table's visible timer counts from. */
export function timerStart(t: Table): number {
  if (t.status === "seated") return t.seatedAt ?? t.statusSince;
  return t.statusSince;
}
