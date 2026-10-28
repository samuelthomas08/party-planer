"use client";

import clsx from "clsx";
import { Pencil } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import type { Equipment, Place } from "@/lib/types";
import { Card, EmptyState } from "../ui/misc";
import { FloorPlan } from "./FloorPlan";
import { MarkerList } from "./MarkerList";
import { MarkerViewPanel } from "./MarkerPanel";

/** Read-only floor plan with tappable markers. Shared by the owner's view and the guest view. */
export function PlaceViewer({ place, equipment, emptyHint }: { place: Place; equipment: Equipment[]; emptyHint?: string }) {
  const t = useTranslations();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selectedIndex = place.placements.findIndex((p) => p.id === selectedId);
  const selected = selectedIndex >= 0 ? place.placements[selectedIndex] : null;

  return (
    <div className={clsx("grid gap-6 lg:grid-cols-[1fr_24rem]", selected && "pb-[52dvh] lg:pb-0")}>
      <Card className="min-w-0 p-4 sm:p-5">
        <FloorPlan
          imageId={place.floorPlanImageId}
          placements={place.placements}
          selectedId={selectedId}
          onSelect={setSelectedId}
          markerLabel={(i) => t("places.markerTitle", { n: i + 1 })}
          planLabel={place.name}
        />
        {place.placements.length === 0 ? (
          <div className="mt-4">
            <EmptyState icon={<Pencil className="size-6" />} title={t("places.noMarkers")}>
              {emptyHint ?? t("places.noMarkersHint")}
            </EmptyState>
          </div>
        ) : (
          <>
            <p className="mt-3 text-sm text-ink-faint">{t("places.viewHint")}</p>
            <MarkerList placements={place.placements} equipment={equipment} selectedId={selectedId} onSelect={setSelectedId} />
          </>
        )}
      </Card>

      {selected ? (
        <MarkerViewPanel
          index={selectedIndex}
          placement={selected}
          equipment={equipment.find((e) => e.id === selected.equipmentId)}
          onClose={() => setSelectedId(null)}
        />
      ) : (
        <div className="hidden rounded-card border-2 border-dashed border-line-strong p-6 text-center text-ink-faint lg:block">
          <p className="font-bold text-ink-soft">{t("places.selection")}</p>
          <p className="mt-1 text-sm">{t("places.nothingSelected")}</p>
        </div>
      )}
    </div>
  );
}
