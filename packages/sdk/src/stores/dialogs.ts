import { defineStore } from "pinia";
import { ref } from "vue";

/** The dialogs the editor can open. */
export type EditorDialogName =
  | "sqlPreview"
  | "import"
  | "imageExport"
  | "autoRelationships"
  | "relationship";

/** The formats the import dialog understands. */
export type ImportFormat = "sql" | "dbml" | "json";

/** The formats the SQL preview dialog understands. */
export type SqlPreviewFormat = "sql" | "dbml";

export interface EditorDialogOptions {
  /** The format the dialog should open with. */
  format?: ImportFormat;
}

/**
 * Which of the editor dialogs is open.
 *
 * The dialogs live inside the SDK, so the state has to be shared between the
 * component that renders them and the commands that open them. A store keeps
 * that state in one place instead of threading it through props.
 */
export const useDialogStore = defineStore("dialogs", () => {
  const sqlPreviewOpen = ref(false);
  const sqlPreviewFormat = ref<SqlPreviewFormat>("sql");
  const importOpen = ref(false);
  const importFormat = ref<ImportFormat>("sql");
  const autoRelationshipsOpen = ref(false);
  const imageExportOpen = ref(false);
  const relationshipOpen = ref(false);

  function open(name: EditorDialogName, options?: EditorDialogOptions): void {
    if (name === "import") {
      importFormat.value = options?.format ?? importFormat.value;
      importOpen.value = true;
      return;
    }

    if (name === "sqlPreview") {
      sqlPreviewFormat.value =
        options?.format === "dbml" || options?.format === "sql"
          ? options.format
          : "sql";
      sqlPreviewOpen.value = true;
      return;
    }

    if (name === "imageExport") {
      imageExportOpen.value = true;
      return;
    }

    if (name === "relationship") {
      relationshipOpen.value = true;
      return;
    }

    autoRelationshipsOpen.value = true;
  }

  function close(name: EditorDialogName): void {
    if (name === "import") {
      importOpen.value = false;
      return;
    }

    if (name === "sqlPreview") {
      sqlPreviewOpen.value = false;
      return;
    }

    if (name === "imageExport") {
      imageExportOpen.value = false;
      return;
    }

    if (name === "relationship") {
      relationshipOpen.value = false;
      return;
    }

    autoRelationshipsOpen.value = false;
  }

  function closeAll(): void {
    sqlPreviewOpen.value = false;
    importOpen.value = false;
    autoRelationshipsOpen.value = false;
    imageExportOpen.value = false;
    relationshipOpen.value = false;
  }

  return {
    sqlPreviewOpen,
    sqlPreviewFormat,
    importOpen,
    importFormat,
    autoRelationshipsOpen,
    imageExportOpen,
    relationshipOpen,
    open,
    close,
    closeAll,
  };
});

export type DialogStore = ReturnType<typeof useDialogStore>;
