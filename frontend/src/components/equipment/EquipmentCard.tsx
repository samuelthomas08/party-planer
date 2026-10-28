"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import type { Equipment } from "@/lib/types";
import { IconButton, IconLink } from "../ui/Button";
import { Badge, Card } from "../ui/misc";
import { EquipmentVisual } from "./EquipmentVisual";

/** Dashboard card for one piece of equipment. */
export function EquipmentCard({ item, onDelete }: { item: Equipment; onDelete: (item: Equipment) => void }) {
  const t = useTranslations("equipment");
  return (
    <Card className="flex flex-col overflow-hidden">
      <Link
        href={`/equipment/${item.id}/edit`}
        className="flex h-44 items-center justify-center bg-gradient-to-b from-sunken/60 to-sunken p-4 sm:h-48"
        aria-label={t("editNamed", { name: item.title })}
      >
        <EquipmentVisual equipment={item} className={item.category === "STAND" ? "h-full w-auto" : "h-full"} />
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-3 pb-2">
        <div className="min-w-0">
          <h3 className="truncate font-bold" title={item.title}>
            {item.title}
          </h3>
          <Badge tone={item.category === "STAND" ? "brand" : "party"}>{t(`category.${item.category}`)}</Badge>
        </div>
        <div className="-mx-1 mt-auto flex justify-end">
          <IconLink href={`/equipment/${item.id}/edit`} label={t("editNamed", { name: item.title })} tone="brand">
            <Pencil className="size-5" />
          </IconLink>
          <IconButton label={t("deleteNamed", { name: item.title })} tone="danger" onClick={() => onDelete(item)}>
            <Trash2 className="size-5" />
          </IconButton>
        </div>
      </div>
    </Card>
  );
}
