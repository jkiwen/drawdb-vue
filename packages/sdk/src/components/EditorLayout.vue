<script setup lang="ts">
import type { PropType } from "vue";
import type { Component } from "vue";
import type { CustomType } from "@drawdb/core";
import Canvas from "./Canvas/Canvas.vue";
import EditorDialogs from "./EditorDialogs.vue";
import Header from "./Header/Header.vue";
import SidePanel from "./SidePanel/SidePanel.vue";

defineOptions({ name: "DrawDBEditorLayout" });

defineProps({
  /** The components the plugins contributed. */
  pluginSlots: {
    type: Object as PropType<Record<string, Component>>,
    default: () => ({}),
  },
  /** Whether the side panel is shown. */
  showSidePanel: { type: Boolean, default: true },
  /** The custom types of the properties of the editor. */
  customTypes: { type: Array as PropType<CustomType[]>, default: () => [] },
});

const emit = defineEmits(["save", "menu"]);
</script>

<template>
  <div class="ddb-editor__layout">
    <Header @save="emit('save')" @menu="emit('menu', $event)" />
    <div class="ddb-editor__body">
      <SidePanel v-if="showSidePanel" class="ddb-editor__side-panel" :custom-types="customTypes" />
      <div class="ddb-editor__canvas">
        <Canvas />
        <component
          v-for="(slot, name) in pluginSlots"
          :key="name"
          :is="slot"
          class="ddb-editor__plugin-slot"
        />
      </div>
    </div>
    <EditorDialogs />
  </div>
</template>

<style scoped>
.ddb-editor__layout {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.ddb-editor__body {
  display: flex;
  flex: 1 1 auto;
  min-height: 0;
}

.ddb-editor__side-panel {
  flex: 0 0 280px;
  overflow: auto;
}

.ddb-editor__canvas {
  position: relative;
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
}

.ddb-editor__plugin-slot {
  position: absolute;
  top: 0;
  right: 0;
}
</style>
