<script setup lang="ts">
import { ref } from "vue";
import { importSQL, parseDBML } from "@drawdb/core";
import type { DatabaseType, Diagram } from "@drawdb/core";
import { useDiagramStore } from "../../stores/diagram.ts";

defineOptions({ name: "DrawDBImportDialog" });

/**
 * The dialog that imports a diagram from SQL, DBML or a JSON diagram.
 *
 * The import is prepared before it is applied: the dialog parses the source
 * the user typed, reports the error the parser threw and, when the source is
 * good, asks for the confirmation that replaces the diagram of the editor.
 */
const props = withDefaults(
  defineProps<{
    open?: boolean;
    format?: "sql" | "dbml" | "json";
    database?: DatabaseType;
  }>(),
  { open: false, format: "sql", database: "generic" },
);

const emit = defineEmits<{
  "update:open": [value: boolean];
  imported: [diagram: Diagram];
}>();

const diagram = useDiagramStore();
const source = ref("");
const error = ref("");
const success = ref(false);
const parsed = ref<Diagram | null>(null);

/** Parses the source the user typed and prepares the import. */
function apply(): void {
  error.value = "";
  success.value = false;
  parsed.value = null;
  try {
    if (props.format === "sql") {
      parsed.value = importSQL(source.value, props.database);
    } else if (props.format === "dbml") {
      parsed.value = parseDBML(source.value, { database: props.database });
    } else {
      // The JSON of a diagram is an object the store can adopt as it is.
      parsed.value = JSON.parse(source.value) as Diagram;
    }
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : String(cause);
    parsed.value = null;
  }
}

/** Replaces the diagram of the editor with the one the import produced. */
function confirmImport(): void {
  if (parsed.value === null) {
    return;
  }
  diagram.setImportedDiagram(parsed.value);
  emit("imported", parsed.value);
  success.value = true;
  parsed.value = null;
}

function close(): void {
  emit("update:open", false);
}
</script>

<template>
  <div v-if="props.open" class="ddb-import" data-testid="import-dialog">
    <h2 class="ddb-import__title">Import a diagram</h2>
    <p class="ddb-import__hint">
      <span class="ddb-import__hint-format" data-testid="import-format">{{
        props.format
      }}</span>
      <span class="ddb-import__hint-database" data-testid="import-database">{{
        props.database
      }}</span>
    </p>
    <textarea
      v-model="source"
      class="ddb-import__input"
      data-testid="import-input"
      rows="8"
    ></textarea>
    <p v-if="error" class="ddb-import__error" data-testid="import-error">
      {{ error }}
    </p>
    <p v-if="success" class="ddb-import__success" data-testid="import-success">
      The diagram was imported
    </p>
    <div class="ddb-import__actions">
      <button
        class="ddb-import__apply"
        data-testid="import-apply"
        type="button"
        @click="apply"
      >
        Apply
      </button>
      <button
        v-if="parsed !== null"
        class="ddb-import__confirm"
        data-testid="import-confirm"
        type="button"
        @click="confirmImport"
      >
        Replace the diagram
      </button>
      <button class="ddb-import__close" type="button" @click="close">
        Close
      </button>
    </div>
  </div>
</template>

<style scoped>
.ddb-import {
  background: var(--ddb-surface, #fff);
  border: 1px solid var(--ddb-border, #d9d9d9);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgb(0 0 0 / 15%);
  display: flex;
  flex-direction: column;
  gap: 8px;
  left: 50%;
  max-height: 80vh;
  max-width: 720px;
  padding: 16px;
  position: fixed;
  top: 10vh;
  transform: translateX(-50%);
  width: 90vw;
  z-index: 30;
}
.ddb-import__title {
  font-size: 16px;
  margin: 0;
}
.ddb-import__hint {
  color: var(--ddb-muted, #666);
  display: flex;
  font-size: 12px;
  gap: 8px;
  margin: 0;
}
.ddb-import__hint-format,
.ddb-import__hint-database {
  font-family: var(--ddb-code-font, ui-monospace, monospace);
}
.ddb-import__input {
  border: 1px solid var(--ddb-border, #d9d9d9);
  border-radius: 4px;
  font-family: var(--ddb-code-font, ui-monospace, monospace);
  font-size: 13px;
  padding: 8px;
  resize: vertical;
}
.ddb-import__error {
  color: var(--ddb-danger, #d03050);
  font-size: 13px;
  margin: 0;
}
.ddb-import__success {
  color: var(--ddb-success, #18a058);
  font-size: 13px;
  margin: 0;
}
.ddb-import__actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}
.ddb-import__apply,
.ddb-import__confirm,
.ddb-import__close {
  border: 1px solid var(--ddb-border, #d9d9d9);
  border-radius: 4px;
  cursor: pointer;
  padding: 6px 12px;
}
.ddb-import__confirm {
  background: var(--ddb-primary, #18a058);
  border-color: var(--ddb-primary, #18a058);
  color: #fff;
}
</style>
