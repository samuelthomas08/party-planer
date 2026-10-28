/** Supported UI languages. */
export const LOCALES = ["de", "en"] as const;
/** A supported language code. */
export type Locale = (typeof LOCALES)[number];
/** Used when nothing has been chosen yet. */
export const DEFAULT_LOCALE: Locale = "de";
/** Name of the cookie that stores the chosen language. */
export const LOCALE_COOKIE = "NEXT_LOCALE";

/** Type guard for supported language codes. */
export function isLocale(value: string | undefined): value is Locale {
  return !!value && (LOCALES as readonly string[]).includes(value);
}
