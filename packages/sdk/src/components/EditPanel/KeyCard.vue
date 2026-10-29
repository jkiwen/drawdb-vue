<script setup lang="ts">
import { ref } from "vue";
import styles from "./edit-panel.module.css";

/**
 * One card of the constraints and indexes groups (review of 2026-10-29,
 * item 1): a summary line that stays readable when the card is closed, and
 * a body of labelled controls when it is open. The field cards use the same
 * shape, so a reader learns one pattern and meets it everywhere.
 */
const props = defineProps<{
  testid: string;
  badge: string;
  title: string;
  summary?: string;
  /** Opens the card closed; Vue reads an absent boolean prop as false, so the flag is inverted. */
  collapsed?: boolean;
  /** A testid for the title, for the callers whose tests read the name. */
  titleTestid?: string;
}>();

const isOpen = ref(props.collapsed !== true);
</script>

<template>
  <section :class="styles['key-card']" :data-testid="props.testid" :data-open="isOpen ? 'true' : undefined">
    <header :class="styles['key-card-head']">
      <button
        type="button"
        :class="[styles['link-button'], styles['link-button--muted'], styles['key-card-caret']]"
        :aria-expanded="isOpen ? 'true' : 'false'"
        :data-testid="`${props.testid}-toggle`"
        @click="isOpen = !isOpen"
      >{{ isOpen ? "▾" : "▸" }}</button>
      <span :class="[styles.badge, styles['badge-info']]">{{ props.badge }}</span>
      <span :class="styles['key-card-title']" :data-testid="props.titleTestid">{{ props.title }}</span>
      <span v-if="props.summary" :class="styles['key-card-summary']">{{ props.summary }}</span>
      <slot name="actions" />
    </header>
    <div v-if="isOpen" :class="styles['key-card-body']">
      <slot />
    </div>
  </section>
</template>
