<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { PhysicalSpec } from "@drawdb/core";
import { t } from "../../i18n/index.ts";
import styles from "./edit-panel.module.css";
import { filterTypeOptions, typeParamVisibility } from "./edit-panel-model.ts";

/**
 * The physical type editor of a field row (spec section 7.4): a text
 * input backed by the dialect whitelist (datalist, incremental match),
 * free text stays possible — the lint layer, not this control, judges
 * unknown names. The parameter inputs follow the metadata of the current
 * type (isSized → length, hasPrecision → precision/scale).
 */
const props = defineProps<{
  database: string;
  spec: PhysicalSpec;
  testid?: string;
}>();

const emit = defineEmits<{
  commit: [spec: PhysicalSpec];
}>();

const typeDraft = ref(props.spec.type);
watch(
  () => props.spec.type,
  (value) => {
    typeDraft.value = value;
  },
);

const listId = `ddb-type-list-${Math.random().toString(36).slice(2)}`;

const options = computed(() => filterTypeOptions(props.database, typeDraft.value));

const params = computed(() => typeParamVisibility(props.database, typeDraft.value));

function commitType(): void {
  const type = typeDraft.value.trim();
  if (type === "" || type === props.spec.type) return;
  // Drop the parameters the new type cannot carry.
  const visible = typeParamVisibility(props.database, type);
  emit("commit", {
    type,
    length: visible.length ? props.spec.length : undefined,
    precision: visible.precision ? props.spec.precision : undefined,
    scale: visible.scale ? props.spec.scale : undefined,
  });
}

function parseParam(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (trimmed === "") return undefined;
  const value = Number(trimmed);
  return Number.isInteger(value) && value >= 0 ? value : undefined;
}

function commitParam(key: "length" | "precision" | "scale", event: Event): void {
  const value = parseParam((event.target as HTMLInputElement).value);
  if (value === props.spec[key]) return;
  emit("commit", { ...props.spec, [key]: value });
}
</script>

<template>
  <div :class="styles['type-cell']" :data-testid="props.testid">
    <input
      v-model="typeDraft"
      :class="styles.input"
      :list="listId"
      data-testid="type-input"
      @change="commitType"
    />
    <datalist :id="listId">
      <option v-for="option in options" :key="option" :value="option" />
    </datalist>
    <div v-if="params.length || params.precision || params.scale" :class="styles.params">
      <input
        v-if="params.length"
        :class="styles.param"
        :value="props.spec.length ?? ''"
        :placeholder="t('edit_panel_param_len')"
        data-testid="type-length"
        @change="commitParam('length', $event)"
      />
      <input
        v-if="params.precision"
        :class="styles.param"
        :value="props.spec.precision ?? ''"
        :placeholder="t('edit_panel_param_precision')"
        data-testid="type-precision"
        @change="commitParam('precision', $event)"
      />
      <input
        v-if="params.scale"
        :class="styles.param"
        :value="props.spec.scale ?? ''"
        :placeholder="t('edit_panel_param_scale')"
        data-testid="type-scale"
        @change="commitParam('scale', $event)"
      />
    </div>
  </div>
</template>
