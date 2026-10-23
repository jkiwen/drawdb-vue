import {
  createI18n as createVueI18n,
  type Composer,
} from "vue-i18n";
import type { App } from "vue";
import { LANGUAGES, type Language } from "./languages.ts";

export { LANGUAGES };
export type { Language };

/**
 * The instance of Vue I18n the SDK creates.
 *
 * The type of Vue I18n is a union of the legacy mode and the mode of the
 * composition API; the SDK always uses the composition API, so the type of
 * the composer is known here.
 */
export interface SdkI18n {
  /** The composer that holds the translations. */
  global: Composer;
  /** Installs the instance into an application. */
  install(app: App, ...options: unknown[]): void;
}

import locale_ar from "./locales/ar.json" with { type: "json" };
import locale_as from "./locales/as.json" with { type: "json" };
import locale_bg from "./locales/bg.json" with { type: "json" };
import locale_bn from "./locales/bn.json" with { type: "json" };
import locale_cz from "./locales/cz.json" with { type: "json" };
import locale_da from "./locales/da.json" with { type: "json" };
import locale_de from "./locales/de.json" with { type: "json" };
import locale_el from "./locales/el.json" with { type: "json" };
import locale_en from "./locales/en.json" with { type: "json" };
import locale_es from "./locales/es.json" with { type: "json" };
import locale_fa from "./locales/fa.json" with { type: "json" };
import locale_fi from "./locales/fi.json" with { type: "json" };
import locale_fr from "./locales/fr.json" with { type: "json" };
import locale_gu from "./locales/gu.json" with { type: "json" };
import locale_he from "./locales/he.json" with { type: "json" };
import locale_hi from "./locales/hi.json" with { type: "json" };
import locale_hu from "./locales/hu.json" with { type: "json" };
import locale_hy from "./locales/hy.json" with { type: "json" };
import locale_id from "./locales/id.json" with { type: "json" };
import locale_it from "./locales/it.json" with { type: "json" };
import locale_jp from "./locales/jp.json" with { type: "json" };
import locale_ka from "./locales/ka.json" with { type: "json" };
import locale_ko from "./locales/ko.json" with { type: "json" };
import locale_ml from "./locales/ml.json" with { type: "json" };
import locale_mn from "./locales/mn.json" with { type: "json" };
import locale_mr from "./locales/mr.json" with { type: "json" };
import locale_ms from "./locales/ms.json" with { type: "json" };
import locale_ne from "./locales/ne.json" with { type: "json" };
import locale_nl from "./locales/nl.json" with { type: "json" };
import locale_no from "./locales/no.json" with { type: "json" };
import locale_od from "./locales/od.json" with { type: "json" };
import locale_pa_PK from "./locales/pa-PK.json" with { type: "json" };
import locale_pa from "./locales/pa.json" with { type: "json" };
import locale_pl from "./locales/pl.json" with { type: "json" };
import locale_pt_BR from "./locales/pt-BR.json" with { type: "json" };
import locale_ro from "./locales/ro.json" with { type: "json" };
import locale_ru from "./locales/ru.json" with { type: "json" };
import locale_sd from "./locales/sd.json" with { type: "json" };
import locale_sv from "./locales/sv.json" with { type: "json" };
import locale_sw from "./locales/sw.json" with { type: "json" };
import locale_te from "./locales/te.json" with { type: "json" };
import locale_th from "./locales/th.json" with { type: "json" };
import locale_tl from "./locales/tl.json" with { type: "json" };
import locale_tm from "./locales/tm.json" with { type: "json" };
import locale_tr from "./locales/tr.json" with { type: "json" };
import locale_ug from "./locales/ug.json" with { type: "json" };
import locale_uk from "./locales/uk.json" with { type: "json" };
import locale_ur from "./locales/ur.json" with { type: "json" };
import locale_vi from "./locales/vi.json" with { type: "json" };
import locale_zh_CN from "./locales/zh-CN.json" with { type: "json" };
import locale_zh_TW from "./locales/zh-TW.json" with { type: "json" };

/** The messages of every locale. */
export const localeMessages: Record<string, Record<string, string>> = {
  "ar": locale_ar,
  "as": locale_as,
  "bg": locale_bg,
  "bn": locale_bn,
  "cz": locale_cz,
  "da": locale_da,
  "de": locale_de,
  "el": locale_el,
  "en": locale_en,
  "es": locale_es,
  "fa": locale_fa,
  "fi": locale_fi,
  "fr": locale_fr,
  "gu": locale_gu,
  "he": locale_he,
  "hi": locale_hi,
  "hu": locale_hu,
  "hy": locale_hy,
  "id": locale_id,
  "it": locale_it,
  "jp": locale_jp,
  "ka": locale_ka,
  "ko": locale_ko,
  "ml": locale_ml,
  "mn": locale_mn,
  "mr": locale_mr,
  "ms": locale_ms,
  "ne": locale_ne,
  "nl": locale_nl,
  "no": locale_no,
  "od": locale_od,
  "pa-PK": locale_pa_PK,
  "pa": locale_pa,
  "pl": locale_pl,
  "pt-BR": locale_pt_BR,
  "ro": locale_ro,
  "ru": locale_ru,
  "sd": locale_sd,
  "sv": locale_sv,
  "sw": locale_sw,
  "te": locale_te,
  "th": locale_th,
  "tl": locale_tl,
  "tm": locale_tm,
  "tr": locale_tr,
  "ug": locale_ug,
  "uk": locale_uk,
  "ur": locale_ur,
  "vi": locale_vi,
  "zh-CN": locale_zh_CN,
  "zh-TW": locale_zh_TW,
};

/**
 * The locales the browser sends, and the locale of the SDK that fits them.
 *
 * The React application calls the simplified Chinese "zh", the browsers send
 * "zh-CN" and "zh-Hans"; the Japanese of the application is called "jp".
 */
const ALIASES: Record<string, string> = {
  zh: "zh-CN",
  "zh-Hans": "zh-CN",
  "zh-hans": "zh-CN",
  "zh-Hant": "zh-TW",
  "zh-hant": "zh-TW",
  "zh-HK": "zh-TW",
  pt: "pt-BR",
  ja: "jp",
  in: "id",
  iw: "he",
};

/**
 * Finds the locale of the SDK that fits a locale of the browser.
 *
 * An unknown locale falls back to English.
 */
export function resolveLocale(locale: string | undefined | null): string {
  if (!locale) {
    return "en";
  }
  if (locale in localeMessages) {
    return locale;
  }

  const alias = ALIASES[locale];
  if (alias && alias in localeMessages) {
    return alias;
  }

  const lower = locale.toLowerCase();
  const exact = availableLocales.find((code) => code.toLowerCase() === lower);
  if (exact) {
    return exact;
  }

  const region = lower.split(/[-_]/)[0];
  const base = availableLocales.find(
    (code) => code.toLowerCase().split(/[-_]/)[0] === region,
  );
  return base ?? "en";
}

/**
 * Creates an instance of Vue I18n with the messages of the SDK.
 *
 * A host application that uses its own translations can install the instance
 * and add its own messages; the SDK only needs the messages of its own keys.
 */
export async function createI18n(locale: string = "en"): Promise<SdkI18n> {
  return createVueI18n({
    legacy: false,
    locale: resolveLocale(locale),
    fallbackLocale: "en",
    messages: localeMessages,
  }) as unknown as SdkI18n;
}

/** The codes of the locales of the SDK. */
export const availableLocales: string[] = Object.keys(localeMessages);

/**
 * The instance the SDK uses for its own labels.
 *
 * A host application does not have to install Vue I18n to use the SDK.
 */
const shared = createVueI18n({
  legacy: false,
  locale: "en",
  fallbackLocale: "en",
  messages: localeMessages,
}) as unknown as SdkI18n;

/** Sets the locale of the shared instance. */
export function setLocale(locale: string): void {
  shared.global.locale.value = resolveLocale(locale);
}

/** The locale of the shared instance. */
export function getLocale(): string {
  return shared.global.locale.value;
}

/** Translates a key with the shared instance. */
export function t(key: string, params?: Record<string, unknown>): string {
  return shared.global.t(key, params ?? {}) as string;
}
