<script setup lang="ts">
import { ref, watch } from "vue";
import type { OutlineRow } from "./outline-model.ts";
import classes from "./outline-tree.module.css";

/**
 * One row of the outline tree: the expansion caret, the label (or the
 * inline rename input) and the count badge of a category. The row is a
 * pure presentation component; the tree owns every action.
 */
const props = defineProps<{
  row: OutlineRow;
  expanded: boolean;
  current: boolean;
  renaming: boolean;
  draggableRow: boolean;
}>();

const emit = defineEmits<{
  toggle: [];
  select: [];
  contextmenu: [event: MouseEvent];
  renameCommit: [value: string];
  renameCancel: [];
  dragstart: [event: DragEvent];
  drop: [event: DragEvent];
}>();

const draft = ref("");
const inputRef = ref<HTMLInputElement | null>(null);

watch(
  () => props.renaming,
  (renaming) => {
    if (renaming) {
      draft.value = props.row.node.label;
      // The focus lands after the input swaps in.
      requestAnimationFrame(() => inputRef.value?.focus());
    }
  },
  { immediate: true },
);

function commit(): void {
  emit("renameCommit", draft.value);
}
</script>

<template>
  <div
    :class="[classes.row, current ? classes.current : '']"
    :style="{ paddingLeft: `${row.depth * 14 + 6}px` }"
    :data-testid="`outline-row-${row.node.id}`"
    :data-current="current ? 'true' : undefined"
    :title="row.node.altLabel"
    :draggable="draggableRow"
    @click="emit('select')"
    @contextmenu.prevent="emit('contextmenu', $event)"
    @dragstart="emit('dragstart', $event)"
    @dragover.prevent
    @drop.prevent="emit('drop', $event)"
  >
    <button
      v-if="row.hasChildren"
      type="button"
      :class="classes.toggle"
      :data-testid="`outline-toggle-${row.node.id}`"
      @click.stop="emit('toggle')"
    >
      {{ expanded ? "▾" : "▸" }}
    </button>
    <span v-else :class="classes.toggleSpacer" />
    <input
      v-if="renaming"
      ref="inputRef"
      v-model="draft"
      :class="classes.renameInput"
      data-testid="outline-rename-input"
      @click.stop
      @keydown.enter.prevent="commit"
      @keydown.esc.prevent="emit('renameCancel')"
      @blur="commit"
    />
    <span v-else :class="classes.label">{{ row.node.label }}</span>
    <span
      v-if="row.node.count !== undefined"
      :class="classes.badge"
      :data-testid="`outline-badge-${row.node.id}`"
      >{{ row.node.count }}</span
    >
  </div>
</template>
