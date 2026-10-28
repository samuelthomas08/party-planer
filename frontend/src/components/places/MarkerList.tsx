"use client";

import clsx from "clsx";
import { useTranslations } from "next-intl";
import { readableOn } from "@/lib/color";
import type { Equipment, Placement } from "@/lib/types";

/** Numbered legend under the plan. Also the easy way to pick a marker that is hard to hit on a small screen. */
export function MarkerList({
  placements,
  equipment,
  selectedId,
  onSelect,
}: {
  placements: Placement[];
  equipment: Equipment[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const t = useTranslations("places");
  if (placements.length === 0) return null;
  return (
    <ul className="mt-4 grid gap-2 sm:grid-cols-2" aria-label={t("markers")}>
      {placements.map((p, i) => {
        const item = equipment.find((e) => e.id === p.equipmentId);
        return (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => onSelect(p.id)}
              aria-pressed={p.id === selectedId}
              className={clsx(
                "flex min-h-12 w-full items-center gap-3 rounded-control border px-3 py-2 text-left transition-colors",
                p.id === selectedId ? "border-brand-500 bg-brand-50 dark:bg-brand-900/40" : "border-line bg-surface hover:bg-sunken",
              )}
            >
              <span
                className="flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-extrabold"
                style={{ background: p.color, color: readableOn(p.color) }}
              >
                {i + 1}
              </span>
              <span className={clsx("min-w-0 flex-1 truncate font-semibold", !item && "text-ink-faint")}>
                {item ? item.title : t("noEquipmentAssigned")}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
