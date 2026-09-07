export interface AppPreferenceSection<T = unknown> {
  label?: string;
  defaults: T;
  /** Only for stores that already keep their own per-account profiles. */
  localFallback?(): T;
  getSnapshot(): T;
  apply(value: T): void;
  subscribe(listener: () => void): () => void;
  validate(value: unknown): T;
}
const sections = new Map<string, AppPreferenceSection>();
const listeners = new Set<() => void>();
export function registerAppPreferenceSection<T>(
  name: string,
  section: AppPreferenceSection<T>,
) {
  if (!/^[a-z][a-zA-Z0-9-]{0,39}$/.test(name))
    throw new Error("Invalid settings section name.");
  sections.set(name, section as AppPreferenceSection);
  listeners.forEach((listener) => listener());
  return () => {
    if (sections.get(name) === section) {
      sections.delete(name);
      listeners.forEach((listener) => listener());
    }
  };
}
export function getAppPreferenceSections() {
  return sections;
}
export function subscribePreferenceRegistry(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function snapshotAppPreferences(names = [...sections.keys()]) {
  return Object.fromEntries(
    names
      .filter((name) => sections.has(name))
      .map((name) => {
        const section = sections.get(name)!;
        return [name, section.validate(section.getSnapshot())];
      }),
  );
}
export function validateImportedPreferences(value: unknown, names: string[]) {
  const input = value as {
    format?: unknown;
    version?: unknown;
    sections?: Record<string, unknown>;
  } | null;
  if (
    !input ||
    input.format !== "movie-fin-settings" ||
    input.version !== 1 ||
    !input.sections ||
    typeof input.sections !== "object" ||
    Array.isArray(input.sections)
  )
    throw new Error("Choose a Movie-Fin settings export.");
  const output: Record<string, unknown> = {};
  for (const name of names) {
    const section = sections.get(name);
    if (!section || !Object.hasOwn(input.sections, name)) continue;
    output[name] = section.validate(input.sections[name]);
  }
  if (!Object.keys(output).length)
    throw new Error(
      "Select at least one supported settings group from this file.",
    );
  return output;
}
export function importAppPreferences(value: unknown, names: string[]) {
  const checked = validateImportedPreferences(value, names);
  // Validate every selected group before applying any of them.
  Object.entries(checked).forEach(([name, entry]) =>
    sections.get(name)!.apply(entry),
  );
}
export function exportAppPreferences(names: string[]) {
  return JSON.stringify(
    {
      format: "movie-fin-settings",
      version: 1,
      sections: snapshotAppPreferences(names),
    },
    null,
    2,
  );
}
