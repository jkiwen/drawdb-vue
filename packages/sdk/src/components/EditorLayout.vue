<script setup lang="ts">
import { computed } from "vue";
import type { PropType } from "vue";
import type { Component } from "vue";
import type { CustomType, DatabaseType } from "@drawdb/core";
import Canvas from "./Canvas/Canvas.vue";
import EditPanel from "./EditPanel/EditPanel.vue";
import EditorDialogs from "./EditorDialogs.vue";
import Header from "./Header/Header.vue";
import OutlineTree from "./Outline/OutlineTree.vue";
import ResizablePanel from "./Layout/ResizablePanel.vue";
import BottomPanel from "./BottomPanel/BottomPanel.vue";
import Toolbar from "./Toolbar/Toolbar.vue";
import { useOutlineIntegration } from "../composables/use-outline-integration.ts";
import { useDialogStore } from "../stores/dialogs.ts";
import type { DrawDBSettings } from "../stores/settings.ts";
import {
  PANEL_LEFT_DEFAULT_WIDTH,
  PANEL_LEFT_MAX_WIDTH,
  PANEL_LEFT_MIN_WIDTH,
  PANEL_RIGHT_DEFAULT_WIDTH,
  PANEL_RIGHT_MAX_WIDTH,
  PANEL_RIGHT_MIN_WIDTH,
  readPersistedSettings,
  useSettingsStore,
} from "../stores/settings.ts";

defineOptions({ name: "DrawDBEditorLayout" });

defineProps({
  /** The components the plugins contributed. */
  pluginSlots: {
    type: Object as PropType<Record<string, Component>>,
    default: () => ({}),
  },
  /** Whether the side panel is shown. */
  showSidePanel: { type: Boolean, default: true },
  /** The custom types of the properties of the editor. */
  customTypes: { type: Array as PropType<CustomType[]>, default: () => [] },
  /** The database the diagram is written for. The import dialog needs it. */
  database: { type: String as PropType<DatabaseType>, default: "generic" },
});

const emit = defineEmits(["save", "menu"]);

/**
 * The state of the dialogs of the editor.
 *
 * The store keeps the dialogs of every editor of the page in one place, so
 * that the menu of the header can open them without the help of the host
 * application.
 */
const dialogs = useDialogStore();

/**
 * The preferences of the layout.
 *
 * The widths and the collapsed states of the panels live in the settings of
 * the user, so they survive a reload and follow the user across diagrams
 * (the user global scope of the design discussion, Q5).
 */
const settings = useSettingsStore();

// The outline-to-canvas wiring lives in a composable so this file stays
// under the 300 line budget.
const { focusOutlineNode, assignTableToArea } = useOutlineIntegration();

/** Whether the viewport is too narrow for two expanded panels. */
function isSmallViewport(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(max-width: 1023px)").matches
  );
}

// A narrow viewport starts with collapsed panels, but only while the user
// has not picked a state yet: a persisted preference always wins.
if (isSmallViewport()) {
  const persisted = readPersistedSettings();
  const initial: Partial<DrawDBSettings> = {};
  if (persisted.panelLeftCollapsed === undefined) {
    initial.panelLeftCollapsed = true;
  }
  if (persisted.panelRightCollapsed === undefined) {
    initial.panelRightCollapsed = true;
  }
  if (Object.keys(initial).length > 0) {
    settings.update(initial);
  }
}

const panelLeftWidth = computed<number>({
  get: () => settings.settings.panelLeftWidth ?? PANEL_LEFT_DEFAULT_WIDTH,
  set: (width) => settings.update({ panelLeftWidth: width }),
});

const panelRightWidth = computed<number>({
  get: () => settings.settings.panelRightWidth ?? PANEL_RIGHT_DEFAULT_WIDTH,
  set: (width) => settings.update({ panelRightWidth: width }),
});

const panelLeftCollapsed = computed<boolean>({
  get: () => settings.settings.panelLeftCollapsed ?? false,
  set: (collapsed) => settings.update({ panelLeftCollapsed: collapsed }),
});

const panelRightCollapsed = computed<boolean>({
  get: () => settings.settings.panelRightCollapsed ?? false,
  set: (collapsed) => settings.update({ panelRightCollapsed: collapsed }),
});

/** Opens one of the dialogs of the editor. */
function openDialog(
  name: Parameters<typeof dialogs.open>[0],
  options?: Parameters<typeof dialogs.open>[1],
): void {
  dialogs.open(name, options);
}

/** Closes one of the dialogs of the editor. */
function closeDialog(name: Parameters<typeof dialogs.close>[0]): void {
  dialogs.close(name);
}

defineExpose({ openDialog, closeDialog });
</script>

<template>
  <div class="ddb-editor__layout">
    <Header @save="emit('save')" @menu="emit('menu', $event)" />
    <div class="ddb-editor__body">
      <ResizablePanel
        v-if="showSidePanel"
        v-model:width="panelLeftWidth"
        v-model:collapsed="panelLeftCollapsed"
        side="left"
        :min-width="PANEL_LEFT_MIN_WIDTH"
        :max-width="PANEL_LEFT_MAX_WIDTH"
        :default-width="PANEL_LEFT_DEFAULT_WIDTH"
      >
        <OutlineTree
          @focus="focusOutlineNode"
          @assign-to-area="assignTableToArea"
        />
      </ResizablePanel>
      <div class="ddb-editor__canvas">
        <Toolbar class="ddb-editor__toolbar" @menu="emit('menu', $event)" />
        <Canvas />
        <component
          v-for="(slot, name) in pluginSlots"
          :key="name"
          :is="slot"
          class="ddb-editor__plugin-slot"
        />
      </div>
      <ResizablePanel
        v-model:width="panelRightWidth"
        v-model:collapsed="panelRightCollapsed"
        side="right"
        :min-width="PANEL_RIGHT_MIN_WIDTH"
        :max-width="PANEL_RIGHT_MAX_WIDTH"
        :default-width="PANEL_RIGHT_DEFAULT_WIDTH"
      >
        <div class="ddb-editor__edit-panel" data-testid="edit-panel">
          <EditPanel />
        </div>
      </ResizablePanel>
    </div>
    <BottomPanel />
    <EditorDialogs
      v-model:sql-preview-open="dialogs.sqlPreviewOpen"
      v-model:sql-preview-format="dialogs.sqlPreviewFormat"
      v-model:import-open="dialogs.importOpen"
      v-model:import-format="dialogs.importFormat"
      v-model:auto-relationships-open="dialogs.autoRelationshipsOpen"
      v-model:image-export-open="dialogs.imageExportOpen"
      v-model:relationship-open="dialogs.relationshipOpen"
      :database="database"
    />
  </div>
</template>

<style scoped>
.ddb-editor__layout {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.ddb-editor__body {
  display: flex;
  flex: 1 1 auto;
  min-height: 0;
}

.ddb-editor__canvas {
  position: relative;
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
}

/* The toolbar floats over the top of the canvas (design 6.0); the canvas
   keeps its full height so its geometry does not shift. */
.ddb-editor__toolbar {
  position: absolute;
  top: var(--ddb-space-2, 8px);
  left: var(--ddb-space-2, 8px);
  z-index: 10;
}

.ddb-editor__plugin-slot {
  position: absolute;
  top: 0;
  right: 0;
}

.ddb-editor__edit-panel {
  height: 100%;
  min-height: 0;
}
</style>
