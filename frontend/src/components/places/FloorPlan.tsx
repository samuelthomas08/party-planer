"use client";

import clsx from "clsx";
import { useRef } from "react";
import type { KeyboardEvent, PointerEvent } from "react";
import { imageUrl } from "@/lib/api";
import { readableOn } from "@/lib/color";
import type { Placement } from "@/lib/types";

interface Props {
  imageId: string;
  placements: Placement[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** Edit mode enables dragging, keyboard nudging and tap-to-add. */
  editable?: boolean;
  addMode?: boolean;
  onAdd?: (x: number, y: number) => void;
  onMove?: (id: string, x: number, y: number) => void;
  markerLabel: (index: number) => string;
  planLabel: string;
}

const clamp = (v: number) => Math.min(1, Math.max(0, v));

/**
 * The floor plan with its markers. Markers are positioned in percentages of the image box, so there is no
 * measuring or resize handling: it stays correct at any size, on any device.
 */
export function FloorPlan({
  imageId,
  placements,
  selectedId,
  onSelect,
  editable,
  addMode,
  onAdd,
  onMove,
  markerLabel,
  planLabel,
}: Props) {
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: string; moved: boolean; startX: number; startY: number } | null>(null);

  const toRelative = (clientX: number, clientY: number) => {
    const rect = box.current!.getBoundingClientRect();
    return { x: clamp((clientX - rect.left) / rect.width), y: clamp((clientY - rect.top) / rect.height) };
  };

  const onPlanClick = (e: React.MouseEvent) => {
    if (addMode && onAdd) {
      const { x, y } = toRelative(e.clientX, e.clientY);
      onAdd(x, y);
    } else {
      onSelect(null);
    }
  };

  const down = (e: PointerEvent<HTMLButtonElement>, id: string) => {
    if (!editable) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { id, moved: false, startX: e.clientX, startY: e.clientY };
  };

  const move = (e: PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d) return;
    if (!d.moved && Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < 6) return;
    d.moved = true;
    const { x, y } = toRelative(e.clientX, e.clientY);
    onMove?.(d.id, x, y);
  };

  const up = (id: string) => {
    const d = drag.current;
    drag.current = null;
    if (!d?.moved) onSelect(id);
  };

  const key = (e: KeyboardEvent<HTMLButtonElement>, p: Placement) => {
    if (!editable) return;
    const step = e.shiftKey ? 0.05 : 0.01;
    const delta: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const d = delta[e.key];
    if (d) {
      e.preventDefault();
      onMove?.(p.id, clamp(p.x + d[0]), clamp(p.y + d[1]));
    }
  };

  return (
    <div
      ref={box}
      className={clsx("relative mx-auto w-fit max-w-full select-none overflow-hidden rounded-card bg-sunken", addMode && "cursor-crosshair")}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageUrl(imageId)}
        alt={planLabel}
        draggable={false}
        className="block h-auto max-h-[62dvh] w-auto max-w-full"
        onClick={onPlanClick}
      />
      {addMode && (
        <div className="pointer-events-none absolute inset-x-0 top-2 flex justify-center">
          <span className="rounded-full bg-ink/80 px-3 py-1 text-xs font-semibold text-canvas">{markerLabel(-1)}</span>
        </div>
      )}
      {placements.map((p, i) => {
        const selected = p.id === selectedId;
        return (
          <button
            key={p.id}
            type="button"
            aria-label={markerLabel(i)}
            aria-pressed={selected}
            style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}
            className={clsx(
              "absolute z-10 flex size-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full",
              editable && "touch-none cursor-grab active:cursor-grabbing",
              addMode && "pointer-events-none",
            )}
            onPointerDown={(e) => down(e, p.id)}
            onPointerMove={move}
            onPointerUp={() => up(p.id)}
            onPointerCancel={() => (drag.current = null)}
            onClick={() => !editable && onSelect(p.id)}
            onKeyDown={(e) => key(e, p)}
          >
            <span
              className={clsx(
                "flex size-9 items-center justify-center rounded-full text-sm font-extrabold shadow-md ring-2 ring-white transition-transform",
                selected && "z-20 scale-125 ring-4 ring-offset-2 ring-offset-brand-500",
              )}
              style={{ background: p.color, color: readableOn(p.color) }}
            >
              {i + 1}
            </span>
          </button>
        );
      })}
    </div>
  );
}
