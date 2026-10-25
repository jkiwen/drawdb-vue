<script setup lang="ts">
import { computed, ref } from "vue";
import type { PropType } from "vue";
import type { Note } from "@drawdb/core";
import { useDiagramStore } from "../../stores/diagram.ts";
import { DEFAULT_NOTE_HEIGHT, DEFAULT_NOTE_WIDTH } from "./geometry.ts";
import type { ResizeState } from "./interactions/interaction-state.ts";

defineOptions({ name: "DrawDBNoteNode" });

const props = defineProps({
  note: { type: Object as PropType<Note>, required: true },
  selected: { type: Boolean, default: false },
  /**
   * The resize that runs on the canvas, or `null`. The note draws the size of
   * the drag that holds its corner before the release stores the size in the
   * diagram, the way an area follows the corner of its own resize.
   */
  resizing: { type: Object as PropType<ResizeState | null>, default: null },
});

const emit = defineEmits(["dragstart", "resizestart"]);

const diagram = useDiagramStore();

/** The side of the square that resizes the note, in canvas units. */
const RESIZE_HANDLE_SIZE = 12;

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

/** Whether the user locked the note, so that it cannot be changed any more. */
const locked = computed(() => props.note.locked === true);

/** The size of the drag that holds the corner of this note, or `null`. */
const drag = computed(() => {
  const resizing = props.resizing;
  if (!resizing || resizing.kind !== "note") {
    return null;
  }
  return String(resizing.id) === String(props.note.id) ? resizing : null;
});

/** The size the note is drawn with: the one of the drag, or the stored one. */
const size = computed(() => {
  const dragSize = drag.value;
  return {
    width: dragSize?.width ?? width.value,
    height: dragSize?.height ?? height.value,
  };
});

/** The corner of the note that the handle sits in. */
const handle = computed(() => ({
  x: size.value.width - RESIZE_HANDLE_SIZE,
  y: size.value.height - RESIZE_HANDLE_SIZE,
}));

/** Whether the user is writing in the title or in the content of the note. */
const editingTitle = ref(false);
const editingContent = ref(false);
const titleDraft = ref("");
const contentDraft = ref("");

/**
 * Selects the note and starts the drag that moves it.
 *
 * The event does not reach the canvas, which would clear the selection and
 * start a pan instead. A drag with the shift key is left to the canvas, which
 * draws the rectangle that selects several elements. A note that the user
 * locked does not move at all.
 */
function onPointerDown(event: PointerEvent): void {
  if (event.shiftKey || locked.value) {
    return;
  }
  event.stopPropagation();
  emit("dragstart", { noteId: props.note.id, event });
}

/**
 * Starts the drag of the note when the user presses the content.
 *
 * The text of the note is written in place, so the press has to reach the
 * field. The drag of the note still starts, because the note holds the press
 * and the writing only begins when the pointer does not move.
 */
function onContentPointerDown(event: PointerEvent): void {
  if (locked.value) {
    return;
  }
  event.stopPropagation();
  onPointerDown(event);
}

/**
 * Starts the drag of the note when the user presses the title.
 *
 * The title is written in place, the same way the content is.
 */
function onTitlePointerDown(event: PointerEvent): void {
  if (locked.value) {
    return;
  }
  event.stopPropagation();
  onPointerDown(event);
}
/** Starts the resize of the note, the way the handle of a table does. */
function onResizeStart(event: PointerEvent): void {
  if (locked.value) {
    return;
  }
  event.stopPropagation();
  emit("resizestart", {
    noteId: props.note.id,
    width: size.value.width,
    height: size.value.height,
    event,
  });
}

/**
 * Keeps the draft of the title in step with what the user writes.
 */
function onTitleInput(event: Event): void {
  titleDraft.value = (event.target as HTMLInputElement).value;
}

/**
 * Writes the title of the note.
 *
 * The title is written in the note itself, so the user does not have to leave
 * the canvas to name a note.
 */
function onCommitTitle(): void {
  const title = titleDraft.value.trim();
  editingTitle.value = false;
  if (!locked.value && title !== props.note.title) {
    diagram.updateNote(props.note.id, { title });
  }
}

/** Writes the content of the note. */
function onCommitContent(): void {
  const content = contentDraft.value;
  editingContent.value = false;
  if (!locked.value && content !== props.note.content) {
    diagram.updateNote(props.note.id, { content });
  }
}

/**
 * Keeps the draft of the content in step with what the user writes.
 *
 * The content is written into the diagram when the field loses the focus, so
 * that the history holds one entry for the whole text and not one for every
 * letter.
 */
function onContentInput(event: Event): void {
  contentDraft.value = (event.target as HTMLTextAreaElement).value;
}

/** Locks the note, or unlocks it, the way the lock of a table does. */
function onToggleLock(): void {
  diagram.updateNote(props.note.id, { locked: !locked.value });
}
</script>

<template>
  <g
    class="ddb-note"
    :class="{ 'is-selected': selected, 'is-locked': locked }"
    :transform="`translate(${note.x} ${note.y})`"
    :data-testid="`note-${note.id}`"
    @pointerdown="onPointerDown"
  >
    <foreignObject :width="size.width" :height="size.height">
      <div
        xmlns="http://www.w3.org/1999/xhtml"
        class="ddb-note__body"
        :class="{ 'is-selected': selected, 'is-locked': locked }"
        :style="{ backgroundColor: background }"
      >
        <div class="ddb-note__head">
          <input
            v-if="editingTitle"
            class="ddb-note__title-input"
            :data-testid="`note-title-input-${note.id}`"
            :value="titleDraft"
            @input="onTitleInput"
            @blur="onCommitTitle"
            @keyup.enter="onCommitTitle"
            @pointerdown="onTitlePointerDown"
          />
          <span
            v-else
            class="ddb-note__title"
            :data-testid="`note-title-${note.id}`"
            @dblclick="editingTitle = !locked"
            >{{ note.title }}</span
          >
          <button
            v-if="!locked"
            class="ddb-note__lock"
            type="button"
            :data-testid="`note-lock-toggle-${note.id}`"
            :title="locked ? 'Unlock the note' : 'Lock the note'"
            @pointerdown.stop
            @click="onToggleLock"
          >
            {{ locked ? "🔒" : "🔓" }}
          </button>
        </div>
        <textarea
          v-if="!locked"
          class="ddb-note__content-input"
          :data-testid="`note-content-${note.id}`"
          :value="note.content"
          placeholder="Write a note…"
          @input="onContentInput"
          @blur="onCommitContent"
          @pointerdown="onContentPointerDown"
        ></textarea>
        <div v-else class="ddb-note__content">{{ note.content }}</div>
      </div>
    </foreignObject>
    <g
      v-if="!locked"
      class="ddb-note__resize"
      :data-testid="`note-resize-handle-${note.id}`"
      :transform="`translate(${handle.x} ${handle.y})`"
      @pointerdown="onResizeStart"
    >
      <rect
        class="ddb-note__resize-box"
        :width="RESIZE_HANDLE_SIZE"
        :height="RESIZE_HANDLE_SIZE"
      />
      <path class="ddb-note__resize-lines" d="M0 4 L4 0 M0 8 L8 0 M0 12 L12 0" />
    </g>
  </g>
</template>
