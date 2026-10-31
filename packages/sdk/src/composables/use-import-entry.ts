import type { ImportFormat } from "@drawdb/core";
import { formatOfFileName } from "../components/Import/import-wizard-model.ts";
import type { useImportWizardStore } from "../stores/import-wizard.ts";

/**
 * The two entries that open the import wizard without the menu (P8 task 8).
 *
 * The design asks for four entries into one wizard (menu, toolbar, drop, host
 * API). The menu lives in `DrawDBEditor.vue`; the drop and the host API are
 * here, so that the component stays a component.
 *
 * The host hook `onImport` is consulted first: a page that owns its import
 * flow returns `true` and the wizard never opens.
 */
export function useImportEntry(options: {
  wizard: ReturnType<typeof useImportWizardStore>;
  /** The host hook: `true` means the host took the entry over. */
  onImport?: (format: ImportFormat) => boolean;
}): {
  openImport: (format: ImportFormat, seed?: { text?: string; fileName?: string }) => void;
  onDrop: (event: DragEvent) => Promise<void>;
} {
  function openImport(
    format: ImportFormat,
    seed?: { text?: string; fileName?: string },
  ): void {
    options.wizard.begin(format, undefined, seed);
    // The text is already there, so the read happens right away: a dropped
    // file lands on the report, not on an empty box.
    if (seed?.text !== undefined) options.wizard.advance();
  }

  async function onDrop(event: DragEvent): Promise<void> {
    const file = event.dataTransfer?.files?.[0];
    if (file === undefined) return;
    const format = formatOfFileName(file.name);
    if (format === undefined) return;
    if (options.onImport?.(format) === true) return;
    const text = await file.text();
    openImport(format, { text, fileName: file.name });
  }

  return { openImport, onDrop };
}
