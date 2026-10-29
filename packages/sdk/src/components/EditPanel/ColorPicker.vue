<script setup lang="ts">
/**
 * The colour of a table: ten presets, a custom well and a way back to the
 * default.
 *
 * The picker only reports what the reader chose; the panel decides what to do
 * with it, so the same picker serves one table and a batch of them. A mixed
 * selection marks nothing as chosen, because nothing is true of every table.
 */
import { computed } from "vue";
import { t } from "../../i18n/index.ts";
import {
  DEFAULT_TABLE_COLOR,
  TABLE_COLOR_PRESETS,
  isPresetColor,
} from "../../utils/color-palette.ts";
import styles from "./edit-panel.module.css";

const props = withDefaults(
  defineProps<{
    /** The colour of the table, or an empty string for "the default". */
    value?: string;
    /** The selection disagrees, so nothing can be marked as chosen. */
    multiple?: boolean;
    disabled?: boolean;
    /** The test id of the group; the parts derive theirs from it. */
    testid?: string;
  }>(),
  { value: "", multiple: false, disabled: false, testid: "table-color" },
);

const emit = defineEmits<{ "update:value": [value: string] }>();

const current = computed(() => (props.value ?? "").toLowerCase());
/** The colour the strip shows right now, which is the default when unset. */
const shown = computed(() => (current.value === "" ? DEFAULT_TABLE_COLOR : current.value));

function choose(value: string): void {
  if (props.disabled) return;
  if (value.toLowerCase() === (props.value ?? "").toLowerCase()) return;
  emit("update:value", value);
}

function onCustom(event: Event): void {
  choose((event.target as HTMLInputElement).value);
}

/** Whether a preset is the colour that is set, and can carry the mark. */
function marked(value: string): boolean {
  return !props.multiple && current.value === value.toLowerCase();
}

const defaultMarked = computed(() => !props.multiple && !isPresetColor(props.value));
</script>

<template>
  <div :class="styles['color-picker']" :data-testid="testid">
    <button
      v-for="preset in TABLE_COLOR_PRESETS"
      :key="preset.token"
      type="button"
      :class="[styles['color-swatch'], marked(preset.value) ? styles['color-swatch--on'] : '']"
      :style="{ background: preset.value }"
      :title="preset.value"
      :aria-label="preset.value"
      :aria-pressed="marked(preset.value) ? 'true' : 'false'"
      :data-testid="`${testid}-preset-${preset.token}`"
      :disabled="disabled"
      @click="choose(preset.value)"
    />
    <label
      :class="[styles['color-custom'], styles['color-swatch']]"
      :style="{ background: shown }"
      :title="t('edit_panel_color_custom')"
    >
      <input
        type="color"
        :class="styles['color-custom-input']"
        :value="shown"
        :disabled="disabled"
        :aria-label="t('edit_panel_color_custom')"
        :data-testid="`${testid}-custom`"
        @change="onCustom"
      />
    </label>
    <button
      type="button"
      :class="[
        styles['color-swatch'],
        styles['color-swatch--default'],
        defaultMarked ? styles['color-swatch--on'] : '',
      ]"
      :title="t('edit_panel_color_default')"
      :aria-label="t('edit_panel_color_default')"
      :aria-pressed="defaultMarked ? 'true' : 'false'"
      :data-testid="`${testid}-clear`"
      :disabled="disabled"
      @click="choose('')"
    />
  </div>
</template>
