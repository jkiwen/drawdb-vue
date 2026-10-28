<script setup lang="ts">
import { NButton, NInput, NSelect, NSpace, NTag } from "naive-ui";
import { computed, ref, watch } from "vue";
import { useDiagramStore } from "../../stores/diagram.ts";
import { useSaveStore } from "../../stores/save.ts";
import MenuBar from "./MenuBar.vue";

/**
 * The header of the editor.
 *
 * It brings the menu bar, the title, the database and the save state together
 * shows the properties of the diagram that belong to the whole document: its
 * title, the database it is written for and the state of the last save.
 */
const diagram = useDiagramStore();
const save = useSaveStore();

const emit = defineEmits<{
  (event: "save"): void;
  (event: "menu", key: string): void;
}>();

const DATABASE_OPTIONS = [
  { label: "MySQL", value: "mysql" },
  { label: "PostgreSQL", value: "postgres" },
  { label: "SQLite", value: "sqlite" },
  { label: "MariaDB", value: "mariadb" },
  { label: "Microsoft SQL Server", value: "mssql" },
  { label: "Oracle SQL", value: "oraclesql" },
  { label: "Generic", value: "generic" },
];

const titleDraft = ref(diagram.diagram.title ?? "");

watch(
  () => diagram.diagram.title,
  (value) => {
    titleDraft.value = value ?? "";
  },
);

const database = computed(() => diagram.diagram.database);

const saveLabel = computed(() => {
  switch (save.state) {
    case "saving":
      return "Saving";
    case "saved":
      return "Saved";
    case "error":
      return "Save failed";
    default:
      return save.dirty ? "Unsaved changes" : "No changes";
  }
});

const saveTagType = computed(() => {
  switch (save.state) {
    case "saving":
      return "info" as const;
    case "saved":
      return "success" as const;
    case "error":
      return "error" as const;
    default:
      return "default" as const;
  }
});

function commitTitle(): void {
  if (titleDraft.value !== (diagram.diagram.title ?? "")) {
    diagram.updateDiagram({ title: titleDraft.value });
  }
}

function changeDatabase(value: string): void {
  diagram.updateDiagram({ database: value as typeof diagram.diagram.database });
}

function saveDiagram(): void {
  // The editor owns the saving. The header only reports the wish, so that the
  // diagram is written once and not twice.
  emit("save");
}
</script>

<template>
  <header data-testid="header" class="header">
    <div class="header__row header__row--primary">
      <MenuBar @select="emit('menu', $event)" />

      <div class="header__identity">
        <NInput
          v-model:value="titleDraft"
          class="header__title"
          size="small"
          data-testid="diagram-title-input"
          placeholder="Untitled diagram"
          aria-label="Diagram title"
          @blur="commitTitle"
          @keyup.enter="commitTitle"
        />

        <NSelect
          class="header__database"
          size="small"
          data-testid="database-select"
          :value="database"
          :options="DATABASE_OPTIONS"
          @update:value="changeDatabase"
        />
      </div>

      <NSpace :size="8" align="center" class="header__actions">
        <NTag
          size="small"
          :type="saveTagType"
          :bordered="false"
          class="header__save-state"
          data-testid="save-state"
        >
          <span class="header__save-dot" aria-hidden="true" />
          {{ saveLabel }}
        </NTag>
        <NButton
          size="small"
          type="primary"
          class="header__save"
          data-testid="save-btn"
          @click="saveDiagram"
        >
          Save
        </NButton>
      </NSpace>
    </div>
  </header>
</template>

<style scoped>
.header {
  display: flex;
  flex-direction: column;
  gap: var(--ddb-space-2);
  padding: var(--ddb-space-2) var(--ddb-space-3);
  background: var(--ddb-surface);
  border-bottom: 1px solid var(--ddb-border);
  position: relative;
  z-index: var(--ddb-z-header);
}

.header__row {
  display: flex;
  align-items: center;
  gap: var(--ddb-space-3);
  min-width: 0;
}

.header__row--primary {
  flex-wrap: nowrap;
}

.header__row--tools {
  justify-content: space-between;
}

/* The title and the database belong together: they describe the document the
   canvas is showing, not the tools. */
.header__identity {
  display: flex;
  align-items: center;
  gap: var(--ddb-space-2);
  min-width: 0;
  margin-left: auto;
  flex-wrap: nowrap;
}

.header__title {
  max-width: 320px;
  min-width: 140px;
}

.header__database {
  width: 190px;
  flex: none;
}

.header__actions {
  flex: none;
}

/* The save state carries a dot next to the label, so that the state is never
   communicated by the colour alone. */
.header__save-state {
  display: inline-flex;
  align-items: center;
  gap: var(--ddb-space-1);
}

.header__save-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
  flex: none;
}

.header__save {
  font-weight: 500;
}
</style>
