"use client";

import { MutationCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { ApiError } from "@/lib/api";
import { installGlobalLogging, log } from "@/lib/logger";
import { ToastProvider } from "./ui/Toast";

/** Client-side providers: React Query (with mutation error logging), toasts and global error logging. */
export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        mutationCache: new MutationCache({
          onError: (error) =>
            log.warn("MUTATION_FAILED", error instanceof ApiError ? `${error.status} ${error.code}` : String(error)),
        }),
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 2,
          },
        },
      }),
  );
  useEffect(() => installGlobalLogging(), []);
  return (
    <QueryClientProvider client={client}>
      <ToastProvider>{children}</ToastProvider>
    </QueryClientProvider>
  );
}
