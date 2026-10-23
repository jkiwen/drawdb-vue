/**
 * Migrates the locales of drawDB into the format of Vue I18n.
 *
 * The React application keeps its translations in JavaScript modules that use
 * the shape of i18next (`{ translation: { ... } }`). Vue I18n expects the
 * messages of a locale directly, so the script writes one JSON file per
 * locale and the list of the languages.
 *
 * The script reads the locales of the React application, which lives next to
 * the workspace. The directory can be given with `--source <directory>`.
 *
 * Usage: node --experimental-strip-types scripts/migrate-i18n.ts
 */
import { mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const TARGET = path.join(ROOT, "packages", "sdk", "src", "i18n");
const LOCALES = path.join(TARGET, "locales");

/**
 * The codes of the locales that differ from the code of drawDB.
 *
 * The Chinese of the application is the simplified one, the browser sends
 * "zh-CN".
 */
const CODE_OVERRIDES: Record<string, string> = {
  zh: "zh-CN",
};

/**
 * The keys the SDK needs and drawDB does not have.
 *
 * The two locales of the plan, English and Simplified Chinese, are written by
 * hand; the other locales fall back to English for these keys.
 */
const EXTRA_KEYS: Record<string, Record<string, string>> = {
  en: {
    table: "Table",
    field: "Field",
    fields: "Fields",
    relationship: "Relationship",
    area: "Area",
    areas: "Areas",
  },
  "zh-CN": {
    table: "表",
    field: "字段",
    fields: "字段",
    relationship: "关系",
    area: "区域",
    areas: "区域",
  },
};

interface SourceLocale {
  code: string;
  name: string;
  nativeName: string;
  messages: Record<string, string>;
}

/** Reads the source directory of the argument, or the React application. */
function sourceDirectory(): string {
  const index = process.argv.indexOf("--source");
  if (index >= 0 && process.argv[index + 1]) {
    return path.resolve(process.argv[index + 1]);
  }
  return path.resolve(ROOT, "..", "src", "i18n", "locales");
}

/** Loads a locale of the React application. */
async function loadLocale(file: string): Promise<SourceLocale | null> {
  const module = await import(pathToFileURL(file).href);
  const entries = Object.entries(module as Record<string, unknown>);

  const messages = entries.find(
    (entry): entry is [string, { translation: Record<string, string> }] =>
      typeof entry[1] === "object" &&
      entry[1] !== null &&
      "translation" in entry[1],
  );
  if (!messages) {
    return null;
  }

  const descriptor = entries.find(
    (entry): entry is [string, { code: string; name: string; native_name: string }] =>
      typeof entry[1] === "object" &&
      entry[1] !== null &&
      "code" in entry[1] &&
      !("translation" in entry[1]),
  );
  if (!descriptor) {
    return null;
  }

  const code = CODE_OVERRIDES[descriptor[1].code] ?? descriptor[1].code;
  return {
    code,
    name: descriptor[1].name,
    nativeName: descriptor[1].native_name,
    messages: messages[1].translation,
  };
}

/** Writes the JSON file of a locale. */
async function writeLocale(locale: SourceLocale, english: Record<string, string>) {
  const messages: Record<string, string> = { ...english };

  // The translations of the application win over the English ones.
  for (const [key, value] of Object.entries(locale.messages)) {
    messages[key] = value;
  }

  // The keys the SDK needs win over everything else.
  for (const [key, value] of Object.entries(EXTRA_KEYS[locale.code] ?? {})) {
    messages[key] = value;
  }

  const sorted: Record<string, string> = {};
  for (const key of Object.keys(messages).sort()) {
    sorted[key] = messages[key];
  }

  await writeFile(
    path.join(LOCALES, `${locale.code}.json`),
    `${JSON.stringify(sorted, null, 2)}\n`,
    "utf8",
  );
}

/** Writes the list of the languages. */
async function writeLanguages(locales: SourceLocale[]) {
  const languages = locales
    .map((locale) => ({
      code: locale.code,
      name: locale.name,
      nativeName: locale.nativeName,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const body = `/**
 * The languages of the application.
 *
 * The file is written by \`scripts/migrate-i18n.ts\`.
 */
export interface Language {
  code: string;
  name: string;
  nativeName: string;
}

export const LANGUAGES: Language[] = ${JSON.stringify(languages, null, 2)};
`;
  await writeFile(path.join(TARGET, "languages.ts"), body, "utf8");
}

async function main() {
  const source = sourceDirectory();
  const files = (await readdir(source)).filter((file) => file.endsWith(".js")).sort();

  const locales: SourceLocale[] = [];
  for (const file of files) {
    const locale = await loadLocale(path.join(source, file));
    if (locale) {
      locales.push(locale);
    }
  }

  const english = locales.find((locale) => locale.code === "en");
  if (!english) {
    throw new Error(`the locale "en" is missing in ${source}`);
  }

  await mkdir(LOCALES, { recursive: true });
  // Every locale starts from the English messages, so that a key that a
  // translation does not have is still translated.
  const base = { ...english.messages, ...(EXTRA_KEYS["en"] ?? {}) };
  for (const locale of locales) {
    await writeLocale(locale, base);
  }
  await writeLanguages(locales);

  console.log(
    `migrated ${locales.length} locales into ${path.relative(ROOT, LOCALES)}`,
  );
}

await main();
