<script setup lang="ts">
/**
 * The create group (issue 11): add a table, a note or an area from the
 * toolbar of the canvas instead of the row of the header, so that every
 * action on the diagram lives in one place.
 */
import { useDiagramStore } from "../../stores/diagram.ts";
import { t } from "../../i18n/index.ts";
import { useUIStore } from "../../stores/ui.ts";
import { createArea, createNote, createTable, uniqueTableName } from "../../utils/elements.ts";
import ToolbarButton from "./ToolbarButton.vue";
import classes from "./toolbar.module.css";

const diagram = useDiagramStore();
const ui = useUIStore();

const TABLE_SPACING = 260;

/** New elements land in the free spot of a four column grid. */
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
  <div :class="classes.group" role="group" :aria-label="t('create_group')" data-testid="toolbar-create">
    <!-- The test ids stay those of the header row the group replaced, so the
         hosts and the end-to-end specs keep working. -->
    <ToolbarButton
      icon="add-table"
      :title="t('add_table')"
      testid="add-table-btn"
      @click="addTable"
    />
    <ToolbarButton
      icon="add-note"
      :title="t('add_note')"
      testid="add-note-btn"
      @click="addNote"
    />
    <ToolbarButton
      icon="add-area"
      :title="t('add_area')"
      testid="add-area-btn"
      @click="addArea"
    />
  </div>
</template>
