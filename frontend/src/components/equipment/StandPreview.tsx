"use client";

import clsx from "clsx";
import { Plus } from "lucide-react";
import { imageUrl } from "@/lib/api";
import { STAND_ASPECT, STAND_SLOTS } from "@/lib/stand-layout";
import type { EquipmentImages, EquipmentSlot } from "@/lib/types";

interface Props {
  images: EquipmentImages;
  className?: string;
  /** When set, every slot becomes a tappable button (also the empty ones). */
  onSlotClick?: (slot: EquipmentSlot) => void;
  slotLabel?: (slot: EquipmentSlot) => string;
}

/** The lighting stand, assembled from its part images. Scales to whatever width it is given. */
export function StandPreview({ images, className, onSlotClick, slotLabel }: Props) {
  return (
    <div className={clsx("relative mx-auto w-full", className)} style={{ aspectRatio: STAND_ASPECT }}>
      {STAND_SLOTS.map((box) => {
        const src = imageUrl(images[box.slot]);
        const style = { left: box.left, top: box.top, width: box.width, height: box.height, zIndex: box.z };

        if (onSlotClick) {
          return (
            <button
              key={box.slot}
              type="button"
              style={style}
              aria-label={slotLabel?.(box.slot)}
              title={slotLabel?.(box.slot)}
              onClick={() => onSlotClick(box.slot)}
              className={clsx(
                "absolute flex items-center justify-center overflow-hidden rounded-md transition-colors",
                src
                  ? "hover:ring-2 hover:ring-brand-500"
                  : "border-2 border-dashed border-line-strong bg-surface/60 text-ink-faint hover:border-brand-500 hover:text-brand-600",
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {src ? <img src={src} alt="" className="size-full object-fill" draggable={false} /> : <Plus className="size-4" />}
            </button>
          );
        }
        return src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={box.slot} src={src} alt="" draggable={false} className="absolute object-fill" style={style} />
        ) : null;
      })}
    </div>
  );
}
