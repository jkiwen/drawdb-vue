<script setup lang="ts">
import { computed } from "vue";
import { NButton } from "naive-ui";
import { useDiagramStore } from "../../stores/diagram.ts";
import EnumEditor from "./EnumEditor.vue";
import { t } from "../../i18n/index.ts";

/** The enums tab of the side panel. */

const diagram = useDiagramStore();

const enums = computed(() => diagram.enums);

function addEnum(): void {
  diagram.addEnum({
    name: `enum_${enums.value.length + 1}`,
    values: ["value_1"],
  });
}
</script>

<template>
  <div class="entity-tab" data-testid="enums-tab">
    <EnumEditor
      v-for="entry in enums"
      :key="entry.name"
      :entry="entry"
      @rename="diagram.updateEnum(entry.name, { name: $event })"
      @update-values="diagram.updateEnum(entry.name, { values: $event })"
      @remove="diagram.removeEnum(entry.name)"
    />

    <NButton
      size="small"
      class="entity-tab__add"
      data-testid="add-enum-btn"
      @click="addEnum"
    >
      {{ t('add_enum') }}
    </NButton>
  </div>
</template>

<style scoped>
.entity-tab__add {
  margin-top: var(--ddb-space-3);
  width: 100%;
}
</style>
