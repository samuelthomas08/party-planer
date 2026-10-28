"use client";

import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { useState } from "react";
import { errorKey } from "@/lib/errors";
import { useAuditPage, useMe } from "@/lib/queries";
import { ActivityList } from "../audit/ActivityList";
import { AuditPager } from "../audit/AuditPager";
import { PageHeader } from "../layout/PageHeader";
import { ErrorNote, Spinner } from "../ui/misc";

/** Change history of one place, for its owner and for admins. */
export function PlaceActivityView() {
  const t = useTranslations();
  const { id } = useParams<{ id: string }>();
  const { data: me } = useMe();
  const [page, setPage] = useState(0);
  const isAdmin = me?.role === "ADMIN";
  const { data, isPending, error } = useAuditPage({ placeId: id, admin: false }, page);

  return (
    <>
      <PageHeader title={t("activity.title")} backHref={`/places/${id}`} backLabel={t("common.back")} />
      <p className="-mt-3 mb-5 max-w-2xl text-ink-soft">{t("activity.intro")}</p>
      {isPending ? (
        <Spinner label={t("common.loading")} />
      ) : error ? (
        <ErrorNote>{t(`errors.${errorKey(error)}`)}</ErrorNote>
      ) : (
        <div className="max-w-4xl">
          <ActivityList entries={data.items} showIp={isAdmin} />
          <AuditPager page={data.page} totalPages={data.totalPages} onPage={setPage} />
        </div>
      )}
    </>
  );
}
