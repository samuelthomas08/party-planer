"use client";

import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { errorKey } from "@/lib/errors";
import { useAdminPlaces, useAuditPage } from "@/lib/queries";
import { ActivityList } from "../audit/ActivityList";
import { AuditPager } from "../audit/AuditPager";
import { Select } from "../ui/Field";
import { ErrorNote, Spinner } from "../ui/misc";

/** The complete protocol across all places and users; narrow it to one place with the filter. */
export function AuditAdmin() {
  const t = useTranslations();
  const router = useRouter();
  const params = useSearchParams();
  const placeId = params.get("place") ?? undefined;
  const [page, setPage] = useState(0);
  const { data: places = [] } = useAdminPlaces();
  const { data, isPending, error } = useAuditPage({ placeId, admin: true }, page);

  const setPlace = (id: string | undefined) => {
    setPage(0);
    router.replace(id ? `/settings/audit?place=${id}` : "/settings/audit");
  };

  return (
    <div className="max-w-4xl">
      <p className="mb-4 text-ink-soft">{t("audit.adminIntro")}</p>
      <div className="mb-5 max-w-md">
        <Select label={t("audit.filterPlace")} value={placeId ?? ""} onChange={(e) => setPlace(e.target.value || undefined)}>
          <option value="">{t("audit.allPlaces")}</option>
          {places.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.ownerName})
            </option>
          ))}
        </Select>
      </div>
      {isPending ? (
        <Spinner label={t("common.loading")} />
      ) : error ? (
        <ErrorNote>{t(`errors.${errorKey(error)}`)}</ErrorNote>
      ) : (
        <>
          <ActivityList entries={data.items} showIp onPlaceClick={setPlace} />
          <AuditPager page={data.page} totalPages={data.totalPages} onPage={setPage} />
        </>
      )}
    </div>
  );
}
