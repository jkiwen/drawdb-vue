<script setup lang="ts">
import { ref, watch } from "vue";
import type { Table } from "@drawdb/core";
import styles from "./edit-panel.module.css";

/**
 * The table level of the paired presentation (design section 4.3): the
 * logical entity name and the physical table name side by side, and the
 * logical description next to the physical comment. Text commits on
 * blur/Enter (`change`), an empty name is rejected by the commit helper.
 */
const props = defineProps<{
  table: Table;
}>();

const emit = defineEmits<{
  commit: [patch: import("./edit-actions.ts").TableBasicsPatch];
}>();

const logicalName = ref(props.table.logical.name);
const physicalName = ref(props.table.name);
const description = ref(props.table.logical.description ?? "");
const comment = ref(props.table.comment ?? "");

watch(
  () => props.table,
  (table) => {
    logicalName.value = table.logical.name;
    physicalName.value = table.name;
    description.value = table.logical.description ?? "";
    comment.value = table.comment ?? "";
  },
);
</script>

<template>
  <div :class="styles['pair-grid']" data-testid="table-basics">
    <label>
      <span :class="styles.label">Logical entity</span>
      <input
        v-model="logicalName"
        :class="styles.input"
        data-testid="table-logical-name"
        @change="emit('commit', { logicalName })"
      />
    </label>
    <label>
      <span :class="styles.label">Physical table</span>
      <input
        v-model="physicalName"
        :class="styles.input"
        data-testid="table-physical-name"
        @change="emit('commit', { physicalName })"
      />
    </label>
    <label>
      <span :class="styles.label">Description</span>
      <textarea
        v-model="description"
        :class="styles.textarea"
        data-testid="table-description"
        @change="emit('commit', { description })"
      />
    </label>
    <label>
      <span :class="styles.label">Comment</span>
      <textarea
        v-model="comment"
        :class="styles.textarea"
        data-testid="table-comment"
        @change="emit('commit', { comment })"
      />
    </label>
  </div>
</template>
