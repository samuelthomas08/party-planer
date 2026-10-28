"use client";

import { useQuery } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { api, setImageBase } from "@/lib/api";
import { errorKey } from "@/lib/errors";
import { log } from "@/lib/logger";
import type { Equipment, Place } from "@/lib/types";
import { Logo } from "../layout/Logo";
import { Badge, Card, Spinner } from "../ui/misc";
import { Button } from "../ui/Button";
import { PlaceViewer } from "./PlaceViewer";

interface GuestPlace {
  guestName: string;
  place: Place;
  equipment: Equipment[];
}

/** What a guest on a share link sees: the place, read-only. */
export function GuestPlaceView() {
  const t = useTranslations();
  const router = useRouter();
  setImageBase("/api/guest/images");
  const { data, isPending, error } = useQuery({
    queryKey: ["guest-place"],
    queryFn: () => api.get<GuestPlace>("/guest/place"),
    retry: false,
  });

  const leave = async () => {
    log.info("GUEST_LEAVE", "guest left");
    try {
      await api.post("/guest/logout");
    } finally {
      router.replace("/login");
    }
  };

  return (
    <>
      <header className="sticky top-0 z-40 -mx-3 mb-5 flex h-16 items-center justify-between border-b border-line bg-canvas/85 px-3 pt-safe backdrop-blur-md sm:-mx-4 sm:px-4 lg:-mx-5 lg:px-5">
        <Logo />
        {data && (
          <div className="flex items-center gap-2">
            <Badge tone="party">{t("audit.guest")}</Badge>
            <span className="hidden max-w-40 truncate text-sm font-semibold sm:block">{data.guestName}</span>
            <Button variant="ghost" size="sm" icon={<LogOut className="size-4" />} onClick={leave}>
              <span className="hidden sm:inline">{t("share.leave")}</span>
            </Button>
          </div>
        )}
      </header>

      {isPending ? (
        <Spinner label={t("common.loading")} />
      ) : error || !data ? (
        <Card className="mx-auto mt-10 max-w-md p-6 text-center">
          <h1 className="text-xl font-extrabold">{t("share.invalidTitle")}</h1>
          <p className="mt-2 text-ink-soft">{error ? t(`errors.${errorKey(error)}`) : t("share.invalidText")}</p>
        </Card>
      ) : (
        <>
          <h1 className="mb-5 text-2xl font-extrabold tracking-tight">{data.place.name}</h1>
          <PlaceViewer place={data.place} equipment={data.equipment} emptyHint={t("share.noMarkersGuest")} />
        </>
      )}
    </>
  );
}
