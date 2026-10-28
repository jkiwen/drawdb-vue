<script setup lang="ts">
import { ref, watch } from "vue";
import type { Area } from "@drawdb/core";
import { t } from "../../i18n/index.ts";
import { useDiagramStore } from "../../stores/diagram.ts";
import styles from "./edit-panel.module.css";
import { commitAreaName } from "./edit-actions.ts";

/** The editor of a single selected subject area: just its name. */
const props = defineProps<{
  area: Area;
}>();

const store = useDiagramStore();

const name = ref(props.area.name);
watch(
  () => props.area,
  (area) => {
    name.value = area.name;
  },
);
</script>

<template>
  <div :class="styles['pair-grid']" data-testid="area-editor">
    <label>
      <span :class="styles.label">{{ t("edit_panel_area_name") }}</span>
      <input
        v-model="name"
        :class="styles.input"
        data-testid="area-name"
        @change="commitAreaName(store, String(props.area.id), name)"
      />
    </label>
  </div>
</template>
