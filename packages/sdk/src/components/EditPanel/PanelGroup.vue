<script setup lang="ts">
import styles from "./edit-panel.module.css";

/**
 * One collapsible group of the edit panel. The collapse state is owned by
 * the parent (the panel remembers it per object type, plan section 4.4).
 */
const props = defineProps<{
  title: string;
  collapsed: boolean;
  testid?: string;
}>();

const emit = defineEmits<{
  toggle: [];
}>();
</script>

<template>
  <section :class="styles.group" :data-testid="props.testid">
    <button
      type="button"
      :class="styles['group-header']"
      data-testid="group-toggle"
      :aria-expanded="!props.collapsed"
      @click="emit('toggle')"
    >
      <span :class="styles['group-caret']">{{ props.collapsed ? "▸" : "▾" }}</span>
      <span>{{ props.title }}</span>
    </button>
    <div v-if="!props.collapsed" :class="styles['group-body']">
      <slot />
    </div>
  </section>
</template>
