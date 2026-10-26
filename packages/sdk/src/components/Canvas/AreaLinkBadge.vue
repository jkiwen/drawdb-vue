<script setup lang="ts">
import { ref } from "vue";
import type { PropType } from "vue";

// The ghost lines are siblings of the badge, so the node is a fragment and
// the attributes are bound to the badge by hand.
defineOptions({ name: "DrawDBAreaLinkBadge", inheritAttrs: false });

const props = defineProps({
  /** The number of relationships the collapsed area still takes part in. */
  count: { type: Number, required: true },
  /**
   * The lines from the title bar to the tables outside of the collapsed
   * area, in the coordinates of the area.
   */
  lines: {
    type: Array as PropType<Array<{ x1: number; y1: number; x2: number; y2: number }>>,
    required: true,
  },
});

/** Whether the hover on the badge draws the lines to the linked tables. */
const linksVisible = ref(false);
</script>

<template>
  <!--
    A relationship to a table the collapsed area holds is hidden with the
    area. The badge counts those relationships, and the hover on the badge
    draws each of them as a dashed line, so that the user can see what the
    collapsed area is still connected to.
  -->
  <g
    class="ddb-area__link-badge"
    transform="translate(4 -12)"
    v-bind="$attrs"
    @pointerdown.stop
    @pointerenter="linksVisible = true"
    @pointerleave="linksVisible = false"
  >
    <rect class="ddb-area__link-badge-box" width="34" height="14" rx="7" />
    <text class="ddb-area__link-badge-text" x="17" y="10.5">
      ⇄ {{ props.count }}
    </text>
  </g>
  <template v-if="linksVisible">
    <line
      v-for="(line, index) in props.lines"
      :key="index"
      class="ddb-area__link-ghost"
      :x1="line.x1"
      :y1="line.y1"
      :x2="line.x2"
      :y2="line.y2"
    />
  </template>
</template>
