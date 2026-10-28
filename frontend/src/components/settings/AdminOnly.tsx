"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { useMe } from "@/lib/queries";
import { ErrorNote } from "../ui/misc";

/** Hides admin pages from normal users. The API enforces the same rule; this is only about not showing a broken page. */
export function AdminOnly({ children }: { children: ReactNode }) {
  const t = useTranslations("errors");
  const { data: me } = useMe();
  if (me?.role !== "ADMIN") return <ErrorNote>{t("FORBIDDEN")}</ErrorNote>;
  return <>{children}</>;
}
