"use client";

import clsx from "clsx";
import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { formatElapsed } from "@/lib/format";
import { STATUS_CLASS, STATUS_LABEL, timerStart } from "@/lib/status";
import type { Alert, Section, Table } from "@/lib/types";

/**
 * The floor, drawn to the venue's layout. Every table is a ring in its status colour
 * with its label and timer; the predicted next free table gets the blue ripple; tables
 * with an open alert pulse. Positions are percentages so the map scales to any screen.
 */
export function FloorMap({ tables, sections, alerts, nextUpId, now, selectedId, onSelect, onMove, className }: { tables: Table[]; sections: Section[]; alerts: Alert[]; nextUpId: string | null; now: number; selectedId?: string | null; onSelect: (id: string) => void; /** When set, tables can be dragged; called with the new position in percent. */ onMove?: (id: string, x: number, y: number) => void; className?: string }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ id: string; x: number; y: number } | null>(null);
  const dragStart = useRef<{ id: string; px: number; py: number; x: number; y: number; moved: boolean } | null>(null);

  const onPointerDown = (e: ReactPointerEvent<HTMLButtonElement>, t: Table) => {
    if (!onMove) return;
    dragStart.current = { id: t.id, px: e.clientX, py: e.clientY, x: t.x, y: t.y, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLButtonElement>, t: Table) => {
    const d = dragStart.current;
    const box = boxRef.current;
    if (!onMove || !d || d.id !== t.id || !box) return;
    const rect = box.getBoundingClientRect();
    const dx = ((e.clientX - d.px) / rect.width) * 100;
    const dy = ((e.clientY - d.py) / rect.height) * 100;
    if (!d.moved && Math.hypot(e.clientX - d.px, e.clientY - d.py) < 4) return;
    d.moved = true;
    setDrag({ id: t.id, x: clamp(d.x + dx, 0, 100 - t.w), y: clamp(d.y + dy, 0, 100 - t.h) });
  };
  const onPointerUp = (t: Table) => {
    const d = dragStart.current;
    dragStart.current = null;
    if (!onMove || !d || d.id !== t.id) return;
    if (d.moved && drag) onMove(t.id, Math.round(drag.x * 2) / 2, Math.round(drag.y * 2) / 2);
    setDrag(null);
  };

  const alertTables = useMemo(() => new Set(alerts.filter((a) => !a.resolvedAt && a.tableId).map((a) => a.tableId as string)), [alerts]);
  const escalated = useMemo(() => new Set(alerts.filter((a) => !a.resolvedAt && a.escalatedAt && a.tableId).map((a) => a.tableId as string)), [alerts]);
  const sectionBoxes = useMemo(
    () =>
      sections
        .map((s) => {
          const ts = tables.filter((t) => t.sectionId === s.id);
          if (!ts.length) return null;
          const x0 = Math.min(...ts.map((t) => t.x)) - 3;
          const y0 = Math.min(...ts.map((t) => t.y)) - 8;
          const x1 = Math.max(...ts.map((t) => t.x + t.w)) + 3;
          const y1 = Math.max(...ts.map((t) => t.y + t.h)) + 3;
          return { id: s.id, name: s.name, x: Math.max(0, x0), y: Math.max(0, y0), w: Math.min(100, x1) - Math.max(0, x0), h: Math.min(100, y1) - Math.max(0, y0) };
        })
        .filter(Boolean) as Array<{ id: string; name: string; x: number; y: number; w: number; h: number }>,
    [sections, tables],
  );

  return (
    <div ref={boxRef} className={clsx("relative w-full overflow-hidden rounded-3xl border border-border bg-surface", onMove && "touch-none", className)} style={{ aspectRatio: "16 / 10" }}>
      <div className="pointer-events-none absolute inset-0 opacity-[0.35]" style={{ backgroundImage: "radial-gradient(var(--border-strong) 1px, transparent 1px)", backgroundSize: "24px 24px" }} aria-hidden="true" />
      {sectionBoxes.map((b) => (
        <div key={b.id} className="pointer-events-none absolute rounded-2xl border border-dashed border-border" style={{ left: `${b.x}%`, top: `${b.y}%`, width: `${b.w}%`, height: `${b.h}%` }} aria-hidden="true">
          <span className="eyebrow absolute left-3 top-2 hidden md:block">{b.name}</span>
        </div>
      ))}
      {tables.map((t) => {
        const c = STATUS_CLASS[t.status];
        const elapsed = now - timerStart(t);
        const isAlert = alertTables.has(t.id);
        const isEsc = escalated.has(t.id);
        const nextUp = nextUpId === t.id;
        const selected = selectedId === t.id;
        const radius = t.shape === "round" ? "9999px" : t.shape === "square" ? "22%" : "18px";
        const pos = drag && drag.id === t.id ? drag : t;
        const dragging = drag?.id === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              if (dragStart.current?.moved) return;
              onSelect(t.id);
            }}
            onPointerDown={(e) => onPointerDown(e, t)}
            onPointerMove={(e) => onPointerMove(e, t)}
            onPointerUp={() => onPointerUp(t)}
            onPointerCancel={() => onPointerUp(t)}
            className={clsx("group absolute grid place-items-center border-[3px] duration-150 active:scale-[0.97]", !dragging && "transition-[transform,box-shadow,left,top]", c.bg, isEsc ? "border-seated" : c.border, isAlert && "ring-pulse", selected && "z-10 shadow-md", onMove && "cursor-grab", dragging && "z-20 cursor-grabbing shadow-lg")}
            style={{ left: `${pos.x}%`, top: `${pos.y}%`, width: `${t.w}%`, height: `${t.h}%`, borderRadius: radius, borderStyle: t.status === "held" ? "dashed" : "solid", outline: selected ? "3px solid var(--brand)" : undefined, outlineOffset: 3 }}
            aria-label={`${t.label}, ${STATUS_LABEL[t.status]}, ${t.seats} seats`}
          >
            {nextUp && (
              <>
                <span className="pointer-events-none absolute -inset-2.5 border-2 border-next opacity-60" style={{ borderRadius: radius }} aria-hidden="true" />
                <span className="pointer-events-none absolute -inset-5 border-2 border-next opacity-30" style={{ borderRadius: radius }} aria-hidden="true" />
              </>
            )}
            <span className="flex flex-col items-center leading-none">
              <span className="text-[clamp(12px,2.1vw,22px)] font-bold tracking-tight text-ink">{t.label}</span>
              <span className={clsx("tnum mt-1 text-[clamp(10px,1.5vw,15px)] font-bold", c.text)}>{t.status === "free" ? (elapsed > 60_000 ? formatElapsed(elapsed) : "Free") : formatElapsed(elapsed)}</span>
              {t.status === "seated" && t.partySize ? <span className="mt-1 hidden text-[clamp(9px,1.1vw,12px)] font-semibold text-ink-2 sm:block">{t.partySize} guests</span> : null}
              {t.status === "cleaning" ? <span className="mt-1 hidden text-[clamp(9px,1.1vw,12px)] font-semibold text-cleaning sm:block">to clean</span> : null}
            </span>
            {isAlert && <span className={clsx("absolute -right-1.5 -top-1.5 h-4 w-4 rounded-full border-2 border-surface", isEsc ? "bg-seated" : "bg-cleaning")} aria-hidden="true" />}
          </button>
        );
      })}
    </div>
  );
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}
