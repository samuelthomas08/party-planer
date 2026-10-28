"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "../ui/Button";

/** Newer / older paging for history lists. */
export function AuditPager({ page, totalPages, onPage }: { page: number; totalPages: number; onPage: (p: number) => void }) {
  const t = useTranslations("audit");
  if (totalPages <= 1) return null;
  return (
    <div className="mt-4 flex items-center justify-between gap-3">
      <Button variant="secondary" size="sm" disabled={page === 0} onClick={() => onPage(page - 1)} icon={<ChevronLeft className="size-4" />}>
        {t("newer")}
      </Button>
      <span className="text-sm text-ink-faint">{t("pageOf", { page: page + 1, total: totalPages })}</span>
      <Button variant="secondary" size="sm" disabled={page + 1 >= totalPages} onClick={() => onPage(page + 1)}>
        {t("older")}
        <ChevronRight className="size-4" />
      </Button>
    </div>
  );
}
