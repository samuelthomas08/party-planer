"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { log } from "@/lib/logger";

/** Error boundary for rendering errors; reports them to the server log. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("errors");
  useEffect(() => {
    log.error("RENDER_ERROR", error.message, { digest: error.digest });
  }, [error]);

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-extrabold">{t("INTERNAL_ERROR")}</h1>
      <Button onClick={reset}>{t("retry")}</Button>
    </div>
  );
}
