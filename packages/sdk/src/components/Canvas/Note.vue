<script setup lang="ts">
import { computed } from "vue";
import type { PropType } from "vue";
import type { Note } from "@drawdb/core";
import { DEFAULT_NOTE_HEIGHT, DEFAULT_NOTE_WIDTH } from "./geometry.ts";

defineOptions({ name: "DrawDBNoteNode" });

const props = defineProps({
  note: { type: Object as PropType<Note>, required: true },
  selected: { type: Boolean, default: false },
});

const width = computed(() =>
  props.note.width && props.note.width > 0
    ? props.note.width
    : DEFAULT_NOTE_WIDTH,
);

const height = computed(() =>
  props.note.height && props.note.height > 0
    ? props.note.height
    : DEFAULT_NOTE_HEIGHT,
);

const background = computed(() => props.note.color ?? "#fef3c7");
</script>

<template>
  <g
    class="ddb-note"
    :class="{ 'is-selected': selected }"
    :transform="`translate(${note.x} ${note.y})`"
    :data-testid="`note-${note.id}`"
  >
    <foreignObject :width="width" :height="height">
      <div
        xmlns="http://www.w3.org/1999/xhtml"
        class="ddb-note__body"
        :class="{ 'is-selected': selected }"
        :style="{ backgroundColor: background }"
      >
        <div v-if="note.title" class="ddb-note__title">{{ note.title }}</div>
        <div class="ddb-note__content">{{ note.content }}</div>
      </div>
    </foreignObject>
  </g>
</template>
