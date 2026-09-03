import countryLanguages, { LanguageObj } from "@ladjs/country-language";
import { getTag } from "@sozialhelden/ietf-language-tags";

// list of iso639_1 Alpha-2 codes used as default languages
const defaultLanguageCodes: string[] = [
  "ar-SA",
  "bg-BG",
  "bn-BD",
  "cs-CZ",
  "ca-AD",
  "da-DK",
  "de-DE",
  "de-CH",
  "el-GR",
  "en-US",
  "es-ES",
  "et-EE",
  "fa-IR",
  "fr-FR",
  "gl-ES",
  "gu-IN",
  "he-IL",
  "id-ID",
  "it-IT",
  "ja-JP",
  "ko-KR",
  "lv-LV",
  "ne-NP",
  "nl-NL",
  "pl-PL",
  "pt-BR",
  "ru-RU",
  "sl-SI",
  "sv-SE",
  "ta-LK",
  "th-TH",
  "tr-TR",
  "vi-VN",
  "zh-CN",
  "nv-US",
];

export interface LocaleInfo {
  name: string;
  nativeName?: string;
  code: string;
  isRtl?: boolean;
}

const extraLanguages: Record<string, LocaleInfo> = {
  pirate: {
    code: "pirate",
    name: "Pirate",
    nativeName: "Pirate Tongue",
  },
  kitty: {
    code: "cat",
    name: "Cat",
    nativeName: "Kitty Speak",
  },
  uwu: {
    code: "uwu",
    name: "Cutsie OwO",
    nativeName: "UwU",
  },
  minion: {
    code: "minion",
    name: "Minion",
    nativeName: "Minionese",
  },
  tok: {
    code: "tok",
    name: "Toki pona",
    nativeName: "Toki pona",
  },
  futhark: {
    code: "futhark",
    name: "Elder Futhark (EN)",
    nativeName: "ᛖᛚᛞᛖᚱ ᚠᚢᚦᚨᚱᚲ",
  },
};

function populateLanguageCode(language: string): string {
  if (language.includes("-")) return language;
  if (language.length !== 2) return language;
  return (
    defaultLanguageCodes.find((v) => v.startsWith(`${language}-`)) ?? language
  );
}

/**
 * Get information for a specific local
 * @param locale local code
 * @returns locale object
 */
export function getLocaleInfo(locale: string): LocaleInfo | null {
  const realLocale = populateLanguageCode(locale);

  document.body.style.wordSpacing = "normal";

  const extraLang = extraLanguages[realLocale];
  if (extraLang) {
    if (extraLang.code === "futhark") {
      document.body.style.wordSpacing = "5px";
    }
    return extraLang;
  }

  const tag = getTag(realLocale, true);
  if (!tag?.language?.Subtag) return null;

  let output: LanguageObj | null = null as any as LanguageObj;
  // this function isnt async, so its garuanteed to work like this
  countryLanguages.getLanguage(tag.language.Subtag, (_err, lang) => {
    if (lang) output = lang;
  });
  if (!output) return null;

  const extras = [];
  if (tag.region?.Description) extras.push(tag.region.Description[0]);
  if (tag.script?.Description) extras.push(tag.script.Description[0]);
  const extraStringified = extras.map((v) => `(${v})`).join(" ");

  return {
    code: tag.parts.langtag ?? realLocale,
    isRtl: output.direction === "RTL",
    name: output.name[0] + (extraStringified ? ` ${extraStringified}` : ""),
    nativeName: output.nativeName[0] ?? undefined,
  };
}
