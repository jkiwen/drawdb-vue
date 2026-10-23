<script setup lang="ts">
import { NButton, NInput, NSelect, NSpace, NTag } from "naive-ui";
import { computed, ref, watch } from "vue";
import { useDiagramStore } from "../../stores/diagram.ts";
import { useSaveStore } from "../../stores/save.ts";
import MenuBar from "./MenuBar.vue";
import Toolbar from "./Toolbar.vue";
import UndoRedoButtons from "./UndoRedoButtons.vue";

/**
 * The header of the editor.
 *
 * It brings the menu bar, the toolbar and the undo/redo buttons together and
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
  emit("save");
  if (save.adapter) {
    void save.save();
  }
}
</script>

<template>
  <header data-testid="header" class="header">
    <div class="header__row">
      <MenuBar @select="emit('menu', $event)" />

      <NInput
        v-model:value="titleDraft"
        class="header__title"
        size="small"
        data-testid="diagram-title-input"
        placeholder="Untitled diagram"
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

    <div class="header__row header__row--tools">
      <Toolbar />

      <NSpace :size="8" align="center">
        <NTag size="small" :type="saveTagType" data-testid="save-state">
          {{ saveLabel }}
        </NTag>
        <NButton size="small" data-testid="save-btn" @click="saveDiagram">
          Save
        </NButton>
        <UndoRedoButtons />
      </NSpace>
    </div>
  </header>
</template>

<style scoped>
.header {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 6px 10px;
  border-bottom: 1px solid var(--n-border-color, #e0e0e6);
}

.header__row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.header__row--tools {
  justify-content: space-between;
}

.header__title {
  max-width: 320px;
}

.header__database {
  width: 190px;
}
</style>
