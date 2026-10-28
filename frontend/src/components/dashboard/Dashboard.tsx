"use client";

import clsx from "clsx";
import { MapPin, Package, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import { Segmented } from "../ui/misc";
import { EquipmentSection } from "./EquipmentSection";
import { PlacesSection } from "./PlacesSection";

type Tab = "places" | "equipment";

/**
 * Phones: one section at a time behind a segmented control, with a floating "new" button in thumb reach.
 * Large screens (lg+): both sections side by side.
 */
export function Dashboard() {
  const t = useTranslations("dashboard");
  const [tab, setTab] = useState<Tab>("places");

  return (
    <div>
      <h1 className="sr-only">{t("title")}</h1>

      <div className="mb-5 lg:hidden">
        <Segmented<Tab>
          label={t("title")}
          value={tab}
          onChange={setTab}
          options={[
            { value: "places", label: t("places"), icon: <MapPin className="size-4" /> },
            { value: "equipment", label: t("equipment"), icon: <Package className="size-4" /> },
          ]}
        />
      </div>

      <div className="grid gap-10 lg:grid-cols-2 lg:gap-12">
        <div className={clsx(tab !== "places" && "hidden", "lg:block")}>
          <PlacesSection />
        </div>
        <div className={clsx(tab !== "equipment" && "hidden", "lg:block")}>
          <EquipmentSection />
        </div>
      </div>

      <Link
        href={tab === "places" ? "/places/new" : "/equipment/new"}
        aria-label={tab === "places" ? t("newPlace") : t("newEquipment")}
        className="fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-4 z-30 flex h-14 items-center gap-2 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 px-5 font-bold text-white shadow-pop transition-transform active:scale-95 lg:hidden"
      >
        <Plus className="size-5" />
        {tab === "places" ? t("newPlace") : t("newEquipment")}
      </Link>
    </div>
  );
}
