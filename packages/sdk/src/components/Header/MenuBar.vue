<script setup lang="ts">
import { NButton, NDropdown } from "naive-ui";
import type { PropType } from "vue";
import { DEFAULT_MENU_GROUPS } from "./types.ts";
import type { MenuBarGroup } from "./types.ts";

/**
 * The menu bar of the editor.
 *
 * The entries are described by the `groups` property, the component itself
 * only reports the selected entry through the `select` event.
 */
const props = defineProps({
  groups: {
    type: Array as PropType<MenuBarGroup[]>,
    default: () => DEFAULT_MENU_GROUPS,
  },
});

const emit = defineEmits<{
  (event: "select", key: string): void;
}>();

function onSelect(groupKey: string, itemKey: string): void {
  emit("select", `${groupKey}:${itemKey}`);
}
</script>

<template>
  <nav data-testid="menu-bar" class="menu-bar">
    <NDropdown
      v-for="group in props.groups"
      :key="group.key"
      trigger="click"
      :options="group.items"
      @select="onSelect(group.key, $event)"
    >
      <NButton
        text
        size="small"
        :data-testid="`menu-${group.key}`"
        class="menu-bar__entry"
      >
        {{ group.label }}
      </NButton>
    </NDropdown>
  </nav>
</template>

<style scoped>
.menu-bar {
  display: flex;
  align-items: center;
  gap: 2px;
}

.menu-bar__entry {
  font-weight: 500;
}
</style>
