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
import {
  NEW_AREA_SIZE,
  NEW_NOTE_SIZE,
  NEW_TABLE_SIZE,
  cascadeShift,
  centreOfViewport,
  placeAt,
  type PlacementPoint,
  type PlacementSize,
} from "../../utils/placement.ts";
import { measureViewport } from "../../composables/canvas-viewport.ts";
import ToolbarButton from "./ToolbarButton.vue";
import classes from "./toolbar.module.css";

const diagram = useDiagramStore();
const ui = useUIStore();

/**
 * Where a new element lands: the middle of the visible canvas (review of
 * 2026-10-29), shifted by a step for each element of that kind that is
 * already there, so two of them never sit exactly on top of each other.
 */
function nextPlacement(size: PlacementSize, taken: number): PlacementPoint {
  const centre = centreOfViewport({
    scrollX: ui.scrollX,
    scrollY: ui.scrollY,
    zoom: ui.zoom,
    viewport: measureViewport(),
  });
  return placeAt(centre, size, cascadeShift(taken));
}

function addTable(): void {
  const position = nextPlacement(NEW_TABLE_SIZE, diagram.tables.length);
  const table = createTable(uniqueTableName(diagram.tables), position);
  diagram.addTable(table);
  ui.selectTable(String(table.id));
  ui.centerOn(table.x + NEW_TABLE_SIZE.width / 2, table.y + NEW_TABLE_SIZE.height / 2);
}

function addNote(): void {
  const position = nextPlacement(NEW_NOTE_SIZE, diagram.notes.length);
  const note = createNote(position);
  diagram.addEntity("notes", note);
  ui.selectNote(String(note.id));
  ui.centerOn(note.x + NEW_NOTE_SIZE.width / 2, note.y + NEW_NOTE_SIZE.height / 2);
}

function addArea(): void {
  const position = nextPlacement(NEW_AREA_SIZE, diagram.areas.length);
  const area = createArea(uniqueTableName(diagram.areas, "area"), position);
  diagram.addArea(area);
  ui.selectArea(String(area.id));
  ui.centerOn(area.x + NEW_AREA_SIZE.width / 2, area.y + NEW_AREA_SIZE.height / 2);
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
