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
  diagram.addEntity("areas", area);
  ui.selectArea(String(area.id));
}
</script>

<template>
  <NSpace :size="8" align="center" data-testid="toolbar">
    <NButtonGroup>
      <NButton size="small" data-testid="add-table-btn" @click="addTable">
        Table
      </NButton>
      <NButton size="small" data-testid="add-note-btn" @click="addNote">
        Note
      </NButton>
      <NButton size="small" data-testid="add-area-btn" @click="addArea">
        Area
      </NButton>
    </NButtonGroup>

    <NButtonGroup>
      <NButton
        size="small"
        data-testid="zoom-in-btn"
        :disabled="ui.zoom >= 2.5"
        @click="ui.zoomIn()"
      >
        +
      </NButton>
      <NButton
        size="small"
        data-testid="zoom-out-btn"
        :disabled="ui.zoom <= 0.25"
        @click="ui.zoomOut()"
      >
        &minus;
      </NButton>
    </NButtonGroup>

    <NButton
      size="small"
      quaternary
      data-testid="toggle-grid-btn"
      :type="ui.showGrid ? 'primary' : 'default'"
      @click="ui.toggleGrid()"
    >
      Grid
    </NButton>
    <NButton
      size="small"
      quaternary
      data-testid="toggle-sidebar-btn"
      :type="ui.sidebarOpen ? 'primary' : 'default'"
      @click="ui.toggleSidebar()"
    >
      Panel
    </NButton>
  </NSpace>
</template>
