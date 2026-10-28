<script setup lang="ts">
import type { PropType } from "vue";
import type { Table } from "@drawdb/core";
import { NInput } from "naive-ui";
import { useDiagramStore } from "../../stores/diagram.ts";
import { useInlineEdit } from "../../composables/use-inline-edit.ts";
import type { TableRenderModel } from "./render-model.ts";

defineOptions({ name: "DrawDBTableSections" });

/**
 * The blocks a table draws below its field list (section 7 of the UI
 * document).
 *
 * The keys, the indices and the description of the layer are drawn as one
 * block each, in the order PK, FK, UK, INDEX and the description, separated
 * by a rule. The blocks are measured by the render model
 * (table-sections.ts), so the node draws exactly the height the canvas
 * measured — the table grows to fit them.
 *
 * Only the description is editable here, and only in the physical layer: the
 * keys and the indices are edited in the details block or the side panel.
 */
const props = defineProps({
  table: { type: Object as PropType<Table>, required: true },
  model: { type: Object as PropType<TableRenderModel>, required: true },
  locked: { type: Boolean, default: false },
  editable: { type: Boolean, default: false },
});

const diagram = useDiagramStore();

const {
  editing: editingComment,
  draft: commentDraft,
  start: startComment,
  commit: commitComment,
} = useInlineEdit();

function onStartComment(event: Event): void {
  event.stopPropagation();
  if (props.locked || !props.editable) {
    return;
  }
  startComment(props.table.comment ?? "");
}

function onCommentInput(value: string): void {
  commentDraft.value = value;
}

function onCommitComment(): void {
  const value = commitComment(props.table.comment ?? "");
  if (value !== undefined) {
    diagram.updateTable(props.table.id, { comment: value });
  }
}
</script>

<template>
  <div
    v-if="model.sections.length > 0"
    class="ddb-table__sections"
    :data-testid="`table-sections-${table.id}`"
  >
    <div
      v-for="section in model.sections"
      :key="section.kind"
      class="ddb-table__section"
      :class="`ddb-table__section--${section.kind}`"
      :style="{ height: `${section.height}px` }"
      :data-testid="`table-section-${section.kind}-${table.id}`"
    >
      <p v-if="section.label" class="ddb-table__section-label">
        {{ section.label }}
      </p>
      <p
        v-for="(line, position) in section.lines"
        :key="`${section.kind}-${position}`"
        class="ddb-table__section-line"
        :title="line"
      >
        {{ line }}
      </p>
      <template v-if="section.kind === 'description'">
        <NInput
          v-if="editingComment"
          class="ddb-table__comment-input ddb-table__section-input"
          size="tiny"
          :value="commentDraft"
          :data-testid="`table-comment-input-${table.id}`"
          @update:value="onCommentInput"
          @blur="onCommitComment"
          @keyup.enter="onCommitComment"
        />
        <p
          v-else
          class="ddb-table__section-text"
          :class="{ 'is-locked': locked }"
          :data-testid="`table-comment-${table.id}`"
          @dblclick="onStartComment"
        >
          {{ section.text }}
        </p>
      </template>
    </div>
  </div>
</template>
