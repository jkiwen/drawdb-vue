<script setup lang="ts">
import { computed } from "vue";
import type { PhysicalField, RelationshipFieldPair, Table } from "@drawdb/core";
import { t } from "../../i18n/index.ts";
import styles from "./edit-panel.module.css";
import { freeFields } from "./constraint-forms.ts";

/**
 * The column pairs of a foreign key: one row per pair with the local column
 * and the column it points at, and the buttons that add, order and remove a
 * pair (review of 2026-10-29: a foreign key may join several columns).
 *
 * The rows are a pure view of the pairs they are given; every change goes out
 * through `update:pairs`, so the parent decides when (and how) to write the
 * relationship.
 */
const props = defineProps<{
  table: Table;
  targetTable?: Table;
  pairs: readonly RelationshipFieldPair[];
  /** Prefix of every test id, so two editors on the page stay distinct. */
  prefix: string;
}>();

const emit = defineEmits<{
  "update:pairs": [pairs: RelationshipFieldPair[]];
}>();

const id = (part: string, index: number): string => `${props.prefix}-${part}-${index}`;

/** The local columns a pair can still take (the ones not paired yet). */
const freeLocal = computed(() =>
  freeFields(
    props.table.fields,
    props.pairs.map((pair) => pair.startFieldId),
  ),
);

function write(pairs: RelationshipFieldPair[]): void {
  emit("update:pairs", pairs);
}

function setLocal(index: number, value: string): void {
  write(
    props.pairs.map((pair, at) =>
      at === index ? { ...pair, startFieldId: value } : { ...pair },
    ),
  );
}

function setReference(index: number, value: string): void {
  write(
    props.pairs.map((pair, at) =>
      at === index ? { ...pair, endFieldId: value } : { ...pair },
    ),
  );
}

function move(index: number, delta: -1 | 1): void {
  const to = index + delta;
  if (to < 0 || to >= props.pairs.length) return;
  const next = props.pairs.map((pair) => ({ ...pair }));
  const [moved] = next.splice(index, 1);
  next.splice(to, 0, moved!);
  write(next);
}

function remove(index: number): void {
  write(props.pairs.filter((_, at) => at !== index).map((pair) => ({ ...pair })));
}

function add(): void {
  write([...props.pairs.map((pair) => ({ ...pair })), { startFieldId: "", endFieldId: "" }]);
}

function fieldName(field: PhysicalField | undefined): string {
  return field?.name ?? "";
}

function targetField(idLike: unknown): PhysicalField | undefined {
  return props.targetTable?.fields.find((field) => String(field.id) === String(idLike));
}
</script>

<template>
  <div :class="styles.rows" :data-testid="`${prefix}-pairs`">
    <div
      v-for="(pair, index) in pairs"
      :key="`${prefix}-pair-${index}`"
      :class="styles['pair-row']"
      :data-testid="id('pair', index)"
    >
      <select
        :class="styles.select"
        :value="String(pair.startFieldId)"
        :aria-label="t('edit_panel_foreign_local')"
        :data-testid="id('local', index)"
        @change="setLocal(index, ($event.target as HTMLSelectElement).value)"
      >
        <option value="">{{ t('column') }}</option>
        <option
          v-for="field in freeLocal"
          :key="String(field.id)"
          :value="String(field.id)"
        >
          {{ field.name }}
        </option>
        <option
          v-if="pair.startFieldId !== '' && !freeLocal.some((field) => String(field.id) === String(pair.startFieldId))"
          :value="String(pair.startFieldId)"
        >
          {{ fieldName(table.fields.find((field) => String(field.id) === String(pair.startFieldId))) }}
        </option>
      </select>
      <span :class="styles['pair-arrow']" aria-hidden="true">→</span>
      <select
        :class="styles.select"
        :value="String(pair.endFieldId)"
        :disabled="!targetTable"
        :aria-label="t('edit_panel_foreign_referenced')"
        :data-testid="id('ref', index)"
        @change="setReference(index, ($event.target as HTMLSelectElement).value)"
      >
        <option value="">{{ t('column') }}</option>
        <option
          v-for="field in targetTable?.fields ?? []"
          :key="String(field.id)"
          :value="String(field.id)"
        >
          {{ field.name }}
        </option>
        <option
          v-if="targetField(pair.endFieldId)"
          :value="String(pair.endFieldId)"
        >
          {{ fieldName(targetField(pair.endFieldId)) }}
        </option>
      </select>
      <button
        type="button"
        :class="styles['icon-button']"
        title="↑"
        :data-testid="id('up', index)"
        @click="move(index, -1)"
      >↑</button>
      <button
        type="button"
        :class="styles['icon-button']"
        title="↓"
        :data-testid="id('down', index)"
        @click="move(index, 1)"
      >↓</button>
      <button
        type="button"
        :class="styles['icon-button']"
        :title="t('delete')"
        :data-testid="id('remove', index)"
        @click="remove(index)"
      >×</button>
    </div>
    <button
      type="button"
      :class="styles['add-button']"
      :data-testid="`${prefix}-add-pair`"
      @click="add"
    >
      + {{ t("add") }}
    </button>
  </div>
</template>
