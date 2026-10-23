<script setup lang="ts">
import type { Enum } from "@drawdb/core";
import { NButton, NInput } from "naive-ui";
import { ref } from "vue";

/** One enum: its name and the list of its values. */
const props = defineProps<{
  entry: Enum;
}>();

const emit = defineEmits<{
  rename: [name: string];
  "update-values": [values: string[]];
  remove: [];
}>();

const name = ref(String(props.entry.name ?? ""));

function commitName(): void {
  const value = name.value.trim();
  if (value && value !== props.entry.name) emit("rename", value);
}

function updateValues(values: string[]): void {
  if (values.join(",") !== props.entry.values.join(",")) {
    emit("update-values", values);
  }
}

function addValue(): void {
  updateValues([...props.entry.values, `value_${props.entry.values.length + 1}`]);
}

function removeValue(position: number): void {
  updateValues(props.entry.values.filter((_, index) => index !== position));
}

function setValue(position: number, value: string): void {
  updateValues(props.entry.values.map((item, index) => (index === position ? value : item)));
}
</script>

<template>
  <section class="enum-editor" :data-testid="`enum-editor-${entry.name}`">
    <NInput
      size="small"
      :data-testid="`enum-name-${entry.name}`"
      v-model:value="name"
      @blur="commitName"
      @keyup.enter="commitName"
    />
    <div class="enum-editor__values">
      <div
        v-for="(value, position) in entry.values"
        :key="position"
        class="enum-editor__row"
      >
        <NInput
          size="tiny"
          :data-testid="`enum-value-${entry.name}-${position}`"
          :value="value"
          @update:value="setValue(position, $event)"
        />
        <NButton
          size="tiny"
          quaternary
          type="error"
          :data-testid="`remove-enum-value-${entry.name}-${position}`"
          @click="removeValue(position)"
        >
          ✕
        </NButton>
      </div>
    </div>
    <NButton
      size="tiny"
      class="enum-editor__add"
      :data-testid="`add-enum-value-${entry.name}`"
      @click="addValue"
    >
      Add Value
    </NButton>
  </section>
</template>
