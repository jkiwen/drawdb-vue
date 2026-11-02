<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { NButton, NEmpty, NInput, NTag } from "naive-ui";
import {
  AREA_DESCRIPTION_MAX_LENGTH,
  AREA_NAME_MAX_LENGTH,
  validateAreaProps,
} from "@drawdb/core";
import type { Area, AreaPropsIssueCode } from "@drawdb/core";
import { useDiagramStore } from "../../stores/diagram.ts";
import { useUIStore } from "../../stores/ui.ts";
import { t } from "../../i18n/index.ts";

/** The areas tab of the side panel. */

const diagram = useDiagramStore();
const ui = useUIStore();

const areas = computed(() => diagram.areas);

const ERROR_MESSAGES: Record<AreaPropsIssueCode, string> = {
  name_required: "The name of the area is required.",
  name_too_long: `The name of the area is limited to ${AREA_NAME_MAX_LENGTH} characters.`,
  description_too_long: `The description of the area is limited to ${AREA_DESCRIPTION_MAX_LENGTH} characters.`,
};

/** The id of the area whose name and description are being edited. */
const editingId = ref<string | null>(null);
const draft = reactive({ name: "", description: "" });
/** The rules the current draft breaks, shown until the next edit. */
const errors = ref<AreaPropsIssueCode[]>([]);

function isEditing(area: Area): boolean {
  return editingId.value === String(area.id);
}

function startEdit(area: Area): void {
  editingId.value = String(area.id);
  draft.name = area.name;
  draft.description = area.description ?? "";
  errors.value = [];
}

function cancelEdit(): void {
  editingId.value = null;
  errors.value = [];
}

function saveEdit(): void {
  if (editingId.value === null) {
    return;
  }
  const name = draft.name.trim();
  const description = draft.description.trim();
  errors.value = validateAreaProps({ name, description });
  if (errors.value.length > 0) {
    return;
  }
  diagram.updateArea(editingId.value, {
    name,
    description: description === "" ? undefined : description,
  });
  editingId.value = null;
}
</script>

<template>
  <div class="entity-tab">
    <ul class="entity-tab__list" data-testid="areas-list">
      <li v-for="area in areas" :key="area.id">
        <template v-if="!isEditing(area)">
          <div class="entity-tab__summary">
            <NButton
              text
              block
              :type="
                ui.selectedAreaIds.includes(String(area.id)) ? 'primary' : 'default'
              "
              :data-testid="`area-item-${area.id}`"
              @click="ui.selectArea(String(area.id))"
            >
              {{ area.name || "Untitled area" }}
            </NButton>
            <span
              v-if="area.description"
              class="entity-tab__description"
              :data-testid="`area-description-${area.id}`"
            >
              {{ area.description }}
            </span>
          </div>
          <template v-if="area.locked === true">
            <NTag
              size="tiny"
              :bordered="false"
              :data-testid="`locked-area-tag-${area.id}`"
            >
              Locked
            </NTag>
          </template>
          <template v-else>
            <NButton
              size="tiny"
              quaternary
              :data-testid="`edit-area-${area.id}`"
              @click="startEdit(area)"
            >
              ✎
            </NButton>
            <NButton
              size="tiny"
              quaternary
              type="error"
              :data-testid="`remove-area-${area.id}`"
              @click="diagram.removeEntity('areas', area.id)"
            >
              ✕
            </NButton>
          </template>
        </template>

        <div v-else class="entity-tab__editor">
          <NInput
            :value="draft.name"
            :placeholder="t('edit_panel_area_name')"
            :status="errors.length > 0 ? 'error' : undefined"
            :data-testid="`area-name-input-${area.id}`"
            @update:value="draft.name = $event"
          />
          <NInput
            :value="draft.description"
            type="textarea"
            :placeholder="t('edit_panel_description')"
            :rows="2"
            :data-testid="`area-description-input-${area.id}`"
            @update:value="draft.description = $event"
          />
          <p
            v-if="errors.length > 0"
            class="entity-tab__error"
            :data-testid="`area-error-${area.id}`"
          >
            {{ errors.map((code) => ERROR_MESSAGES[code]).join(" ") }}
          </p>
          <div class="entity-tab__actions">
            <NButton
              size="tiny"
              type="primary"
              :data-testid="`save-area-${area.id}`"
              @click="saveEdit"
            >
              Save
            </NButton>
            <NButton
              size="tiny"
              quaternary
              :data-testid="`cancel-area-${area.id}`"
              @click="cancelEdit"
            >
              Cancel
            </NButton>
          </div>
        </div>
      </li>
    </ul>

    <NEmpty v-if="areas.length === 0" :description="t('no_areas')" />
  </div>
</template>

<style scoped>
.entity-tab__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--ddb-space-1);
}

.entity-tab__list li {
  display: flex;
  align-items: center;
  gap: var(--ddb-space-2);
  padding: var(--ddb-space-1) var(--ddb-space-2);
  border-radius: var(--ddb-radius-md);
  transition: background-color var(--ddb-duration-fast) var(--ddb-easing);
}

.entity-tab__list li:hover {
  background: var(--ddb-surface-hover);
}

.entity-tab__summary {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.entity-tab__description {
  font-size: var(--ddb-text-meta);
  color: var(--ddb-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.entity-tab__editor {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--ddb-space-2);
}

.entity-tab__error {
  margin: 0;
  font-size: var(--ddb-text-meta);
  color: var(--ddb-danger, #d03050);
}

.entity-tab__actions {
  display: flex;
  gap: var(--ddb-space-2);
}
</style>
