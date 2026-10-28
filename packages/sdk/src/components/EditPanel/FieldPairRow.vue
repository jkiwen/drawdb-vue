<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { BUILTIN_FAMILIES } from "@drawdb/core";
import type { Table } from "@drawdb/core";
import { t } from "../../i18n/index.ts";
import styles from "./edit-panel.module.css";
import type { FieldPairRow as RowModel } from "./edit-panel-model.ts";
import TypeCombobox from "./TypeCombobox.vue";

/**
 * One field pair of the table editor (design section 4.2): the logical
 * attribute and the physical column side by side — logical name, logical
 * family, physical name, physical type combobox, status badge, remove.
 * In the logical view layer the physical columns collapse to read-only
 * text (prompt rule for viewLayer "logical").
 */
const props = defineProps<{
  table: Table;
  row: RowModel;
  database: string;
  logicalView: boolean;
  focused?: boolean;
}>();

const emit = defineEmits<{
  commitLogicalName: [attributeId: string, value: string];
  commitLogicalFamily: [attributeId: string, family: string];
  commitPhysicalName: [fieldId: string, value: string];
  commitPhysicalType: [fieldId: string, spec: import("@drawdb/core").PhysicalSpec];
  remove: [];
}>();

const logicalNameDraft = ref(props.row.attribute?.name ?? "");
watch(
  () => props.row.attribute?.name,
  (value) => {
    logicalNameDraft.value = value ?? "";
  },
);

const physicalNameDraft = ref(props.row.field?.name ?? "");
watch(
  () => props.row.field?.name,
  (value) => {
    physicalNameDraft.value = value ?? "";
  },
);

const family = computed(() => {
  const ref = props.row.attribute?.logicalType;
  if (!ref) return "";
  return "family" in ref ? ref.family : `domain:${ref.domainId}`;
});

const badge = computed(() => {
  switch (props.row.status) {
    case "missing-logical-name":
      return { class: styles["badge-info"], text: t("edit_panel_badge_no_logical_name") };
    case "diverged":
      return { class: styles["badge-warn"], text: t("edit_panel_badge_diverged") };
    case "logical-only":
      return { class: styles["badge-info"], text: t("edit_panel_badge_logical_only") };
    case "physical-only":
      return { class: styles["badge-info"], text: t("edit_panel_badge_physical_only") };
    default:
      return undefined;
  }
});

const divergedTitle = computed(() => {
  if (props.row.status !== "diverged" || !props.row.suggestion) return undefined;
  const s = props.row.suggestion;
  const params = [s.length, s.precision, s.scale].filter((v) => v !== undefined);
  const suggestion = `${s.type}${params.length ? `(${params.join(",")})` : ""}`;
  return t("edit_panel_suggested", { suggestion });
});

function commitLogicalName(): void {
  if (!props.row.attribute) return;
  emit("commitLogicalName", props.row.attribute.id, logicalNameDraft.value);
}

function commitFamily(event: Event): void {
  if (!props.row.attribute) return;
  const value = (event.target as HTMLSelectElement).value;
  if (value.startsWith("domain:")) return;
  emit("commitLogicalFamily", props.row.attribute.id, value);
}

function commitPhysicalName(): void {
  if (!props.row.field) return;
  emit("commitPhysicalName", String(props.row.field.id), physicalNameDraft.value);
}

function commitType(spec: import("@drawdb/core").PhysicalSpec): void {
  if (!props.row.field) return;
  emit("commitPhysicalType", String(props.row.field.id), spec);
}
</script>

<template>
  <div
    :class="[
      styles.row,
      props.logicalView ? styles['row-logical-view'] : '',
      props.focused ? styles['row-focused'] : '',
    ]"
    data-testid="field-row"
    :data-row-key="props.row.key"
  >
    <input
      v-model="logicalNameDraft"
      :class="styles.input"
      :placeholder="props.row.attribute ? '' : '—'"
      :disabled="!props.row.attribute"
      data-testid="logical-name-input"
      @change="commitLogicalName"
    />
    <select
      :class="styles.select"
      :value="family"
      :disabled="!props.row.attribute"
      data-testid="logical-family-select"
      @change="commitFamily"
    >
      <option v-if="family.startsWith('domain:')" :value="family">
        {{ t("edit_panel_domain_option", { name: family.slice("domain:".length) }) }}
      </option>
      <option v-for="item in BUILTIN_FAMILIES" :key="item.id" :value="item.id">
        {{ t(item.label) }}
      </option>
    </select>
    <template v-if="!props.logicalView">
      <input
        v-model="physicalNameDraft"
        :class="styles.input"
        :placeholder="props.row.field ? '' : '—'"
        :disabled="!props.row.field"
        data-testid="physical-name-input"
        @change="commitPhysicalName"
      />
      <TypeCombobox
        v-if="props.row.field"
        :database="props.database"
        :spec="props.row.field.fieldType"
        testid="physical-type"
        @commit="commitType"
      />
      <span v-else :class="styles['readonly-value']" data-testid="physical-type">—</span>
    </template>
    <template v-else>
      <span :class="styles['readonly-value']" data-testid="physical-name-readonly">
        {{ props.row.field?.name ?? "—" }}
      </span>
      <span :class="styles['readonly-value']" data-testid="physical-type-readonly">
        {{ props.row.field?.fieldType.type ?? "—" }}
      </span>
    </template>
    <span
      v-if="badge"
      :class="[styles.badge, badge.class]"
      :title="divergedTitle"
      data-testid="row-status"
    >
      {{ badge.text }}
    </span>
    <span v-else :class="styles.badge" data-testid="row-status" />
    <button
      type="button"
      :class="styles['icon-button']"
      :title="t('edit_panel_remove_field')"
      data-testid="remove-field"
      @click="emit('remove')"
    >
      ✕
    </button>
  </div>
</template>
