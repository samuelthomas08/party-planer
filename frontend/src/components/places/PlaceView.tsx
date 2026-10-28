"use client";

import { History, Pencil, Share2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { useState } from "react";
import { errorKey } from "@/lib/errors";
import { useEquipment, usePlace } from "@/lib/queries";
import { PageHeader } from "../layout/PageHeader";
import { Button, ButtonLink } from "../ui/Button";
import { ErrorNote, Spinner } from "../ui/misc";
import { PlaceViewer } from "./PlaceViewer";
import { ShareSheet } from "./ShareSheet";

/** Owner's view of a place with edit, share and history actions. */
export function PlaceView() {
  const t = useTranslations();
  const { id } = useParams<{ id: string }>();
  const { data: place, isPending, error } = usePlace(id);
  const { data: equipment = [] } = useEquipment();
  const [shareOpen, setShareOpen] = useState(false);

  if (isPending) return <Spinner label={t("common.loading")} />;
  if (error || !place) return <ErrorNote>{t(`errors.${errorKey(error ?? { code: "NOT_FOUND" })}`)}</ErrorNote>;

  return (
    <>
      <PageHeader
        title={place.name}
        backLabel={t("common.back")}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" icon={<Share2 className="size-4" />} onClick={() => setShareOpen(true)}>
              <span className="hidden sm:inline">{t("share.button")}</span>
            </Button>
            <ButtonLink href={`/places/${place.id}/activity`} variant="secondary" size="sm" icon={<History className="size-4" />} aria-label={t("activity.title")}>
              <span className="hidden sm:inline">{t("activity.title")}</span>
            </ButtonLink>
            <ButtonLink href={`/places/${place.id}/edit`} size="sm" icon={<Pencil className="size-4" />}>
              {t("common.edit")}
            </ButtonLink>
          </div>
        }
      />
      <PlaceViewer place={place} equipment={equipment} />
      <ShareSheet placeId={place.id} placeName={place.name} open={shareOpen} onClose={() => setShareOpen(false)} />
    </>
  );
}
