import type { Metadata, Viewport } from "next";
import { Kumbh_Sans } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { Providers } from "@/components/Providers";
import "./globals.css";

// Same typeface as the original app.
const kumbh = Kumbh_Sans({ subsets: ["latin"], variable: "--font-kumbh", display: "swap" });

/** Localised site metadata. */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return {
    title: { default: "Party Planer", template: "%s · Party Planer" },
    description: t("description"),
    applicationName: "Party Planer",
    appleWebApp: { capable: true, title: "Party Planer", statusBarStyle: "default" },
  };
}

/** Mobile viewport and theme colours (respects notches via `viewport-fit=cover`). */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f1f4fb" },
    { media: "(prefers-color-scheme: dark)", color: "#0d1020" },
  ],
};

// Runs before first paint so a stored theme choice never flashes the wrong colours.
const themeScript = `try{var t=localStorage.getItem("pp-theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

/** Root layout: font, theme bootstrap script (no flash of wrong theme), i18n and data providers. */
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale} className={kumbh.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="antialiased">
        <NextIntlClientProvider>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
