<script setup lang="ts">
import { NButton, NButtonGroup, NSpace } from "naive-ui";
import { useDiagramStore } from "../../stores/diagram.ts";
import { useUIStore } from "../../stores/ui.ts";
import { createArea, createNote, createTable, uniqueTableName } from "../../utils/elements.ts";

/**
 * The toolbar of the editor.
 *
 * It creates the elements of the diagram and controls what the canvas shows.
 * Every change goes through the stores, so that it can be undone.
 */
const diagram = useDiagramStore();
const ui = useUIStore();

const TABLE_SPACING = 260;

function nextPosition(index: number): { x: number; y: number } {
  const columns = 4;
  return {
    x: 100 + (index % columns) * TABLE_SPACING,
    y: 100 + Math.floor(index / columns) * TABLE_SPACING,
  };
}

function addTable(): void {
  const table = createTable(
    uniqueTableName(diagram.tables),
    nextPosition(diagram.tables.length),
  );
  diagram.addTable(table);
  ui.selectTable(String(table.id));
}

function addNote(): void {
  const note = createNote(nextPosition(diagram.notes.length));
  diagram.addEntity("notes", note);
  ui.selectNote(String(note.id));
}

function addArea(): void {
  const area = createArea(
    uniqueTableName(diagram.areas, "area"),
    nextPosition(diagram.areas.length),
  );
  diagram.addArea(area);
  ui.selectArea(String(area.id));
}
</script>

<template>
  <NSpace :size="8" align="center" data-testid="toolbar">
    <!-- Group 1: create elements of the diagram. -->
    <NButtonGroup class="toolbar__group">
      <NButton size="small" data-testid="add-table-btn" aria-label="Add table" @click="addTable">
        Table
      </NButton>
      <NButton size="small" data-testid="add-note-btn" aria-label="Add note" @click="addNote">
        Note
      </NButton>
      <NButton size="small" data-testid="add-area-btn" aria-label="Add area" @click="addArea">
        Area
      </NButton>
    </NButtonGroup>

    <span class="toolbar__divider" aria-hidden="true" />

    <!-- Group 2: the viewport. -->
    <span class="toolbar__label" aria-hidden="true">Zoom</span>
    <NButtonGroup class="toolbar__group">
      <NButton
        size="small"
        class="toolbar__zoom"
        data-testid="zoom-in-btn"
        :disabled="ui.zoom >= 2.5"
        aria-label="Zoom in"
        @click="ui.zoomIn()"
      >
        +
      </NButton>
      <NButton
        size="small"
        class="toolbar__zoom"
        data-testid="zoom-out-btn"
        :disabled="ui.zoom <= 0.25"
        aria-label="Zoom out"
        @click="ui.zoomOut()"
      >
        &minus;
      </NButton>
    </NButtonGroup>

    <span class="toolbar__divider" aria-hidden="true" />

    <!-- Group 3: what the canvas shows. The pressed state is carried by the
         filled pill, so the toggle does not rely on the colour alone. -->
    <NButton
      size="small"
      quaternary
      class="toolbar__toggle"
      data-testid="toggle-grid-btn"
      :type="ui.showGrid ? 'primary' : 'default'"
      :aria-pressed="ui.showGrid"
      @click="ui.toggleGrid()"
    >
      Grid
    </NButton>
    <NButton
      size="small"
      quaternary
      class="toolbar__toggle"
      data-testid="toggle-sidebar-btn"
      :type="ui.sidebarOpen ? 'primary' : 'default'"
      :aria-pressed="ui.sidebarOpen"
      @click="ui.toggleSidebar()"
    >
      Panel
    </NButton>
  </NSpace>
</template>

<style scoped>
.toolbar__group :deep(.n-button) {
  font-size: var(--ddb-text-body);
}

/* The name of a group of actions. It tells the reader what the buttons next
   to it do, so that the symbols do not have to carry the meaning alone. */
.toolbar__label {
  font-size: var(--ddb-text-micro);
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--ddb-text-muted);
  flex: none;
}

/* The zoom buttons are square, so that the pair reads as one control. */
.toolbar__zoom {
  min-width: var(--ddb-hit-target);
  font-variant-numeric: tabular-nums;
}

/* A one pixel rule between the groups of the toolbar, so that the user can
   see where one group of actions ends and the next one begins. */
.toolbar__divider {
  width: 1px;
  height: 16px;
  background: var(--ddb-border);
  flex: none;
}

.toolbar__toggle {
  font-size: var(--ddb-text-body);
  font-weight: 500;
  border-radius: var(--ddb-radius-md);
  transition:
    background-color var(--ddb-duration-fast) var(--ddb-easing),
    color var(--ddb-duration-fast) var(--ddb-easing);
}
</style>
