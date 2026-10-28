/**
 * The view state of a diagram (UI document section 9.2, ruling Q2).
 *
 * The view state is part of the document — it is saved with the diagram and
 * restored on load — but it is not document data: changing it never enters
 * the undo stack. The zoom is deliberately excluded; it is session state
 * that lives in the editor only.
 */

export type ViewLayer = "logical" | "physical";

/** The four display modes plus the manual "custom" combination. */
export type DisplayMode =
  | "entity"
  | "definition"
  | "attributes"
  | "all"
  | "custom";

/**
 * The per-item display switches of a table view (UI document section 6.2,
 * ruling Q20). The toggles are the single source of truth; the display
 * modes are preset combinations of them.
 */
export interface ViewStateToggles {
  description: boolean;
  fields: boolean;
  pkUkFk: boolean;
  indexes: boolean;
}

export interface ViewState {
  /** Which layer the canvas and the outline tree render. */
  viewLayer: ViewLayer;
  /** The active display mode, or "custom" for a manual toggle mix. */
  displayMode: DisplayMode;
  toggles: ViewStateToggles;
}

/** The preset toggle combinations of the four display modes. */
const DISPLAY_MODE_PRESETS: Record<
  Exclude<DisplayMode, "custom">,
  ViewStateToggles
> = {
  entity: { description: false, fields: false, pkUkFk: false, indexes: false },
  definition: {
    description: true,
    fields: false,
    pkUkFk: false,
    indexes: false,
  },
  attributes: {
    description: false,
    fields: true,
    pkUkFk: false,
    indexes: false,
  },
  all: { description: true, fields: true, pkUkFk: true, indexes: true },
};

/** The toggles of a display mode preset. */
export function togglesForDisplayMode(
  mode: Exclude<DisplayMode, "custom">,
): ViewStateToggles {
  return { ...DISPLAY_MODE_PRESETS[mode] };
}

/** The mode a toggle combination matches, or "custom" when none matches. */
export function displayModeForToggles(toggles: ViewStateToggles): DisplayMode {
  for (const mode of Object.keys(DISPLAY_MODE_PRESETS) as Exclude<
    DisplayMode,
    "custom"
  >[]) {
    const preset = DISPLAY_MODE_PRESETS[mode];
    if (
      preset.description === toggles.description &&
      preset.fields === toggles.fields &&
      preset.pkUkFk === toggles.pkUkFk &&
      preset.indexes === toggles.indexes
    ) {
      return mode;
    }
  }
  return "custom";
}

/** The view state of a fresh diagram and of legacy documents. */
export function createDefaultViewState(): ViewState {
  return {
    viewLayer: "physical",
    displayMode: "attributes",
    toggles: togglesForDisplayMode("attributes"),
  };
}

const VIEW_LAYERS: readonly ViewLayer[] = ["logical", "physical"];
const DISPLAY_MODES: readonly DisplayMode[] = [
  "entity",
  "definition",
  "attributes",
  "all",
  "custom",
];

/**
 * Reads a view state from an untrusted (deserialized) value. Known fields
 * are validated and unknown or invalid fields fall back to the defaults, so
 * a partial or corrupt view state never breaks the import.
 */
export function normalizeViewState(value: unknown): ViewState {
  const defaults = createDefaultViewState();
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return defaults;
  }
  const record = value as Record<string, unknown>;
  const toggles =
    record.toggles && typeof record.toggles === "object"
      ? (record.toggles as Record<string, unknown>)
      : {};
  return {
    viewLayer: VIEW_LAYERS.includes(record.viewLayer as ViewLayer)
      ? (record.viewLayer as ViewLayer)
      : defaults.viewLayer,
    displayMode: DISPLAY_MODES.includes(record.displayMode as DisplayMode)
      ? (record.displayMode as DisplayMode)
      : defaults.displayMode,
    toggles: {
      description:
        typeof toggles.description === "boolean"
          ? toggles.description
          : defaults.toggles.description,
      fields:
        typeof toggles.fields === "boolean"
          ? toggles.fields
          : defaults.toggles.fields,
      pkUkFk:
        typeof toggles.pkUkFk === "boolean"
          ? toggles.pkUkFk
          : defaults.toggles.pkUkFk,
      indexes:
        typeof toggles.indexes === "boolean"
          ? toggles.indexes
          : defaults.toggles.indexes,
    },
  };
}
