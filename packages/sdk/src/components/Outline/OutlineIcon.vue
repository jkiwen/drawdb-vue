<script setup lang="ts">
import type { OutlineIconName } from "./outline-icons.ts";

/**
 * One 16×16 glyph of the outline tree (review item 3). Inline paths keep
 * the tree free of an icon dependency and let `currentColor` follow the
 * row's own state.
 */
defineProps<{ name: OutlineIconName }>();

const PATHS: Record<OutlineIconName, string> = {
  table: "M2.5 4h11v8h-11zM2.5 6.6h11M5.6 4v8",
  fields: "M3 5h10M3 8h10M3 11h10",
  primary: "M5.5 8.2 7.2 10l3.3-4",
  unique: "M8 5.2a2.8 2.8 0 1 0 0 5.6 2.8 2.8 0 0 0 0-5.6z",
  foreign: "M6.2 9.8 9.8 6.2M9.4 4h2.6v2.6M6.6 12H4V9.4",
  indexes: "M4 5h8M4 8h6M4 11h8",
  field: "M4.6 4.6v6.8M7.2 6h4.2M7.2 9.4h2.8",
  key: "M4.6 8a2.4 2.4 0 1 1 4.8 0 2.4 2.4 0 0 1-4.8 0zM9.4 8H12",
  relationship: "M4 8h5.4l-1.4-1.4M9.4 8l-1.4 1.4M4 5.2v5.6",
  area: "M3 3h3M10 3h3v3M13 10v3h-3M6 13H3v-3",
  note: "M4 3.5h8v9H4zM6.4 6.4h3.2M6.4 8.8h3.2",
  view: "M2.5 8s2.2-3.4 5.5-3.4S13.5 8 13.5 8s-2.2 3.4-5.5 3.4S2.5 8 2.5 8zM8 6.8a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4z",
  enum: "M4 4.5h8v7H4zM6.2 6.6h3.6M6.2 9.4h2.4",
  type: "M4.5 11.5 8 4.8l3.5 6.7M5.8 9.6h4.4",
};
</script>

<template>
  <svg
    :class="$attrs.class"
    width="14"
    height="14"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    stroke-width="1.2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <path :d="PATHS[name]" />
  </svg>
</template>
