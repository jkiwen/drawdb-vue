<script setup lang="ts">
import type { TypeField } from "@drawdb/core";
import { NButton, NInput } from "naive-ui";
import { ref } from "vue";

/** One field of a custom type: its name, its type and its values. */
const props = defineProps<{
  field: TypeField;
  typeKey: string | number;
  position: number;
}>();

const emit = defineEmits<{
  update: [updates: Partial<TypeField>];
  remove: [];
}>();

const name = ref(String(props.field.name ?? ""));
const type = ref(String(props.field.type ?? ""));
const values = ref((props.field.values ?? []).join(", "));

/** A readable identifier for the test ids of the field. */
const id =
  props.field.id !== undefined
    ? String(props.field.id).replace(/[^A-Za-z0-9_-]/g, "_")
    : `${props.typeKey}_${props.position}`;

function commitName(): void {
  const value = name.value.trim();
  if (value !== props.field.name) emit("update", { name: value });
}

function commitType(): void {
  const value = type.value.trim();
  if (value !== props.field.type) emit("update", { type: value });
}

function commitValues(): void {
  const next = values.value
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (next.join(",") !== (props.field.values ?? []).join(",")) {
    emit("update", { values: next });
  }
}
</script>

<template>
  <div class="type-field" :data-testid="`type-field-${id}`">
    <NInput
      size="tiny"
      :data-testid="`type-field-name-${id}`"
      v-model:value="name"
      @blur="commitName"
      @keyup.enter="commitName"
    />
    <NInput
      size="tiny"
      :data-testid="`type-field-type-${id}`"
      v-model:value="type"
      @blur="commitType"
      @keyup.enter="commitType"
    />
    <NInput
      size="tiny"
      :data-testid="`type-field-values-${id}`"
      v-model:value="values"
      @blur="commitValues"
      @keyup.enter="commitValues"
    />
    <NButton
      size="tiny"
      quaternary
      type="error"
      :data-testid="`remove-type-field-${id}`"
      @click="emit('remove')"
    >
      ✕
    </NButton>
  </div>
</template>
