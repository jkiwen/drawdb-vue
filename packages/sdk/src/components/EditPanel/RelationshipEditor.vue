<script setup lang="ts">
import { ref, watch } from "vue";
import type { LogicalRelationship, Relationship } from "@drawdb/core";
import { t } from "../../i18n/index.ts";
import { useDiagramStore } from "../../stores/diagram.ts";
import styles from "./edit-panel.module.css";
import { commitRelationship } from "./edit-actions.ts";

/**
 * The editor of a single selected relationship: the physical name and
 * the logical name plus the two roles, paired in one grid. The logical
 * entry is created on the first write when the diagram has none yet.
 */
const props = defineProps<{
  relationship: Relationship;
  logical?: LogicalRelationship;
}>();

const store = useDiagramStore();

const physicalName = ref(props.relationship.name ?? "");
const logicalName = ref(props.logical?.name ?? "");
const parentRole = ref(props.logical?.parentRole ?? "");
const childRole = ref(props.logical?.childRole ?? "");

watch(
  () => [props.relationship, props.logical] as const,
  ([relationship, logical]) => {
    physicalName.value = relationship.name ?? "";
    logicalName.value = logical?.name ?? "";
    parentRole.value = logical?.parentRole ?? "";
    childRole.value = logical?.childRole ?? "";
  },
);

function commit(patch: import("./edit-actions.ts").RelationshipPatch): void {
  commitRelationship(store, props.relationship, props.logical, patch);
}
</script>

<template>
  <div :class="styles['pair-grid']" data-testid="relationship-editor">
    <label>
      <span :class="styles.label">{{ t("edit_panel_logical_relationship") }}</span>
      <input
        v-model="logicalName"
        :class="styles.input"
        data-testid="rel-logical-name"
        @change="commit({ logicalName })"
      />
    </label>
    <label>
      <span :class="styles.label">{{ t("edit_panel_physical_fk") }}</span>
      <input
        v-model="physicalName"
        :class="styles.input"
        data-testid="rel-physical-name"
        @change="commit({ physicalName })"
      />
    </label>
    <label>
      <span :class="styles.label">{{ t("edit_panel_parent_role") }}</span>
      <input
        v-model="parentRole"
        :class="styles.input"
        data-testid="rel-parent-role"
        @change="commit({ parentRole })"
      />
    </label>
    <label>
      <span :class="styles.label">{{ t("edit_panel_child_role") }}</span>
      <input
        v-model="childRole"
        :class="styles.input"
        data-testid="rel-child-role"
        @change="commit({ childRole })"
      />
    </label>
  </div>
</template>
