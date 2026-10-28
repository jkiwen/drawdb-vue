<script setup lang="ts">
import type { PropType } from "vue";
import type { Table } from "@drawdb/core";
import { NInput } from "naive-ui";
import { useDiagramStore } from "../../stores/diagram.ts";
import { useUIStore } from "../../stores/ui.ts";
import { useInlineEdit } from "../../composables/use-inline-edit.ts";
import type { TableRenderModel } from "./render-model.ts";
import type { SectionRef } from "./table-sections.ts";

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
const ui = useUIStore();

/**
 * A key row is an object of its own (review issue 5): a click on the row of
 * the canvas selects the field of the key, or the relationship of a foreign
 * key, so the panel and the outline agree with what the canvas draws.
 */
function hasRef(ref: SectionRef | undefined): boolean {
  if (!ref) return false;
  if ("relationshipId" in ref) return true;
  return String(ref.fieldId) !== "";
}

function selectRef(ref: SectionRef | undefined): void {
  if (!hasRef(ref) || !ref) return;
  if ("relationshipId" in ref) {
    ui.selectRelationship(String(ref.relationshipId));
    return;
  }
  ui.selectField(String(props.table.id), String(ref.fieldId));
}

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
      <template v-for="(line, position) in section.lines" :key="`${section.kind}-${position}`">
        <button
          v-if="hasRef(section.refs[position])"
          type="button"
          class="ddb-table__section-line ddb-table__section-line--pickable"
          :title="line"
          :data-testid="`table-section-${section.kind}-line-${table.id}-${position}`"
          @click.stop="selectRef(section.refs[position])"
        >
          {{ line }}
        </button>
        <p v-else class="ddb-table__section-line" :title="line">{{ line }}</p>
      </template>
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
