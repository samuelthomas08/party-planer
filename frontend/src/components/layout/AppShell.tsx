"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import type { ReactNode } from "react";
import { ApiError, AUTH_EXPIRED_EVENT, setImageBase } from "@/lib/api";
import { log } from "@/lib/logger";
import { useMe } from "@/lib/queries";
import { Spinner } from "../ui/misc";
import { Logo } from "./Logo";
import { UserMenu } from "./UserMenu";

/** Redirects to /login unless the session is valid, then renders the app chrome. */
export function AppShell({ children }: { children: ReactNode }) {
  const t = useTranslations();
  const router = useRouter();
  const qc = useQueryClient();
  const { data: user, error } = useMe();
  setImageBase("/api/images");

  useEffect(() => {
    const expired = () => {
      log.warn("SESSION_REDIRECT_LOGIN", "session expired, redirecting to login");
      qc.clear();
      router.replace("/login");
    };
    window.addEventListener(AUTH_EXPIRED_EVENT, expired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, expired);
  }, [qc, router]);

  useEffect(() => {
    if (error instanceof ApiError && error.status === 401) router.replace("/login");
  }, [error, router]);

  if (!user) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Spinner label={t("common.loading")} />
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-line bg-canvas/85 pt-safe backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-[1800px] items-center justify-between px-3 sm:px-4 lg:px-5">
          <Link href="/" aria-label="Party Planer">
            <Logo />
          </Link>
          <UserMenu user={user} />
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1800px] flex-1 px-3 pb-32 pt-5 sm:px-4 sm:pb-16 lg:px-5">{children}</main>

      <footer className="mx-auto hidden w-full max-w-[1800px] px-5 pb-8 text-sm text-ink-faint sm:block">
        &copy; Samuel Thomas
      </footer>
    </div>
  );
}
