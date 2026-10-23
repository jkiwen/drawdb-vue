<script setup lang="ts">
import { computed, ref } from "vue";
import { inferRelationships } from "@drawdb/core";
import type { Relationship } from "@drawdb/core";
import { useDiagramStore } from "../../stores/diagram.ts";

defineOptions({ name: "DrawDBAutoRelationshipsDialog" });

/**
 * The dialog that creates the relationships the editor infers.
 *
 * The dialog lists the candidates the inference of the core found and lets
 * the user create them in one batch, which is one entry of the history.
 */
const props = withDefaults(
  defineProps<{
    open?: boolean;
  }>(),
  { open: false },
);

const emit = defineEmits<{
  "update:open": [value: boolean];
}>();

const diagram = useDiagramStore();
const picked = ref<Relationship[]>([]);

const candidates = computed(() =>
  inferRelationships(diagram.diagram.tables, diagram.diagram.relationships),
);

function pick(relationship: Relationship): void {
  picked.value.push(relationship);
}

function apply(): void {
  diagram.applyRelationships(picked.value);
  picked.value = [];
  emit("update:open", false);
}

function close(): void {
  emit("update:open", false);
}
</script>

<template>
  <div
    v-if="props.open"
    class="ddb-auto-relationships"
    data-testid="auto-relationships-dialog"
  >
    <h2 class="ddb-auto-relationships__title">Auto create relationships</h2>
    <p
      v-if="candidates.length === 0"
      class="ddb-auto-relationships__empty"
      data-testid="auto-relationships-empty"
    >
      No foreign key was found
    </p>
    <ul
      v-else
      class="ddb-auto-relationships__list"
      data-testid="auto-relationships-list"
    >
      <li
        v-for="relationship in candidates"
        :key="relationship.id"
        class="ddb-auto-relationships__item"
      >
        <span class="ddb-auto-relationships__name">
          {{ relationship.name }}
        </span>
        <button
          class="ddb-auto-relationships__pick"
          data-testid="auto-relationship-pick"
          type="button"
          @click="pick(relationship)"
        >
          Create
        </button>
      </li>
    </ul>
    <div class="ddb-auto-relationships__actions">
      <button
        class="ddb-auto-relationships__apply"
        data-testid="auto-relationships-apply"
        type="button"
        @click="apply"
      >
        Apply
      </button>
      <button class="ddb-auto-relationships__close" type="button" @click="close">
        Close
      </button>
    </div>
  </div>
</template>

<style scoped>
.ddb-auto-relationships {
  background: var(--ddb-surface, #fff);
  border: 1px solid var(--ddb-border, #d9d9d9);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgb(0 0 0 / 15%);
  display: flex;
  flex-direction: column;
  gap: 8px;
  left: 50%;
  max-height: 80vh;
  max-width: 560px;
  padding: 16px;
  position: fixed;
  top: 10vh;
  transform: translateX(-50%);
  width: 90vw;
  z-index: 30;
}
.ddb-auto-relationships__title {
  font-size: 16px;
  margin: 0;
}
.ddb-auto-relationships__empty {
  color: var(--ddb-muted, #666);
  font-size: 13px;
  margin: 0;
}
.ddb-auto-relationships__list {
  list-style: none;
  margin: 0;
  max-height: 50vh;
  overflow: auto;
  padding: 0;
}
.ddb-auto-relationships__item {
  align-items: center;
  display: flex;
  gap: 8px;
  justify-content: space-between;
  padding: 6px 0;
}
.ddb-auto-relationships__name {
  font-size: 13px;
  word-break: break-word;
}
.ddb-auto-relationships__actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}
.ddb-auto-relationships__pick,
.ddb-auto-relationships__apply,
.ddb-auto-relationships__close {
  border: 1px solid var(--ddb-border, #d9d9d9);
  border-radius: 4px;
  cursor: pointer;
  padding: 4px 10px;
}
</style>
