<script setup lang="ts">
/**
 * One icon button of the toolbar. The tooltip is the name of the action plus
 * its shortcut (design 6.0); a disabled button carries the reason in the
 * tooltip (the three states of 6.0: available, greyed with reason, active).
 */
import { TOOLBAR_ICONS } from "./toolbar-icons.ts";
import classes from "./toolbar.module.css";

const props = defineProps<{
  icon: string;
  title: string;
  testid: string;
  active?: boolean;
  disabled?: boolean;
}>();

const emit = defineEmits<{ click: [] }>();
</script>

<template>
  <button
    type="button"
    :class="[classes.button, props.active && classes.active]"
    :data-testid="props.testid"
    :title="props.title"
    :disabled="props.disabled"
    :aria-pressed="props.active ? 'true' : undefined"
    @click="emit('click')"
  >
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      v-html="TOOLBAR_ICONS[props.icon] ?? ''"
    />
  </button>
</template>
