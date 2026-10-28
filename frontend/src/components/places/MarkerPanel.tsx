"use client";

import clsx from "clsx";
import { Check, Search, Trash2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { MARKER_COLORS } from "@/lib/color";
import type { Equipment, Placement } from "@/lib/types";
import { EquipmentVisual } from "../equipment/EquipmentVisual";
import { Button, IconButton } from "../ui/Button";
import { Badge } from "../ui/misc";

/**
 * Docked panel for the selected marker. A bottom drawer on phones (the plan stays visible above it,
 * so colour and position changes can be seen live), a sticky side column on large screens.
 */
export function PanelFrame({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const t = useTranslations("common");
  return (
    <aside
      className={clsx(
        "fixed inset-x-0 bottom-0 z-40 max-h-[52dvh] overflow-y-auto overscroll-contain rounded-t-3xl border-t border-line bg-surface px-5 pb-safe pt-3 shadow-pop animate-sheet-up",
        "lg:sticky lg:top-24 lg:z-auto lg:max-h-[calc(100dvh-8rem)] lg:rounded-card lg:border lg:pb-5 lg:shadow-card lg:animate-none",
      )}
      aria-label={title}
    >
      <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-line-strong lg:hidden" aria-hidden />
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-lg font-bold">{title}</h2>
        <IconButton label={t("close")} onClick={onClose} className="-mr-2">
          <X className="size-5" />
        </IconButton>
      </div>
      {children}
    </aside>
  );
}

interface EditProps {
  index: number;
  placement: Placement;
  equipment: Equipment[];
  onChange: (patch: Partial<Placement>) => void;
  onDelete: () => void;
  onClose: () => void;
}

/** Editor for the selected marker: equipment, colour, remove. */
export function MarkerEditPanel({ index, placement, equipment, onChange, onDelete, onClose }: EditProps) {
  const t = useTranslations();
  const [filter, setFilter] = useState("");
  const shown = equipment.filter((e) => e.title.toLowerCase().includes(filter.trim().toLowerCase()));

  return (
    <PanelFrame title={t("places.markerTitle", { n: index + 1 })} onClose={onClose}>
      <div className="space-y-5">
        <div>
          <p className="mb-2 text-sm font-semibold">{t("places.equipment")}</p>
          {equipment.length === 0 ? (
            <p className="rounded-control bg-sunken px-3 py-3 text-sm text-ink-soft">{t("places.noEquipmentYet")}</p>
          ) : (
            <>
              {equipment.length > 6 && (
                <div className="relative mb-2">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint" />
                  <input
                    type="search"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    placeholder={t("places.searchEquipment")}
                    aria-label={t("places.searchEquipment")}
                    className="h-11 w-full rounded-control border border-line-strong bg-surface pl-9 pr-3 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                  />
                </div>
              )}
              <ul role="radiogroup" aria-label={t("places.equipment")} className="max-h-56 space-y-1.5 overflow-y-auto">
                {shown.map((e) => {
                  const chosen = e.id === placement.equipmentId;
                  return (
                    <li key={e.id}>
                      <button
                        type="button"
                        role="radio"
                        aria-checked={chosen}
                        onClick={() => onChange({ equipmentId: chosen ? null : e.id })}
                        className={clsx(
                          "flex min-h-14 w-full items-center gap-3 rounded-control border px-2.5 py-1.5 text-left transition-colors",
                          chosen ? "border-brand-500 bg-brand-50 dark:bg-brand-900/40" : "border-line hover:bg-sunken",
                        )}
                      >
                        <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-sunken p-1">
                          <EquipmentVisual equipment={e} className="h-full w-auto" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold">{e.title}</span>
                          <span className="text-xs text-ink-faint">{t(`equipment.category.${e.category}`)}</span>
                        </span>
                        {chosen && <Check className="size-5 shrink-0 text-brand-600 dark:text-brand-300" />}
                      </button>
                    </li>
                  );
                })}
                {shown.length === 0 && <li className="px-1 py-2 text-sm text-ink-faint">{t("places.noMatch")}</li>}
              </ul>
            </>
          )}
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold">{t("places.color")}</p>
          <div className="flex flex-wrap items-center gap-2">
            {MARKER_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={c}
                aria-pressed={placement.color === c}
                onClick={() => onChange({ color: c })}
                className={clsx(
                  "flex size-11 items-center justify-center rounded-full ring-offset-2 ring-offset-surface transition-shadow",
                  placement.color === c ? "ring-2 ring-ink" : "ring-1 ring-line-strong",
                )}
                style={{ background: c }}
              />
            ))}
            <label className="flex h-11 cursor-pointer items-center gap-2 rounded-full border border-line-strong px-3 text-sm font-semibold text-ink-soft">
              <input
                type="color"
                value={placement.color}
                onChange={(e) => onChange({ color: e.target.value })}
                className="size-6 cursor-pointer rounded border-0 bg-transparent p-0"
                aria-label={t("places.customColor")}
              />
              {t("places.custom")}
            </label>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="secondary" className="text-danger-600 dark:text-danger-500" icon={<Trash2 className="size-5" />} onClick={onDelete}>
            {t("places.removeMarker")}
          </Button>
          <Button className="ml-auto" onClick={onClose}>
            {t("common.done")}
          </Button>
        </div>
      </div>
    </PanelFrame>
  );
}

/** Read-only details of the equipment at the selected marker. */
export function MarkerViewPanel({ index, placement, equipment, onClose }: { index: number; placement: Placement; equipment: Equipment | undefined; onClose: () => void }) {
  const t = useTranslations();
  return (
    <PanelFrame title={t("places.markerTitle", { n: index + 1 })} onClose={onClose}>
      {equipment ? (
        <div className="space-y-4">
          <div className="flex h-44 items-center justify-center rounded-card bg-gradient-to-b from-sunken/60 to-sunken p-3">
            <EquipmentVisual equipment={equipment} className="h-full w-auto" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="size-4 shrink-0 rounded-full ring-1 ring-line-strong" style={{ background: placement.color }} aria-hidden />
              <h3 className="min-w-0 flex-1 truncate text-lg font-bold">{equipment.title}</h3>
            </div>
            <Badge tone={equipment.category === "STAND" ? "brand" : "party"}>{t(`equipment.category.${equipment.category}`)}</Badge>
          </div>
          <div>
            <p className="mb-1 text-sm font-semibold">{t("equipment.description")}</p>
            <p className="whitespace-pre-wrap text-ink-soft">{equipment.description || t("places.noDescription")}</p>
          </div>
        </div>
      ) : (
        <p className="rounded-control bg-sunken px-3 py-3 text-ink-soft">{t("places.noEquipmentAssigned")}</p>
      )}
    </PanelFrame>
  );
}
