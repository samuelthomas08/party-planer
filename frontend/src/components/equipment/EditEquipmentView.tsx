"use client";

import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { useEquipment } from "@/lib/queries";
import { PageHeader } from "../layout/PageHeader";
import { ErrorNote, Spinner } from "../ui/misc";
import { EquipmentForm } from "./EquipmentForm";

/** Loads one item and renders the equipment form for it. */
export function EditEquipmentView() {
  const t = useTranslations();
  const { id } = useParams<{ id: string }>();
  const { data, isPending } = useEquipment();
  const item = data?.find((e) => e.id === id);

  return (
    <>
      <PageHeader title={t("equipment.editTitle")} backLabel={t("common.back")} />
      {isPending ? (
        <Spinner label={t("common.loading")} />
      ) : item ? (
        <EquipmentForm key={item.id} initial={item} />
      ) : (
        <ErrorNote>{t("errors.NOT_FOUND")}</ErrorNote>
      )}
    </>
  );
}
