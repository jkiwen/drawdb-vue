<script setup lang="ts">
import { computed, ref } from "vue";
import type { PropType } from "vue";
import type { Field, Table } from "@drawdb/core";
import { getTypeMetadata, typeColor } from "@drawdb/core";
import { NInput } from "naive-ui";
import { useDiagramStore } from "../../stores/diagram.ts";
import { useInlineEdit } from "../../composables/use-inline-edit.ts";
import { t } from "../../i18n/index.ts";
import type { TableFieldRowModel } from "./render-model.ts";
import { nextPrimaryColumns, primaryKeyName } from "../primary-key-edit.ts";

defineOptions({ name: "DrawDBTableField" });

/**
 * A row of the field list of a table.
 *
 * The row draws a render-model row (render-model.ts): in the physical layer
 * it shows the name and the type specification of the field, in the logical
 * layer the name and the logical type label of the attribute. Only a row of
 * the physical layer is editable on the canvas: the logical layer is
 * read-only by ruling (design section 6.1), so its names and types are
 * edited from the edit panel, never here.
 */
const props = defineProps({
  table: { type: Object as PropType<Table>, required: true },
  row: { type: Object as PropType<TableFieldRowModel>, required: true },
  /** The physical field of the row, when it has one (the editing target). */
  field: { type: Object as PropType<Field>, default: undefined },
  selected: { type: Boolean, default: false },
  locked: { type: Boolean, default: false },
  /** Whether the row can be edited on the canvas: the physical layer only. */
  editable: { type: Boolean, default: false },
  /** Whether the key marks (PK / UK / FK / nullable) are drawn. */
  showMarks: { type: Boolean, default: false },
  showType: { type: Boolean, default: true },
});

const emit = defineEmits(["fieldselect"]);

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

// The reference application replaces the marks of the row with a delete
// button while the pointer is on it.
const hovered = ref(false);

function onPointerEnter(): void {
  hovered.value = true;
}

function onPointerLeave(): void {
  hovered.value = false;
}

/**
 * The colour of the type of the field.
 *
 * The colours are the ones of the reference application: the integers are
 * yellow, the decimals green, the booleans violet, the dates cyan and the
 * strings orange. Only a physical field has a colour; the logical type
 * labels keep the default colour.
 */
const typeColorOfField = computed(() => {
  if (!props.field) {
    return undefined;
  }
  const database = diagram.diagram.database;
  const metadata = getTypeMetadata(database, props.field.fieldType.type);
  return typeColor(props.field.fieldType.type, metadata);
});

function onPointerDown(event: PointerEvent): void {
  emit("fieldselect", {
    tableId: props.table.id,
    fieldId: props.row.fieldId ?? props.row.rowId,
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
  if (props.locked || !props.editable || !props.field) {
    return;
  }
  startName(props.field.name);
}

function onStartType(event: Event): void {
  event.stopPropagation();
  if (props.locked || !props.editable || !props.field) {
    return;
  }
  startType(props.field.fieldType.type);
}

function onCommitName(): void {
  if (!props.field) {
    return;
  }
  const value = commitName(props.field.name);
  if (value !== undefined) {
    diagram.updateField(props.table.id, props.field.id, { name: value });
  }
}

function onCommitType(): void {
  if (!props.field) {
    return;
  }
  const value = commitType(props.field.fieldType.type);
  if (value !== undefined) {
    diagram.updateField(props.table.id, props.field.id, {
      fieldType: { ...props.field.fieldType, type: value },
      fieldTypeSource: "explicit",
    });
  }
}

function onTogglePrimary(event: Event): void {
  event.stopPropagation();
  if (props.locked || !props.editable || !props.field) return;
  const fieldId = props.field.id;
  const isPrimary = (props.table.primaryKey?.columns ?? []).some((column) => String(column.fieldId) === String(fieldId));
  diagram.setPrimaryColumns(props.table.id, nextPrimaryColumns(props.table, fieldId, !isPrimary), primaryKeyName(props.table));
}

function onRemove(event: Event): void {
  event.stopPropagation();
  if (props.locked || !props.editable || !props.field) {
    return;
  }
  diagram.removeField(props.table.id, props.field.id);
}
</script>

<template>
  <div
    class="ddb-table__field"
    :class="{ 'is-selected': selected }"
    :data-table-id="table.id"
    :data-field-id="row.rowId"
    :data-testid="`field-${table.id}-${row.rowId}`"
    @pointerdown.stop="onPointerDown"
    @pointerenter="onPointerEnter"
    @pointerleave="onPointerLeave"
  >
    <span class="ddb-table__field-main">
      <span
        v-if="editable"
        class="ddb-table__field-handle field-drag-handle"
        data-drag-handle="true"
        :data-testid="`field-drag-handle-${row.rowId}`"
        @pointerdown.stop
        @dblclick.stop
      />
      <NInput
        v-if="editingName"
        class="ddb-table__field-name-input"
        size="tiny"
        :value="nameDraft"
        :data-testid="`field-name-input-${row.rowId}`"
        @update:value="onNameInput"
        @blur="onCommitName"
        @keyup.enter="onCommitName"
      />
      <template v-else>
        <span
          class="ddb-table__field-name"
          :class="{ 'is-locked': locked }"
          :data-testid="`field-name-${row.rowId}`"
          @dblclick="onStartName"
        >
          {{ row.name }}
        </span>
        <span
          v-if="row.nameFallback"
          class="ddb-table__fallback-badge"
          :data-testid="`field-name-fallback-${row.rowId}`"
          :title="t('table_no_logical_name_title')"
        >
          {{ t("table_no_logical_name") }}
        </span>
      </template>
    </span>
    <span class="ddb-table__field-marks">
      <span class="ddb-table__field-marks-row">
        <span
          v-if="showMarks && row.primary"
          class="ddb-table__field-key"
          data-testid="field-primary"
          :data-field-id="row.rowId"
          :title="t('primary_key')"
          @click="onTogglePrimary"
        >
          <svg
            class="ddb-table__field-key-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <circle cx="7.5" cy="15.5" r="3.5" />
            <path d="M10.5 12.5 20 3" />
            <path d="M16 3h4v4" />
          </svg>
        </span>
        <span
          v-if="showMarks && row.unique"
          class="ddb-table__field-unique"
          data-testid="field-unique"
          :data-field-id="row.rowId"
          title="Unique"
        >
          U
        </span>
        <span
          v-if="showMarks && row.foreign"
          class="ddb-table__field-foreign"
          data-testid="field-foreign"
          :data-field-id="row.rowId"
          title="Foreign key"
        >
          FK
        </span>
        <span
          v-if="showMarks && !row.notNull"
          class="ddb-table__field-nullable"
          data-testid="field-not-null"
          :data-field-id="row.rowId"
          :title="t('nullable')"
        >
          ?
        </span>
        <NInput
          v-if="editingType"
          class="ddb-table__field-type-input"
          size="tiny"
          :value="typeDraft"
          :data-testid="`field-type-input-${row.rowId}`"
          @update:value="onTypeInput"
          @blur="onCommitType"
          @keyup.enter="onCommitType"
        />
        <span
          v-else-if="showType"
          class="ddb-table__field-type"
          :class="{
            'is-locked': locked,
            'ddb-table__field-type--placeholder': row.typePlaceholder,
          }"
          data-testid="field-type"
          :data-field-id="row.rowId"
          :style="typeColorOfField ? { color: typeColorOfField } : undefined"
          @dblclick="onStartType"
        >
          {{ row.typeLabel }}
        </span>
      </span>
      <button
        v-if="hovered && !locked && editable && field"
        type="button"
        class="ddb-table__field-remove"
        :data-testid="`remove-field-${row.rowId}`"
        @pointerdown.stop
        @click="onRemove"
      >
        −
      </button>
    </span>
  </div>
</template>
