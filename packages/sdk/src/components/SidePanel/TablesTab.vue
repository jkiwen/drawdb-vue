<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { NButton, NCheckbox, NEmpty, NInput, NTag } from "naive-ui";
import { createId } from "@drawdb/core";
import { useDiagramStore } from "../../stores/diagram.ts";
import { useUIStore } from "../../stores/ui.ts";
import { elementBounds, heldByLockedArea } from "../../utils/elements.ts";
import { nextPrimaryColumns, primaryKeyName } from "../primary-key-edit.ts";
import "./tables-tab.css";
import { t } from "../../i18n/index.ts";

/**
 * The tables tab of the side panel.
 *
 * It lists the tables of the diagram and lets the user edit the selected one.
 * The name of a table and the name and the type of a field are edited in a
 * local draft and committed when the input loses the focus, so that a rename
 * is one undoable step instead of one step per keystroke.
 */

const diagram = useDiagramStore();
const ui = useUIStore();

const nameDraft = ref("");
const fieldDrafts = reactive<Record<string, { name: string; type: string }>>({});

const selectedTable = computed(() => {
  const id = ui.selectedTableIds[0];
  return id === undefined ? undefined : diagram.tableById(id);
});

const filteredTables = computed(() => {
  const term = ui.searchTerm.trim().toLowerCase();
  if (!term) return diagram.tables;
  return diagram.tables.filter((table) =>
    table.name.toLowerCase().includes(term),
  );
});

/**
 * Whether the selected table is locked.
 *
 * A locked table cannot be changed, so the panel says so as well: the inputs
 * are disabled and the buttons that change the table are gone. The lock of an
 * area extends to the tables the area holds, so a table inside a locked area
 * shows as locked here too. The store refuses the changes in any case, but a
 * panel that looks editable while nothing happens is worse than a panel that
 * says the table is locked.
 */
const locked = computed(() => {
  const table = selectedTable.value;
  if (!table) {
    return false;
  }
  return (
    table.locked === true || heldByLockedArea(diagram.areas ?? [], elementBounds(table))
  );
});

function resetDrafts(): void {
  for (const key of Object.keys(fieldDrafts)) delete fieldDrafts[key];
  const table = selectedTable.value;
  if (!table) return;
  nameDraft.value = table.name;
  for (const field of table.fields) {
    fieldDrafts[String(field.id)] = { name: field.name, type: field.fieldType.type };
  }
}

watch(selectedTable, resetDrafts, { immediate: true });

function updateDraft(
  fieldId: string | number,
  key: "name" | "type",
  value: string,
): void {
  const draft = fieldDrafts[String(fieldId)];
  if (draft) draft[key] = value;
}

function commitTableName(value: string): void {
  const table = selectedTable.value;
  if (!table) return;
  const name = value.trim();
  if (!name || name === table.name) return;
  diagram.updateTable(table.id, { name });
}

function commitFieldName(fieldId: string | number, value: string): void {
  const table = selectedTable.value;
  if (!table) return;
  const name = value.trim();
  if (!name) return;
  const field = table.fields.find((item) => item.id === fieldId);
  if (!field || field.name === name) return;
  diagram.updateField(table.id, fieldId, { name });
}

function commitFieldType(fieldId: string | number, value: string): void {
  const table = selectedTable.value;
  if (!table) return;
  const field = table.fields.find((item) => item.id === fieldId);
  if (!field || field.fieldType.type === value) return;
  diagram.updateField(table.id, fieldId, {
    fieldType: { ...field.fieldType, type: value },
    fieldTypeSource: "explicit",
  });
}

function isPrimary(fieldId: string | number): boolean {
  const table = selectedTable.value;
  return (table?.primaryKey?.columns ?? []).some(
    (column) => String(column.fieldId) === String(fieldId),
  );
}

function setFieldFlag(
  fieldId: string | number,
  flag: "primary" | "unique" | "notNull",
  value: boolean,
): void {
  const table = selectedTable.value;
  if (!table) return;
  if (flag === "primary") {
    diagram.setPrimaryColumns(
      table.id,
      nextPrimaryColumns(table, fieldId, value),
      primaryKeyName(table),
    );
    return;
  }
  diagram.updateField(table.id, fieldId, { [flag]: value });
}

function uniqueFieldName(existing: string[], base = "field"): string {
  if (!existing.includes(base)) return base;
  let index = 1;
  while (existing.includes(`${base}_${index}`)) index += 1;
  return `${base}_${index}`;
}

function addField(): void {
  const table = selectedTable.value;
  if (!table) return;
  const id = createId();
  const name = uniqueFieldName(table.fields.map((field) => field.name));
  diagram.addField(table.id, {
    id,
    name,
    fieldType: { type: "" },
    fieldTypeSource: "explicit",
  });
  fieldDrafts[String(id)] = { name, type: "" };
}

function removeField(fieldId: string | number): void {
  const table = selectedTable.value;
  if (!table) return;
  diagram.removeField(table.id, fieldId);
  delete fieldDrafts[String(fieldId)];
}

function removeTable(): void {
  const table = selectedTable.value;
  if (!table) return;
  diagram.removeTable(table.id);
  ui.clearSelection();
}
</script>

<template>
  <div class="tables-tab">
    <NInput
      v-model:value="ui.searchTerm"
      size="small"
      :placeholder="t('search')"
      data-testid="side-panel-search"
    />

    <ul class="tables-tab__list" data-testid="tables-list">
      <li v-for="table in filteredTables" :key="table.id">
        <NButton
          text
          block
          class="tables-tab__item"
          :type="ui.selectedTableIds.includes(String(table.id)) ? 'primary' : 'default'"
          :data-testid="`table-item-${table.name}`"
          @click="ui.selectTable(String(table.id))"
        >
          {{ table.name }}
        </NButton>
        <NTag size="small" :bordered="false">
          {{ table.fields.length }}
        </NTag>
      </li>
    </ul>

    <section v-if="selectedTable" class="tables-tab__editor">
      <header class="tables-tab__editor-header">
        <NInput
          v-model:value="nameDraft"
          size="small"
          :placeholder="t('name')"
          data-testid="table-name-input"
          :disabled="locked"
          @change="commitTableName"
        />
        <NButton
          v-if="!locked"
          size="small"
          type="error"
          quaternary
          data-testid="remove-table-btn"
          @click="removeTable"
        >
          Delete
        </NButton>
        <NTag v-else size="small" :bordered="false" data-testid="locked-table-tag">
          Locked
        </NTag>
      </header>

      <ul class="tables-tab__fields" data-testid="field-list">
        <li
          v-for="field in selectedTable.fields"
          :key="field.id"
          :data-testid="`field-row-${field.id}`"
        >
          <NInput
            :value="fieldDrafts[String(field.id)]?.name ?? field.name"
            size="small"
            :placeholder="t('name')"
            :data-testid="`field-name-${field.id}`"
            :disabled="locked"
            @update:value="updateDraft(field.id, 'name', $event)"
            @change="commitFieldName(field.id, $event)"
          />
          <NInput
            :value="fieldDrafts[String(field.id)]?.type ?? field.fieldType.type"
            size="small"
            :placeholder="t('type')"
            :data-testid="`field-type-${field.id}`"
            :disabled="locked"
            @update:value="updateDraft(field.id, 'type', $event)"
            @change="commitFieldType(field.id, $event)"
          />
          <NCheckbox
            :checked="isPrimary(field.id)"
            :data-testid="`field-primary-${field.id}`"
            :disabled="locked"
            @update:checked="setFieldFlag(field.id, 'primary', $event)"
          >
            PK
          </NCheckbox>
          <NCheckbox
            :checked="!!field.unique"
            :data-testid="`field-unique-${field.id}`"
            :disabled="locked"
            @update:checked="setFieldFlag(field.id, 'unique', $event)"
          >
            UQ
          </NCheckbox>
          <NCheckbox
            :checked="!!field.notNull"
            :data-testid="`field-notnull-${field.id}`"
            :disabled="locked"
            @update:checked="setFieldFlag(field.id, 'notNull', $event)"
          >
            NN
          </NCheckbox>
          <NButton
            v-if="!locked"
            size="tiny"
            quaternary
            type="error"
            :data-testid="`remove-field-${field.id}`"
            @click="removeField(field.id)"
          >
            ✕
          </NButton>
        </li>
      </ul>

      <NButton
        v-if="!locked"
        size="small"
        dashed
        block
        data-testid="add-field-btn"
        @click="addField"
      >
        {{ t('add_field') }}
      </NButton>
    </section>

    <NEmpty v-else :description="t('select_a_table')" />
  </div>
</template>
