<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { Table } from "@drawdb/core";
import { useDiagramStore } from "../../stores/diagram.ts";
import styles from "./edit-panel.module.css";
import { commonText } from "./edit-panel-model.ts";

/**
 * The batch editor of a multi selection of tables (design section 4.7):
 * only the shared properties — logical description and physical comment.
 * A disagreement shows the "multiple values" placeholder. The change is
 * applied to every table as one history entry; Q12 atomicity means a
 * refusal of any table rejects the whole batch and the reason shows up
 * inline, never as a modal.
 */
const props = defineProps<{
  tables: Table[];
}>();

const store = useDiagramStore();

const descriptionCommon = computed(() =>
  commonText(props.tables.map((table) => table.logical.description)),
);
const commentCommon = computed(() =>
  commonText(props.tables.map((table) => table.comment)),
);

const description = ref(descriptionCommon.value.value);
const comment = ref(commentCommon.value.value);
watch(descriptionCommon, (value) => {
  description.value = value.value;
});
watch(commentCommon, (value) => {
  comment.value = value.value;
});

const error = ref("");

function apply(): void {
  error.value = "";
  const patch: { logicalDescription?: string; comment?: string } = {};
  if (!descriptionCommon.value.multiple || description.value !== descriptionCommon.value.value) {
    patch.logicalDescription = description.value;
  }
  if (!commentCommon.value.multiple || comment.value !== commentCommon.value.value) {
    patch.comment = comment.value;
  }
  if (Object.keys(patch).length === 0) return;
  const applied = store.applyTableBatch(props.tables, patch);
  if (!applied) {
    // TODO(i18n): Task 7 moves the panel copy into the locale files.
    error.value =
      "The batch change was not applied: at least one selected table is locked.";
  }
}

// TODO(i18n): Task 7 moves the panel copy into the locale files.
const MULTIPLE = "Multiple values";
</script>

<template>
  <div :class="styles['pair-grid']" data-testid="batch-editor">
    <p style="grid-column: 1 / -1; margin: 0" :class="styles.label">
      {{ props.tables.length }} tables selected
    </p>
    <label>
      <span :class="styles.label">Logical description</span>
      <textarea
        v-model="description"
        :class="styles.textarea"
        :placeholder="descriptionCommon.multiple ? MULTIPLE : ''"
        data-testid="batch-description"
      />
    </label>
    <label>
      <span :class="styles.label">Physical comment</span>
      <textarea
        v-model="comment"
        :class="styles.textarea"
        :placeholder="commentCommon.multiple ? MULTIPLE : ''"
        data-testid="batch-comment"
      />
    </label>
    <div style="grid-column: 1 / -1; display: flex; gap: 8px; align-items: center">
      <button
        type="button"
        :class="styles['add-button']"
        data-testid="batch-apply"
        @click="apply"
      >
        Apply to all
      </button>
      <span v-if="error" :class="styles.error" data-testid="batch-error">{{ error }}</span>
    </div>
  </div>
</template>
