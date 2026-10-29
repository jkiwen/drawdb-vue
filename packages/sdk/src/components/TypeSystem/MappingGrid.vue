<script setup lang="ts">
import type { DatabaseType, LogicalTypeFamily } from "@drawdb/core";

import styles from "./type-system.module.css";
import { t } from "../../i18n/index.ts";
import { DIALECTS, DIALECT_LABELS, familyKey, isMapped, mappingParamsOf } from "./type-system-model.ts";

const props = defineProps<{ family: LogicalTypeFamily }>();

const emit = defineEmits<{
  change: [database: DatabaseType, type: string, params: Record<string, number>];
}>();

const params = mappingParamsOf(props.family);

function mappingOf(database: DatabaseType) {
  return props.family.mappings[database];
}

function valueOf(database: DatabaseType, key: "length" | "precision" | "scale"): string {
  const value = mappingOf(database)?.params?.[key];
  return value === undefined ? "" : String(value);
}

function numberOrUndefined(value: string): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function commitType(database: DatabaseType, event: Event): void {
  const value = (event.target as HTMLInputElement).value.trim();
  emit("change", database, value, { ...(mappingOf(database)?.params ?? {}) });
}

function commitParam(
  database: DatabaseType,
  key: "length" | "precision" | "scale",
  event: Event,
): void {
  const next = { ...(mappingOf(database)?.params ?? {}) };
  const parsed = numberOrUndefined((event.target as HTMLInputElement).value);
  if (parsed === undefined) {
    delete next[key];
  } else {
    next[key] = parsed;
  }
  emit("change", database, mappingOf(database)?.type ?? "", next);
}
</script>

<template>
  <div :class="styles.grid" :data-testid="`type-system-grid-${family.id}`">
    <p :class="styles.hint">
      <strong>{{ t(familyKey(family)) }}</strong>
      <span :class="styles.id">{{ family.id }}</span>
    </p>
    <table :class="styles.table">
      <thead>
        <tr>
          <th>{{ t("type_system_dialect") }}</th>
          <th>{{ t("type_system_physical_type") }}</th>
          <th v-if="params.length">{{ t("type_param.length") }}</th>
          <th v-if="params.precision">{{ t("type_param.precision") }}</th>
          <th v-if="params.scale">{{ t("type_param.scale") }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="database in DIALECTS" :key="database">
          <th scope="row">{{ DIALECT_LABELS[database] }}</th>
          <td>
            <input
              :class="styles.input"
              :data-testid="`type-system-type-${family.id}-${database}`"
              :value="mappingOf(database)?.type ?? ''"
              :placeholder="isMapped(family, database) ? '' : t('type_system_unmapped')"
              @change="commitType(database, $event)"
            />
          </td>
          <td v-if="params.length">
            <input
              :class="[styles.input, styles.number]"
              :data-testid="`type-system-length-${family.id}-${database}`"
              type="number"
              min="1"
              :value="valueOf(database, 'length')"
              @change="commitParam(database, 'length', $event)"
            />
          </td>
          <td v-if="params.precision">
            <input
              :class="[styles.input, styles.number]"
              :data-testid="`type-system-precision-${family.id}-${database}`"
              type="number"
              min="1"
              :value="valueOf(database, 'precision')"
              @change="commitParam(database, 'precision', $event)"
            />
          </td>
          <td v-if="params.scale">
            <input
              :class="[styles.input, styles.number]"
              :data-testid="`type-system-scale-${family.id}-${database}`"
              type="number"
              min="0"
              :value="valueOf(database, 'scale')"
              @change="commitParam(database, 'scale', $event)"
            />
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
