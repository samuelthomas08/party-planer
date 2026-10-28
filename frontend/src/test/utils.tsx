import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactElement } from "react";
import de from "@/messages/de.json";
import en from "@/messages/en.json";
import { ToastProvider } from "@/components/ui/Toast";

const catalogs = { de, en } as const;

/** Renders with translations, React Query (no retries) and toasts, like the real app. */
export function renderApp(ui: ReactElement, { locale = "de", client }: { locale?: keyof typeof catalogs; client?: QueryClient } = {}) {
  const queryClient = client ?? new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const result = render(
    <NextIntlClientProvider locale={locale} messages={catalogs[locale]} timeZone="UTC">
      <QueryClientProvider client={queryClient}>
        <ToastProvider>{ui}</ToastProvider>
      </QueryClientProvider>
    </NextIntlClientProvider>,
  );
  return { ...result, queryClient };
}

export const messages = catalogs;
