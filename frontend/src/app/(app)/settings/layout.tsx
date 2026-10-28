import { getTranslations } from "next-intl/server";
import { SettingsNav } from "@/components/settings/SettingsNav";

/** Settings shell: section navigation next to the page content. */
export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("settings");
  return (
    <div>
      <h1 className="mb-4 text-2xl font-extrabold tracking-tight">{t("title")}</h1>
      <div className="grid gap-5 lg:grid-cols-[14rem_1fr] lg:gap-8">
        <SettingsNav />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
