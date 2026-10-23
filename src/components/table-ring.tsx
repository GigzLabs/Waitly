"use client";

import clsx from "clsx";
import { formatElapsed } from "@/lib/format";
import { STATUS_CLASS, STATUS_LABEL, timerStart } from "@/lib/status";
import type { Table } from "@/lib/types";

/**
 * The one motif: a ring per table coloured by status, label inside, timer beneath.
 * Used on the floor map and in lists. `now` comes from useNow so timers keep running.
 */
export function TableRing({ table, now, size = 88, alert, nextUp, onClick, className }: { table: Table; now: number; size?: number; alert?: boolean; nextUp?: boolean; onClick?: () => void; className?: string }) {
  const c = STATUS_CLASS[table.status];
  const elapsed = now - timerStart(table);
  const showTimer = table.status !== "free" || elapsed > 60_000;
  const labelSize = Math.max(13, Math.round(size * 0.2));
  const timerSize = Math.max(11, Math.round(size * 0.14));
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx("relative grid shrink-0 place-items-center rounded-full border-[3px] transition-transform active:scale-[0.97]", c.border, c.bg, alert && "ring-pulse", className)}
      style={{ width: size, height: size, borderStyle: table.status === "held" ? "dashed" : "solid" }}
      aria-label={`${table.label}, ${STATUS_LABEL[table.status]}${showTimer ? `, ${formatElapsed(elapsed)}` : ""}`}
    >
      {nextUp && (
        <>
          <span className="pointer-events-none absolute -inset-3 rounded-full border-2 border-next opacity-50" aria-hidden="true" />
          <span className="pointer-events-none absolute -inset-6 rounded-full border-2 border-next opacity-25" aria-hidden="true" />
        </>
      )}
      <span className="flex flex-col items-center leading-none">
        <span className="font-bold tracking-tight text-ink" style={{ fontSize: labelSize }}>
          {table.label}
        </span>
        <span className={clsx("tnum mt-1 font-bold", c.text)} style={{ fontSize: timerSize }}>
          {showTimer ? formatElapsed(elapsed) : "Free"}
        </span>
      </span>
    </button>
  );
}
