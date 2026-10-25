<script setup lang="ts">
import { computed } from "vue";
import type { PropType } from "vue";
import type { Table } from "@drawdb/core";
import { NInput } from "naive-ui";
import { useDiagramStore } from "../../stores/diagram.ts";
import { useInlineEdit } from "../../composables/use-inline-edit.ts";
import { TABLE_COLOR_STRIP_HEIGHT } from "./geometry.ts";

defineOptions({ name: "DrawDBTableHeader" });

const props = defineProps({
  table: { type: Object as PropType<Table>, required: true },
  selected: { type: Boolean, default: false },
  locked: { type: Boolean, default: false },
});

const emit = defineEmits(["togglelock", "toggledetails"]);

const diagram = useDiagramStore();

const {
  editing: editingName,
  draft: nameDraft,
  start: startName,
  commit: commitName,
} = useInlineEdit();

const {
  editing: editingComment,
  draft: commentDraft,
  start: startComment,
  commit: commitComment,
} = useInlineEdit();

const headerStyle = computed(() => {
  if (!props.table.color) {
    return {};
  }
  return { borderTopColor: props.table.color };
});

function onStartName(event: Event): void {
  event.stopPropagation();
  if (props.locked) {
    return;
  }
  startName(props.table.name);
}

function onNameInput(value: string): void {
  nameDraft.value = value;
}

function onCommitName(): void {
  const value = commitName(props.table.name);
  if (value !== undefined) {
    diagram.updateTable(props.table.id, { name: value });
  }
}

function onStartComment(event: Event): void {
  event.stopPropagation();
  if (props.locked) {
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

function onToggleDetails(event: Event): void {
  event.stopPropagation();
  emit("toggledetails", { tableId: props.table.id });
}

function onToggleLock(event: Event): void {
  event.stopPropagation();
  emit("togglelock", { tableId: props.table.id });
}
</script>

<template>
  <div
    class="ddb-table__header"
    :class="{ 'is-selected': selected, 'is-locked': table.locked }"
    :style="headerStyle"
    :data-testid="`table-header-${table.id}`"
  >
    <span
      v-if="table.color"
      class="ddb-table__color-strip"
      :style="{ height: `${TABLE_COLOR_STRIP_HEIGHT}px` }"
    />

    <div class="ddb-table__header-main">
      <NInput
        v-if="editingName"
        class="ddb-table__name-input"
        size="tiny"
        :value="nameDraft"
        :data-testid="`table-name-input-${table.id}`"
        @update:value="onNameInput"
        @blur="onCommitName"
        @keyup.enter="onCommitName"
      />
      <span
        v-else
        class="ddb-table__name"
        :class="{ 'is-locked': locked }"
        :data-testid="`table-name-${table.id}`"
        @dblclick="onStartName"
      >
        {{ table.name }}
      </span>

      <NInput
        v-if="editingComment"
        class="ddb-table__comment-input"
        size="tiny"
        :value="commentDraft"
        :data-testid="`table-comment-input-${table.id}`"
        @update:value="onCommentInput"
        @blur="onCommitComment"
        @keyup.enter="onCommitComment"
      />
      <span
        v-else-if="table.comment"
        class="ddb-table__comment"
        :class="{ 'is-locked': locked }"
        :data-testid="`table-comment-${table.id}`"
        @dblclick="onStartComment"
      >
        {{ table.comment }}
      </span>

      <button
        type="button"
        class="ddb-table__lock-toggle"
        :data-testid="`table-lock-toggle-${table.id}`"
        :title="table.locked ? 'Unlock the table' : 'Lock the table'"
        @pointerdown.stop
        @click="onToggleLock"
      >
        {{ table.locked ? "🔒" : "🔓" }}
      </button>

      <button
        type="button"
        class="ddb-table__details-toggle"
        :data-testid="`table-details-toggle-${table.id}`"
        title="The details of the table"
        @pointerdown.stop
        @click="onToggleDetails"
      >
        ⋯
      </button>
    </div>

  </div>
</template>

