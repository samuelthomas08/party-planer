import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/layout/PageHeader";
import { EquipmentForm } from "@/components/equipment/EquipmentForm";

/** Localised page title. */
export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("equipment"))("newTitle") };
}

/** Route `/equipment/new` – create equipment. */
export default async function NewEquipmentPage() {
  const t = await getTranslations();
  return (
    <>
      <PageHeader title={t("equipment.newTitle")} backLabel={t("common.back")} />
      <EquipmentForm />
    </>
  );
}
