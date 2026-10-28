import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/layout/PageHeader";
import { PlaceForm } from "@/components/places/PlaceForm";

/** Localised page title. */
export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("places"))("newTitle") };
}

/** Route `/places/new` – create a place. */
export default async function NewPlacePage() {
  const t = await getTranslations();
  return (
    <>
      <PageHeader title={t("places.newTitle")} backLabel={t("common.back")} />
      <PlaceForm />
    </>
  );
}
