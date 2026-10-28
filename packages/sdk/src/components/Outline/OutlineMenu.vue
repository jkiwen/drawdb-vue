<script setup lang="ts">
import { t } from "../../i18n/index.ts";
import type { OutlineNode } from "./outline-model.ts";
import classes from "./outline-tree.module.css";

/**
 * The context menu of the outline tree. It owns the overlay and the items
 * only; the tree keeps the state and runs the actions, which keeps
 * `OutlineTree.vue` under the file-size limit now that a category can also
 * create an object (P5 audit item 2).
 */

const props = defineProps<{
  x: number;
  y: number;
  node: OutlineNode;
  /** The label of the create entry; null rows have no create entry. */
  createLabel: string | null;
}>();

const emit = defineEmits<{
  close: [];
  create: [];
  rename: [];
  delete: [];
}>();

const isCategory = (): boolean => props.node.kind === "category";
</script>

<template>
  <div :class="classes.menuOverlay" @click="emit('close')" @contextmenu.prevent="emit('close')" />
  <div
    :class="classes.menu"
    :style="{ left: `${x}px`, top: `${y}px` }"
    data-testid="outline-menu"
  >
    <button
      v-if="isCategory() && createLabel"
      type="button"
      :class="classes.menuItem"
      data-testid="outline-menu-create"
      @click="emit('create')"
    >
      {{ createLabel }}
    </button>
    <template v-if="!isCategory()">
      <button
        type="button"
        :class="classes.menuItem"
        data-testid="outline-menu-rename"
        @click="emit('rename')"
      >
        {{ t("rename") }}
      </button>
      <button
        type="button"
        :class="classes.menuItem"
        data-testid="outline-menu-delete"
        @click="emit('delete')"
      >
        {{ t("delete") }}
      </button>
    </template>
  </div>
</template>
