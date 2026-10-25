<script setup lang="ts">
import { computed } from "vue";
import type { PropType } from "vue";
import type { CustomType } from "@drawdb/core";
import { NButton, NEmpty } from "naive-ui";
import TypeEditor from "./TypeEditor.vue";

/**
 * The custom types tab of the properties of the editor.
 *
 * The types of the host application are written with an event: the editor
 * never changes them on its own, because they belong to the caller.
 */

const props = defineProps({
  customTypes: { type: Array as PropType<CustomType[]>, default: () => [] },
});

const emit = defineEmits(["add", "rename", "update-comment", "update", "remove"]);

const types = computed(() => props.customTypes);

function keyOf(type: { id?: string | number; name: string }, index: number): string | number {
  return type.id ?? type.name ?? index;
}

function addType(): void {
  emit("add", { name: `type_${types.value.length + 1}`, fields: [] });
}

function update(index: number, updates: Record<string, unknown>): void {
  emit("update", index, updates);
}
</script>

<template>
  <div class="entity-tab" data-testid="customtypes-tab">
    <TypeEditor
      v-for="(type, index) in types"
      :key="keyOf(type, index)"
      :type="type"
      :type-key="keyOf(type, index)"
      @rename="emit('rename', index, $event)"
      @update-comment="emit('update-comment', index, $event)"
      @add-field="update(index, { fields: [...(type.fields ?? []), $event] })"
      @update-field="
        update(index, {
          fields: (type.fields ?? []).map((field, position) =>
            position === $event.position ? { ...field, ...$event.updates } : field,
          ),
        })
      "
      @remove-field="update(index, { fields: (type.fields ?? []).filter((_, position) => position !== $event) })"
    />

    <NEmpty v-if="types.length === 0" description="No custom types" />

    <NButton size="small" class="entity-tab__add" data-testid="add-custom-type-btn" @click="addType">
      Add Custom Type
    </NButton>
  </div>
</template>

<style scoped>
.entity-tab__add {
  margin-top: var(--ddb-space-3);
  width: 100%;
}
</style>
