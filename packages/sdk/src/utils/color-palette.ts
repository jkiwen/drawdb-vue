/**
 * The colours a table can wear on top of its header.
 *
 * Ten hues that sit next to the chrome of the editor: the neutral slate, the
 * steel of the accent, and the semantic neighbours of the status colours. They
 * are fixed values and not the tokens of the theme, because the strip outlives
 * the theme: a diagram keeps its colours when the host switches to dark.
 */

export interface ColorPreset {
  /** A stable name, used for the test ids and the tooltips. */
  token: string;
  /** The colour, as six digit hex so the canvas can paint it. */
  value: string;
}

export const TABLE_COLOR_PRESETS: readonly ColorPreset[] = [
  { token: "slate", value: "#64748b" },
  { token: "steel", value: "#175e7a" },
  { token: "sky", value: "#0ea5e9" },
  { token: "teal", value: "#0d9488" },
  { token: "green", value: "#16a34a" },
  { token: "lime", value: "#65a30d" },
  { token: "amber", value: "#d97706" },
  { token: "orange", value: "#ea580c" },
  { token: "rose", value: "#e11d48" },
  { token: "violet", value: "#7c3aed" },
];

/**
 * The colour of the strip of a table that was never given one.
 *
 * A table without a colour still shows a quiet band above its name, so the
 * header reads the same way on every table and the reader can see where the
 * colour would go.
 */
export const DEFAULT_TABLE_COLOR = "#cbd5e1";

/** The colour of a preset, or `undefined` for a name that is not one. */
export function presetColor(token: string): string | undefined {
  return TABLE_COLOR_PRESETS.find((preset) => preset.token === token)?.value;
}

/** Whether a colour is one of the presets, whatever the case of the hex. */
export function isPresetColor(value: string | undefined): boolean {
  if (!value) return false;
  const normal = value.toLowerCase();
  return TABLE_COLOR_PRESETS.some((preset) => preset.value === normal);
}
