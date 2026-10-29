<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { NButton, NInput, NSelect } from "naive-ui";
import { Cardinality, Constraint, createId } from "@drawdb/core";
import type { Relationship } from "@drawdb/core";
import { useDiagramStore } from "../../stores/diagram.ts";
import { t } from "../../i18n/index.ts";
import RelationshipEndPicker from "./RelationshipEndPicker.vue";
import {
  cardinalityOptions,
  constraintOptions,
} from "./relationship-options.ts";
import "./relationship-dialog.css";

/**
 * The dialog that creates a relationship between two tables.
 *
 * The dialog is the second way to create a relationship, next to the link the
 * user draws on the canvas. It picks the two ends of the relationship, the
 * cardinality and the referential actions, and writes the result into the
 * diagram, so that the creation can be undone.
 */
defineOptions({ name: "DrawDBRelationshipDialog" });

const props = withDefaults(
  defineProps<{
    open?: boolean;
  }>(),
  { open: false },
);

const emit = defineEmits<{
  "update:open": [value: boolean];
}>();

const diagram = useDiagramStore();

const startTableId = ref<string | number | null>(null);
const startFieldId = ref<string | number | null>(null);
const endTableId = ref<string | number | null>(null);
const endFieldId = ref<string | number | null>(null);
const name = ref("");
const cardinality = ref<string>(Cardinality.MANY_TO_ONE);
const updateConstraint = ref<string>(Constraint.NONE);
const deleteConstraint = ref<string>(Constraint.NONE);

const tables = computed(() => diagram.tables);

/** The primary key of a table, the field a table alone points at. */
function primaryKeyOf(tableId: string | number | null): string | number | null {
  if (tableId === null) return null;
  const table = diagram.tableById(tableId);
  return table?.primaryKey?.columns[0]?.fieldId ?? null;
}

/**
 * The field of a table that an end without a field points at.
 *
 * The primary key of the table is the first choice. A table without a primary
 * key has none, and the end would point nowhere. The first field of the table
 * is used then, the same way the link of the canvas ends on it.
 */
function endFieldOf(
  tableId: string | number | null,
  fieldId: string | number | null,
): string | number | null {
  if (fieldId !== null) return fieldId;
  if (tableId === null) return null;
  const table = diagram.tableById(tableId);
  return primaryKeyOf(tableId) ?? table?.fields[0]?.id ?? null;
}

/**
 * Whether the dialog can create the relationship.
 *
 * Both ends need a table, and the two ends must not be the same table and the
 * same field, which would be a relationship with itself.
 */
const valid = computed(() => {
  if (startTableId.value === null || endTableId.value === null) {
    return false;
  }
  const startField = endFieldOf(startTableId.value, startFieldId.value);
  const endField = endFieldOf(endTableId.value, endFieldId.value);
  if (startField === null || endField === null) {
    // A table without a field cannot be the end of a relationship.
    return false;
  }
  return !(
    String(startTableId.value) === String(endTableId.value) &&
    String(startField) === String(endField)
  );
});

const reason = computed(() => {
  if (startTableId.value === null || endTableId.value === null) {
    return t("relationship_pick_tables");
  }
  if (!valid.value) {
    return t("relationship_same_end");
  }
  return "";
});

/** The default name of the relationship, the name of the foreign key. */
function defaultName(): string {
  const source = diagram.tableById(startTableId.value ?? "");
  const target = diagram.tableById(endTableId.value ?? "");
  if (!source || !target) {
    return "";
  }
  const field =
    source.fields.find(
      (item) =>
        String(item.id) ===
        String(endFieldOf(startTableId.value, startFieldId.value)),
    ) ?? source.fields[0];
  return `fk_${source.name}_${field?.name ?? "field"}_${target.name}`;
}

// The dialog starts with the two first tables of the diagram, so that the user
// only has to confirm them.
watch(
  () => props.open,
  (open) => {
    if (!open) {
      return;
    }
    const first = tables.value[0];
    const second = tables.value[1];
    startTableId.value = first?.id ?? null;
    startFieldId.value = first?.fields[0]?.id ?? null;
    endTableId.value = second?.id ?? null;
    endFieldId.value = second ? primaryKeyOf(second.id) : null;
    // A table without a primary key points at its first field.
    if (second && endFieldId.value === null) {
      endFieldId.value = second.fields[0]?.id ?? null;
    }
    name.value = "";
    cardinality.value = Cardinality.MANY_TO_ONE;
    updateConstraint.value = Constraint.NONE;
    deleteConstraint.value = Constraint.NONE;
  },
);

function apply(): void {
  if (!valid.value) {
    return;
  }
  const source = diagram.tableById(startTableId.value ?? "");
  const target = diagram.tableById(endTableId.value ?? "");
  if (!source || !target) {
    return;
  }
  const startField = endFieldOf(startTableId.value, startFieldId.value);
  const endField = endFieldOf(endTableId.value, endFieldId.value);
  if (startField === null || endField === null) {
    return;
  }
  const relationship: Relationship = {
    id: createId(),
    name: name.value.trim() || defaultName(),
    startTableId: source.id,
    startFieldId: startField,
    endTableId: target.id,
    endFieldId: endField,
    cardinality: cardinality.value,
    updateConstraint: updateConstraint.value,
    deleteConstraint: deleteConstraint.value,
  };
  diagram.addRelationship(relationship);
  emit("update:open", false);
}

function close(): void {
  emit("update:open", false);
}
</script>

<template>
  <div
    v-if="props.open"
    class="ddb-relationship"
    data-testid="relationship-dialog"
  >
    <h2 class="ddb-relationship__title">{{ t("add_relationship") }}</h2>

    <div class="ddb-relationship__ends">
      <RelationshipEndPicker
        v-model:table-id="startTableId"
        v-model:field-id="startFieldId"
        :tables="tables"
        :label="t('relationship_source')"
        testid="relationship-start"
      />
      <RelationshipEndPicker
        v-model:table-id="endTableId"
        v-model:field-id="endFieldId"
        :tables="tables"
        :label="t('relationship_target')"
        testid="relationship-end"
      />
    </div>

    <label class="ddb-relationship__label" for="relationship-name">
      {{ t("name") }}
    </label>
    <NInput
      id="relationship-name"
      v-model:value="name"
      data-testid="relationship-name"
      :placeholder="t('relationship_name_placeholder')"
    />

    <label class="ddb-relationship__label" for="relationship-cardinality">
      {{ t("cardinality") }}
    </label>
    <NSelect
      id="relationship-cardinality"
      v-model:value="cardinality"
      :options="cardinalityOptions"
      data-testid="relationship-cardinality"
    />

    <div class="ddb-relationship__row">
      <div class="ddb-relationship__row-item">
        <label class="ddb-relationship__label" for="relationship-update">
          {{ t("on_update") }}
        </label>
        <NSelect
          id="relationship-update"
          v-model:value="updateConstraint"
          :options="constraintOptions"
          data-testid="relationship-update"
        />
      </div>
      <div class="ddb-relationship__row-item">
        <label class="ddb-relationship__label" for="relationship-delete">
          {{ t("on_delete") }}
        </label>
        <NSelect
          id="relationship-delete"
          v-model:value="deleteConstraint"
          :options="constraintOptions"
          data-testid="relationship-delete"
        />
      </div>
    </div>

    <p
      v-if="reason"
      class="ddb-relationship__reason"
      data-testid="relationship-reason"
    >
      {{ reason }}
    </p>

    <div class="ddb-relationship__actions">
      <NButton
        type="primary"
        :disabled="!valid"
        data-testid="relationship-create"
        @click="apply"
      >
        {{ t("create") }}
      </NButton>
      <NButton data-testid="relationship-cancel" @click="close">
        {{ t("close") }}
      </NButton>
    </div>
  </div>
</template>
