<script setup lang="ts">
import type { CustomType, TypeField } from "@drawdb/core";
import { NButton, NInput } from "naive-ui";
import { ref } from "vue";
import TypeFieldEditor from "./TypeFieldEditor.vue";

/**
 * One custom type: its name, its comment and the list of its fields.
 *
 * The parent decides what happens when the name changes — the tab of the
 * diagram keeps the id of the type, the tab of the properties of the editor
 * receives the types of the host application and writes them with an event.
 */
const props = defineProps<{
  type: CustomType;
  /** Identifies the type when its id is not available. */
  typeKey: string | number;
}>();

const emit = defineEmits<{
  rename: [name: string];
  "update-comment": [comment: string];
  "add-field": [field: Partial<TypeField>];
  "update-field": [payload: { position: number; updates: Partial<TypeField> }];
  "remove-field": [position: number];
}>();

const name = ref(String(props.type.name ?? ""));
const comment = ref(String(props.type.comment ?? ""));

function commitName(): void {
  const value = name.value.trim();
  if (value && value !== props.type.name) emit("rename", value);
}

function commitComment(): void {
  const value = comment.value;
  if (value !== (props.type.comment ?? "")) emit("update-comment", value);
}

function addField(): void {
  emit("add-field", { name: "", type: "VARCHAR", values: [] });
}

function updateField(position: number, updates: Partial<TypeField>): void {
  emit("update-field", { position, updates });
}

function removeField(position: number): void {
  emit("remove-field", position);
}
</script>

<template>
  <section class="type-editor" :data-testid="`type-editor-${typeKey}`">
    <NInput
      size="small"
      :data-testid="`type-name-${typeKey}`"
      v-model:value="name"
      @blur="commitName"
      @keyup.enter="commitName"
    />
    <NInput
      size="small"
      :data-testid="`type-comment-${typeKey}`"
      v-model:value="comment"
      @blur="commitComment"
      @keyup.enter="commitComment"
    />
    <div class="type-editor__fields">
      <TypeFieldEditor
        v-for="(field, position) in type.fields"
        :key="field.id ?? position"
        :field="field"
        :type-key="typeKey"
        :position="position"
        @update="updateField(position, $event)"
        @remove="removeField(position)"
      />
    </div>
    <NButton
      size="tiny"
      class="type-editor__add"
      :data-testid="`add-field-${typeKey}`"
      @click="addField"
    >
      Add Field
    </NButton>
  </section>
</template>
