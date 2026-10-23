<script setup lang="ts">
import { computed } from "vue";
import { NButton } from "naive-ui";
import { useDiagramStore } from "../../stores/diagram.ts";
import TypeEditor from "./TypeEditor.vue";

/** The custom types tab of the side panel: the types of the diagram. */

const diagram = useDiagramStore();

const types = computed(() => diagram.types);

function addType(): void {
  diagram.addType({
    name: `type_${types.value.length + 1}`,
    fields: [],
  });
}
</script>

<template>
  <div class="entity-tab" data-testid="types-tab">
    <TypeEditor
      v-for="type in types"
      :key="type.id"
      :type="type"
      :type-key="type.id ?? type.name"
      @rename="diagram.updateType(type.id ?? type.name, { name: $event })"
      @update-comment="diagram.updateType(type.id ?? type.name, { comment: $event })"
      @add-field="diagram.updateType(type.id ?? type.name, { fields: [...(type.fields ?? []), $event] })"
      @update-field="
        diagram.updateType(type.id ?? type.name, {
          fields: type.fields.map((field, position) =>
            position === $event.position ? { ...field, ...$event.updates } : field,
          ),
        })
      "
      @remove-field="
        diagram.updateType(type.id ?? type.name, {
          fields: type.fields.filter((_, position) => position !== $event),
        })
      "
    />

    <NButton
      size="small"
      class="entity-tab__add"
      data-testid="add-type-btn"
      @click="addType"
    >
      Add Type
    </NButton>
  </div>
</template>

<style scoped>
.entity-tab__add {
  margin-top: 8px;
}
</style>
