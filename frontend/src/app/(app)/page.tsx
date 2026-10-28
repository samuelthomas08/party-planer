import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Dashboard } from "@/components/dashboard/Dashboard";

/** Localised page title. */
export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("dashboard"))("title") };
}

/** Route `/` – the dashboard with places and equipment. */
export default function HomePage() {
  return <Dashboard />;
}
