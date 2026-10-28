import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AuthForm } from "@/components/AuthForm";

/** Localised page title. */
export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("auth"))("registerTitle") };
}

/** Route `/register`. */
export default function RegisterPage() {
  return <AuthForm mode="register" />;
}
