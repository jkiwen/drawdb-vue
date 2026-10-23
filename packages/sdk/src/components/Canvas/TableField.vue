<script setup lang="ts">
import { computed } from "vue";
import type { PropType } from "vue";
import type { Field, Table } from "@drawdb/core";
import { NInput } from "naive-ui";
import { useDiagramStore } from "../../stores/diagram.ts";
import { useUIStore } from "../../stores/ui.ts";
import { useInlineEdit } from "../../composables/use-inline-edit.ts";
import { fieldLabel } from "./geometry.ts";

defineOptions({ name: "DrawDBTableField" });

const props = defineProps({
  table: { type: Object as PropType<Table>, required: true },
  field: { type: Object as PropType<Field>, required: true },
  selected: { type: Boolean, default: false },
  showFieldTypes: { type: Boolean, default: true },
});

const emit = defineEmits(["fieldselect"]);

const ui = useUIStore();
const diagram = useDiagramStore();

const {
  editing: editingName,
  draft: nameDraft,
  start: startName,
  commit: commitName,
} = useInlineEdit();

const {
  editing: editingType,
  draft: typeDraft,
  start: startType,
  commit: commitType,
} = useInlineEdit();

/**
 * The types of the fields are a property of the physical view.
 *
 * The logical view only shows the names of the entities and their relations.
 */
const showsFieldTypes = computed(
  () => props.showFieldTypes && ui.viewMode !== "logical",
);

function onPointerDown(event: PointerEvent): void {
  emit("fieldselect", {
    tableId: props.table.id,
    fieldId: props.field.id,
    event,
  });
}

function onNameInput(value: string): void {
  nameDraft.value = value;
}

function onTypeInput(value: string): void {
  typeDraft.value = value;
}

function onStartName(event: Event): void {
  event.stopPropagation();
  startName(props.field.name);
}

function onStartType(event: Event): void {
  event.stopPropagation();
  startType(props.field.type);
}

function onCommitName(): void {
  const value = commitName(props.field.name);
  if (value !== undefined) {
    diagram.updateField(props.table.id, props.field.id, { name: value });
  }
}

function onCommitType(): void {
  const value = commitType(props.field.type);
  if (value !== undefined) {
    diagram.updateField(props.table.id, props.field.id, { type: value });
  }
}

function onTogglePrimary(event: Event): void {
  event.stopPropagation();
  diagram.updateField(props.table.id, props.field.id, {
    primary: !props.field.primary,
  });
}

function onRemove(event: Event): void {
  event.stopPropagation();
  diagram.removeField(props.table.id, props.field.id);
}
</script>

<template>
  <div
    class="ddb-table__field"
    :class="{ 'is-selected': selected }"
    :data-table-id="table.id"
    :data-field-id="field.id"
    :data-testid="`field-${table.id}-${field.id}`"
    @pointerdown.stop="onPointerDown"
  >
    <span
      class="ddb-table__field-handle field-drag-handle"
      data-drag-handle="true"
      :data-testid="`field-drag-handle-${field.id}`"
      @pointerdown.stop
      @dblclick.stop
    />
    <NInput
      v-if="editingName"
      class="ddb-table__field-input"
      size="tiny"
      :value="nameDraft"
      :data-testid="`field-name-input-${field.id}`"
      @update:value="onNameInput"
      @blur="onCommitName"
      @keyup.enter="onCommitName"
    />
    <span
      v-else
      class="ddb-table__field-name"
      :data-testid="`field-name-${field.id}`"
      @dblclick="onStartName"
    >
      {{ field.name }}
    </span>
    <span
      class="ddb-table__field-mark"
      :class="{ 'is-on': field.primary }"
      data-testid="field-primary"
      :data-field-id="field.id"
      @click="onTogglePrimary"
    >
      PK
    </span>
    <span
      v-if="field.notNull"
      class="ddb-table__field-mark"
      data-testid="field-not-null"
      :data-field-id="field.id"
    >
      NN
    </span>
    <NInput
      v-if="editingType"
      class="ddb-table__field-input"
      size="tiny"
      :value="typeDraft"
      :data-testid="`field-type-input-${field.id}`"
      @update:value="onTypeInput"
      @blur="onCommitType"
      @keyup.enter="onCommitType"
    />
    <span
      v-else-if="showsFieldTypes"
      class="ddb-table__field-type"
      data-testid="field-type"
      :data-field-id="field.id"
      @dblclick="onStartType"
    >
      {{ fieldLabel(field) }}
    </span>
    <button
      type="button"
      class="ddb-table__field-remove"
      :data-testid="`remove-field-${field.id}`"
      @pointerdown.stop
      @click="onRemove"
    >
      ×
    </button>
  </div>
</template>
