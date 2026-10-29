<script setup lang="ts">
import type { PropType } from "vue";
import type { Table } from "@drawdb/core";
import { NInput } from "naive-ui";
import { t } from "../../i18n/index.ts";
import { useDiagramStore } from "../../stores/diagram.ts";
import { useInlineEdit } from "../../composables/use-inline-edit.ts";
import { TABLE_COLOR_STRIP_HEIGHT } from "./geometry.ts";
import { DEFAULT_TABLE_COLOR } from "../../utils/color-palette.ts";
import type { TableRenderModel } from "./render-model.ts";

defineOptions({ name: "DrawDBTableHeader" });

/**
 * The header of a table node.
 *
 * The header draws the title of the render model: the name of the layer the
 * canvas shows, with a pale badge when the physical name stands in for a
 * missing logical name (ruling of section 6.4). The description of the layer
 * is not drawn here any more — it is the last block of the body
 * (TableSections.vue). Only the physical layer is editable on the canvas
 * (TODO: the inline editing of the logical names).
 */
const props = defineProps({
  table: { type: Object as PropType<Table>, required: true },
  model: { type: Object as PropType<TableRenderModel>, required: true },
  selected: { type: Boolean, default: false },
  locked: { type: Boolean, default: false },
  /** Whether the name can be edited on the canvas. */
  editable: { type: Boolean, default: false },
});

const emit = defineEmits(["togglelock", "toggledetails"]);

const diagram = useDiagramStore();

const {
  editing: editingName,
  draft: nameDraft,
  start: startName,
  commit: commitName,
} = useInlineEdit();

function onStartName(event: Event): void {
  event.stopPropagation();
  if (props.locked || !props.editable) {
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
    :data-testid="`table-header-${table.id}`"
  >
    <span
      class="ddb-table__color-strip"
      :data-testid="`table-color-strip-${table.id}`"
      :style="{
        height: `${TABLE_COLOR_STRIP_HEIGHT}px`,
        background: table.color ?? DEFAULT_TABLE_COLOR,
      }"
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
      <template v-else>
        <span
          class="ddb-table__name"
          :class="{ 'is-locked': locked }"
          :data-testid="`table-name-${table.id}`"
          @dblclick="onStartName"
        >
          {{ model.title }}
        </span>
        <span
          v-if="model.titleFallback"
          class="ddb-table__fallback-badge"
          :data-testid="`table-title-fallback-${table.id}`"
          :title="t('table_no_logical_name_title')"
        >
          {{ t("table_no_logical_name") }}
        </span>
      </template>

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
