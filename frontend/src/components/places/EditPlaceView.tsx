"use client";

import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { errorKey } from "@/lib/errors";
import { usePlace } from "@/lib/queries";
import { PageHeader } from "../layout/PageHeader";
import { ErrorNote, Spinner } from "../ui/misc";
import { PlaceForm } from "./PlaceForm";

/** Loads one place and renders the place form for it. */
export function EditPlaceView() {
  const t = useTranslations();
  const { id } = useParams<{ id: string }>();
  const { data: place, isPending, error } = usePlace(id);

  return (
    <>
      <PageHeader title={t("places.editTitle")} backHref={`/places/${id}`} backLabel={t("common.back")} />
      {isPending ? (
        <Spinner label={t("common.loading")} />
      ) : place ? (
        <PlaceForm key={place.id} initial={place} />
      ) : (
        <ErrorNote>{t(`errors.${errorKey(error)}`)}</ErrorNote>
      )}
    </>
  );
}
