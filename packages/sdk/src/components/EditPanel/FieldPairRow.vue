<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { BUILTIN_FAMILIES } from "@drawdb/core";
import type { DatabaseType, Table } from "@drawdb/core";
import { t } from "../../i18n/index.ts";
import styles from "./edit-panel.module.css";
import type { FieldPairRow as RowModel } from "./edit-panel-model.ts";
import { sourceKey } from "./edit-panel-groups.ts";
import TypeCombobox from "./TypeCombobox.vue";

/**
 * One field pair of the table editor (design section 4.2, review issue 1):
 * a card that shows the pair on one summary line and the four editable
 * values on two lines underneath — logical attribute, logical type,
 * physical column, physical type — so nothing has to be squeezed into a
 * column narrow enough to cut the type in half. The card folds to its
 * summary line, which keeps a table of thirty fields readable. In the
 * logical view layer the physical half of the body is read-only text
 * (prompt rule for viewLayer "logical").
 */
const props = defineProps<{
  table: Table;
  row: RowModel;
  database: DatabaseType;
  logicalView: boolean;
  focused?: boolean;
}>();

const emit = defineEmits<{
  commitLogicalName: [attributeId: string, value: string];
  commitLogicalFamily: [attributeId: string, family: string];
  commitPhysicalName: [fieldId: string, value: string];
  commitPhysicalType: [fieldId: string, spec: import("@drawdb/core").PhysicalSpec];
  commitPrimary: [fieldId: string, on: boolean];
  remove: [];
}>();

const open = ref(true);

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
  return "family" in ref ? (ref.family ?? "") : `domain:${ref.domainId}`;
});

const summary = computed(
  () => props.row.attribute?.name || props.row.field?.name || "—",
);
const typeSummary = computed(() => {
  const spec = props.row.field?.fieldType;
  if (!spec) return "";
  const params = [spec.length, spec.precision, spec.scale].filter(
    (value) => value !== undefined,
  );
  return `${spec.type}${params.length ? `(${params.join(",")})` : ""}`;
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

/**
 * Whether the column is part of the primary key. The key object lives on the
 * table, so the logical view layer shows the value read-only, the way it
 * shows the other physical values.
 */
const primary = computed(() => {
  const fieldId = props.row.field?.id;
  if (fieldId === undefined) return false;
  return (props.table.primaryKey?.columns ?? []).some(
    (column) => String(column.fieldId) === String(fieldId),
  );
});

function commitPrimary(event: Event): void {
  if (!props.row.field) return;
  emit("commitPrimary", String(props.row.field.id), (event.target as HTMLInputElement).checked);
}
</script>

<template>
  <section
    :class="[styles['field-card'], props.focused ? styles['field-card-focused'] : '']"
    data-testid="field-row"
    :data-row-key="props.row.key"
    :data-open="open ? 'true' : 'false'"
  >
    <header :class="styles['field-card-head']" @click="open = !open">
      <span :class="styles['field-card-caret']" aria-hidden="true">{{ open ? "▾" : "▸" }}</span>
      <span :class="styles['field-card-title']" data-testid="field-summary">{{ summary }}</span>
      <span :class="styles['field-card-type']">{{ typeSummary }}</span>
      <span :class="styles['status-cell']" data-testid="row-status">
        <span v-if="badge" :class="[styles.badge, badge.class]" :title="divergedTitle">
          {{ badge.text }}
        </span>
        <span
          v-if="props.row.field"
          :class="styles['badge-source']"
          :title="t(sourceKey(props.row.field.fieldTypeSource))"
          data-testid="source-badge"
        >
          {{ t(sourceKey(props.row.field.fieldTypeSource)) }}
        </span>
      </span>
      <button
        type="button"
        :class="[styles['link-button'], styles['link-button--muted']]"
        :title="t('edit_panel_remove_field')"
        data-testid="remove-field"
        @click.stop="emit('remove')"
      >
        ✕
      </button>
    </header>
    <div v-if="open" :class="styles['field-card-body']">
      <label :class="styles['field']">
        <span :class="styles.label">{{ t("edit_panel_logical_attribute") }}</span>
        <input
          v-model="logicalNameDraft"
          :class="styles.input"
          :placeholder="props.row.attribute ? '' : '—'"
          :disabled="!props.row.attribute"
          data-testid="logical-name-input"
          @change="commitLogicalName"
        />
      </label>
      <label :class="styles['field']">
        <span :class="styles.label">{{ t("edit_panel_logical_type") }}</span>
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
      </label>
      <label :class="styles['field']">
        <span :class="styles.label">{{ t("edit_panel_physical_column") }}</span>
        <input
          v-if="!props.logicalView"
          v-model="physicalNameDraft"
          :class="styles.input"
          :placeholder="props.row.field ? '' : '—'"
          :disabled="!props.row.field"
          data-testid="physical-name-input"
          @change="commitPhysicalName"
        />
        <span v-else :class="styles['readonly-value']" data-testid="physical-name-readonly">
          {{ props.row.field?.name ?? "—" }}
        </span>
      </label>
      <label :class="styles['field']">
        <span :class="styles.label">{{ t("edit_panel_physical_type") }}</span>
        <template v-if="!props.logicalView">
          <TypeCombobox
            v-if="props.row.field"
            :database="props.database"
            :spec="props.row.field.fieldType"
            testid="physical-type"
            @commit="commitType"
          />
          <span v-else :class="styles['readonly-value']" data-testid="physical-type">—</span>
        </template>
        <span v-else :class="styles['readonly-value']" data-testid="physical-type-readonly">
          {{ props.row.field?.fieldType.type ?? "—" }}
        </span>
      </label>
      <label :class="[styles.field, styles['field-wide']]">
        <span :class="styles.label">{{ t("primary_key") }}</span>
        <input
          v-if="!props.logicalView"
          type="checkbox"
          :class="styles.check"
          :checked="primary"
          :disabled="!props.row.field"
          :data-testid="props.row.field ? `field-primary-${String(props.row.field.id)}` : undefined"
          @change="commitPrimary"
        />
        <span v-else :class="styles['readonly-value']" data-testid="field-primary-readonly">
          {{ primary ? "✓" : "—" }}
        </span>
      </label>
    </div>
  </section>
</template>
