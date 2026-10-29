<script setup lang="ts">
import type { DatabaseType, LogicalTypeFamily } from "@drawdb/core";

import styles from "./type-system.module.css";
import { t } from "../../i18n/index.ts";
import MappingGrid from "./MappingGrid.vue";
import { familyKey } from "./type-system-model.ts";

const props = defineProps<{
  families: LogicalTypeFamily[];
  selected: string;
}>();

const emit = defineEmits<{
  select: [familyId: string];
  change: [database: DatabaseType, type: string, params: Record<string, number>];
}>();

const current = (): LogicalTypeFamily | null =>
  props.families.find((family) => family.id === props.selected) ?? props.families[0] ?? null;
</script>

<template>
  <aside :class="styles.nav">
    <button
      v-for="family in families"
      :key="family.id"
      type="button"
      :class="[styles.navItem, selected === family.id && styles.navItemOn]"
      :data-testid="`type-system-family-${family.id}`"
      @click="emit('select', family.id)"
    >
      {{ t(familyKey(family)) }}
    </button>
  </aside>
  <section v-if="current()" :class="styles.content">
    <MappingGrid :family="current()!" @change="(database, type, params) => emit('change', database, type, params)" />
  </section>
</template>
