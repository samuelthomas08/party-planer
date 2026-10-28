import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AuthForm } from "@/components/AuthForm";

/** Localised page title. */
export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("auth"))("loginTitle") };
}

/** Route `/login`. */
export default function LoginPage() {
  return <AuthForm mode="login" />;
}
