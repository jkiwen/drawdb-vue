<script setup lang="ts">
import { computed, ref } from "vue";
import { exportDBML, exportSQL } from "@drawdb/core";
import { useDiagramStore } from "../../stores/diagram.ts";

defineOptions({ name: "DrawDBSqlPreviewDialog" });

/**
 * The dialog that previews the SQL or the DBML of the diagram.
 *
 * The dialog is a window over the current diagram: it renders the SQL or the
 * DBML the editor would export and lets the host copy it to the clipboard.
 */
const props = withDefaults(
  defineProps<{
    open?: boolean;
    title?: string;
  }>(),
  { open: false, title: "" },
);

const emit = defineEmits<{
  "update:open": [value: boolean];
}>();

const diagram = useDiagramStore();
const format = ref<"sql" | "dbml">("sql");
const copied = ref(false);

const content = computed(() =>
  format.value === "sql"
    ? exportSQL(diagram.diagram)
    : exportDBML(diagram.diagram),
);

function switchFormat(next: "sql" | "dbml"): void {
  format.value = next;
}

async function copy(): Promise<void> {
  await navigator.clipboard.writeText(content.value);
  copied.value = true;
}

function close(): void {
  emit("update:open", false);
}
</script>

<template>
  <div
    v-if="props.open"
    class="ddb-sql-preview"
    data-testid="sql-preview-dialog"
  >
    <h2 class="ddb-sql-preview__title">{{ title || "SQL preview" }}</h2>
    <div class="ddb-sql-preview__formats">
      <button
        class="ddb-sql-preview__format"
        data-testid="sql-preview-format-sql"
        type="button"
        @click="switchFormat('sql')"
      >
        SQL
      </button>
      <button
        class="ddb-sql-preview__format"
        data-testid="sql-preview-format-dbml"
        type="button"
        @click="switchFormat('dbml')"
      >
        DBML
      </button>
    </div>
    <pre class="ddb-sql-preview__content" data-testid="sql-preview-content">{{
      content
    }}</pre>
    <p v-if="copied" class="ddb-sql-preview__copied" data-testid="sql-preview-copied">
      Copied to the clipboard
    </p>
    <div class="ddb-sql-preview__actions">
      <button
        class="ddb-sql-preview__copy"
        data-testid="sql-preview-copy"
        type="button"
        @click="copy"
      >
        Copy
      </button>
      <button class="ddb-sql-preview__close" type="button" @click="close">
        Close
      </button>
    </div>
  </div>
</template>

<style scoped>
.ddb-sql-preview {
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
.ddb-sql-preview__title {
  font-size: 16px;
  margin: 0;
}
.ddb-sql-preview__formats {
  display: flex;
  gap: 8px;
}
.ddb-sql-preview__content {
  background: var(--ddb-code-bg, #f6f8fa);
  border-radius: 4px;
  flex: 1;
  font-size: 13px;
  margin: 0;
  overflow: auto;
  padding: 12px;
  white-space: pre-wrap;
  word-break: break-word;
}
.ddb-sql-preview__actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}
.ddb-sql-preview__copy,
.ddb-sql-preview__close,
.ddb-sql-preview__format {
  border: 1px solid var(--ddb-border, #d9d9d9);
  border-radius: 4px;
  cursor: pointer;
  padding: 6px 12px;
}
.ddb-sql-preview__copied {
  color: var(--ddb-success, #18a058);
  font-size: 13px;
  margin: 0;
}
</style>
