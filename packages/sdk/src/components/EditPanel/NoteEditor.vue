<script setup lang="ts">
/**
 * The editor of a note (issue 12): a note can be written on the canvas, but
 * its colour, its size and its lock were only reachable from the model. The
 * group shows the three and keeps the text on the canvas, where it is typed.
 */
import { computed } from "vue";
import type { PropType } from "vue";
import type { Note } from "@drawdb/core";
import { t } from "../../i18n/index.ts";
import { useDiagramStore } from "../../stores/diagram.ts";
import { DEFAULT_NOTE_HEIGHT, DEFAULT_NOTE_WIDTH } from "../Canvas/geometry.ts";
import styles from "./edit-panel.module.css";

const props = defineProps({
  note: { type: Object as PropType<Note>, required: true },
});

const diagram = useDiagramStore();

/** The default of the note body, so an empty field falls back to it. */
const DEFAULT_COLOR = "#fef3c7";

const color = computed(() => props.note.color ?? DEFAULT_COLOR);
const locked = computed(() => props.note.locked === true);
const width = computed(() => props.note.width ?? DEFAULT_NOTE_WIDTH);
const height = computed(() => props.note.height ?? DEFAULT_NOTE_HEIGHT);

function commitColor(event: Event): void {
  const value = (event.target as HTMLInputElement).value;
  diagram.updateNote(props.note.id, { color: value });
}

function toggleLock(): void {
  diagram.updateNote(props.note.id, { locked: !locked.value });
}

/** Writes one of the two sizes when the field holds a positive number. */
function commitSize(axis: "width" | "height", event: Event): void {
  const value = Number.parseInt((event.target as HTMLInputElement).value, 10);
  if (!Number.isFinite(value) || value <= 0) {
    return;
  }
  diagram.updateNote(props.note.id, { [axis]: value });
}
</script>

<template>
  <div :class="styles.group" data-testid="note-editor">
    <p :class="styles.overview">{{ t("edit_panel_empty_note") }}</p>

    <div :class="styles.row">
      <label :class="styles.label" for="note-color">{{ t("edit_panel_appearance_color") }}</label>
      <input
        id="note-color"
        type="color"
        :class="styles.input"
        :value="color"
        data-testid="note-color"
        @change="commitColor"
      />
    </div>

    <div :class="styles.row">
      <span :class="styles.label">{{ t("size") }}</span>
      <div :class="styles['pair-grid']">
        <input
          :class="styles.input"
          type="number"
          min="40"
          placeholder="W"
          :aria-label="`${t('size')} W`"
          :value="width"
          data-testid="note-width"
          @change="(event) => commitSize('width', event)"
        />
        <input
          :class="styles.input"
          type="number"
          min="40"
          placeholder="H"
          :aria-label="`${t('size')} H`"
          :value="height"
          data-testid="note-height"
          @change="(event) => commitSize('height', event)"
        />
      </div>
    </div>

    <div :class="styles.row">
      <label :class="styles.check" for="note-locked">
        <input
          id="note-locked"
          type="checkbox"
          :checked="locked"
          data-testid="note-locked"
          @change="toggleLock"
        />
        {{ t("edit_panel_appearance_locked") }}
      </label>
    </div>
  </div>
</template>
