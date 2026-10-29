<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { Area } from "@drawdb/core";
import { t } from "../../i18n/index.ts";
import { useDiagramStore } from "../../stores/diagram.ts";
import styles from "./edit-panel.module.css";
import { commitAreaName } from "./edit-actions.ts";
import { MIN_AREA_HEIGHT, MIN_AREA_WIDTH } from "../Canvas/interactions/use-resize.ts";

/**
 * The editor of a single selected subject area.
 *
 * An area is a rectangle with a name, a description, a fill and a set of
 * gestures on the canvas, so the panel offers all of them: a reader should not
 * have to resize a rectangle by hand to change a number (bug report of
 * 2026-10-29).
 */
const props = defineProps<{
  area: Area;
}>();

const store = useDiagramStore();

const name = ref(props.area.name);
const description = ref(props.area.description ?? "");
const color = ref(props.area.color ?? "#f4f4f5");
const opacity = ref(String(props.area.opacity ?? 0.08));
const width = ref(String(props.area.width));
const height = ref(String(props.area.height));
const locked = ref(props.area.locked === true);

watch(
  () => props.area,
  (area) => {
    name.value = area.name;
    description.value = area.description ?? "";
    color.value = area.color ?? "#f4f4f5";
    opacity.value = String(area.opacity ?? 0.08);
    width.value = String(area.width);
    height.value = String(area.height);
    locked.value = area.locked === true;
  },
);

const id = computed(() => String(props.area.id));

function commitName(): void {
  const next = name.value.trim();
  if (next === "" || next === props.area.name) {
    name.value = props.area.name;
    return;
  }
  commitAreaName(store, id.value, next);
}

function commitDescription(): void {
  const next = description.value.trim();
  if (next === (props.area.description ?? "")) return;
  store.updateArea(id.value, { description: next === "" ? undefined : next });
}

function commitColor(): void {
  const next = color.value;
  if (next === (props.area.color ?? "")) return;
  store.updateArea(id.value, { color: next });
}

function commitOpacity(): void {
  const parsed = Number(opacity.value);
  const next = Number.isFinite(parsed) ? Math.min(1, Math.max(0, parsed)) : 0.08;
  opacity.value = String(next);
  if (next === (props.area.opacity ?? 0.08)) return;
  store.updateArea(id.value, { opacity: next });
}

function commitSize(axis: "width" | "height"): void {
  const source = axis === "width" ? width : height;
  const floor = axis === "width" ? MIN_AREA_WIDTH : MIN_AREA_HEIGHT;
  const parsed = Number(source.value);
  const current = props.area[axis];
  const next = Number.isFinite(parsed) ? Math.max(floor, Math.round(parsed)) : current;
  source.value = String(next);
  if (next === current) return;
  store.updateArea(id.value, axis === "width" ? { width: next } : { height: next });
}

function commitLocked(): void {
  const next = locked.value;
  if (next === (props.area.locked === true)) return;
  store.updateArea(id.value, { locked: next });
}
</script>

<template>
  <div :class="styles['pair-grid']" data-testid="area-editor">
    <label>
      <span :class="styles.label">{{ t("edit_panel_area_name") }}</span>
      <input
        v-model="name"
        :class="styles.input"
        data-testid="area-name"
        @change="commitName"
        @blur="commitName"
      />
    </label>
    <label>
      <span :class="styles.label">{{ t("edit_panel_appearance_color") }}</span>
      <input
        v-model="color"
        type="color"
        :class="[styles.input, styles['color-input']]"
        data-testid="area-color"
        @change="commitColor"
        @blur="commitColor"
      />
    </label>
    <label>
      <span :class="styles.label">{{ t("edit_panel_area_opacity") }}</span>
      <input
        v-model="opacity"
        type="number"
        min="0"
        max="1"
        step="0.05"
        :class="styles.input"
        data-testid="area-opacity"
        @change="commitOpacity"
        @blur="commitOpacity"
      />
    </label>
    <label>
      <span :class="styles.label">{{ t("edit_panel_area_width") }}</span>
      <input
        v-model="width"
        type="number"
        :min="MIN_AREA_WIDTH"
        :class="styles.input"
        data-testid="area-width"
        @change="commitSize('width')"
        @blur="commitSize('width')"
      />
    </label>
    <label>
      <span :class="styles.label">{{ t("edit_panel_area_height") }}</span>
      <input
        v-model="height"
        type="number"
        :min="MIN_AREA_HEIGHT"
        :class="styles.input"
        data-testid="area-height"
        @change="commitSize('height')"
        @blur="commitSize('height')"
      />
    </label>
    <label :class="styles['field-inline']">
      <input
        v-model="locked"
        type="checkbox"
        data-testid="area-locked"
        @change="commitLocked"
      />
      <span :class="styles.label">{{ t("edit_panel_appearance_locked") }}</span>
    </label>
    <label style="grid-column: 1 / -1">
      <span :class="styles.label">{{ t("edit_panel_description") }}</span>
      <textarea
        v-model="description"
        :class="styles.input"
        rows="3"
        maxlength="500"
        data-testid="area-description"
        @change="commitDescription"
        @blur="commitDescription"
      />
    </label>
  </div>
</template>
