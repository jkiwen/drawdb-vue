<script setup lang="ts">
import { computed, ref } from "vue";
import type { PropType } from "vue";
import {
  AREA_DESCRIPTION_MAX_LENGTH,
  AREA_NAME_MAX_LENGTH,
  validateAreaProps,
} from "@drawdb/core";
import type { Area, AreaPropsIssueCode } from "@drawdb/core";
import { useDiagramStore } from "../../stores/diagram.ts";
import { DEFAULT_AREA_OPACITY } from "../../utils/elements.ts";

defineOptions({ name: "DrawDBAreaDetails" });

const props = defineProps({
  area: { type: Object as PropType<Area>, required: true },
  locked: { type: Boolean, default: false },
  /**
   * The place of the panel, in the coordinates of the canvas. The panel hangs
   * below the area, so that it does not cover the area it belongs to.
   */
  x: { type: Number, default: 0 },
  y: { type: Number, default: 0 },
});

defineEmits(["close"]);

const diagram = useDiagramStore();

/** The width of the panel, in canvas units. */
const PANEL_WIDTH = 232;
/** The height of the panel, in canvas units. */
const PANEL_HEIGHT = 208;

const ERROR_MESSAGES: Record<AreaPropsIssueCode, string> = {
  name_required: "The name of the area is required.",
  name_too_long: `The name of the area is limited to ${AREA_NAME_MAX_LENGTH} characters.`,
  description_too_long: `The description of the area is limited to ${AREA_DESCRIPTION_MAX_LENGTH} characters.`,
};

/**
 * The drafts of the name and the description.
 *
 * They are committed when the field loses the focus, so that a rename is one
 * undoable step instead of one step per keystroke — the way the side panel
 * commits the name of a table.
 */
const nameDraft = ref(props.area.name);
const descriptionDraft = ref(props.area.description ?? "");
/** The rules the last commit broke, shown until the next commit. */
const errors = ref<AreaPropsIssueCode[]>([]);

/**
 * The color of the picker. The input of type `color` only takes a hex color,
 * so an area without a color starts from the default one.
 */
const colorDraft = computed(() => props.area.color ?? "#175e7a");

/** The opacity of the slider, as a percentage for the label. */
const opacityDraft = computed(
  () => Math.round((props.area.opacity ?? DEFAULT_AREA_OPACITY) * 100),
);

function commitText(): void {
  const name = nameDraft.value.trim();
  const description = descriptionDraft.value.trim();
  errors.value = validateAreaProps({ name, description });
  if (errors.value.length > 0) {
    return;
  }
  const updates: Partial<Pick<Area, "name" | "description">> = {};
  if (name !== props.area.name) {
    updates.name = name;
  }
  const stored = props.area.description ?? "";
  if (description !== stored) {
    updates.description = description === "" ? undefined : description;
  }
  if (Object.keys(updates).length > 0) {
    diagram.updateArea(props.area.id, updates);
  }
}

/** Applies the color the user picked, as soon as the picker closes. */
function onColorChange(event: Event): void {
  diagram.updateArea(props.area.id, {
    color: (event.target as HTMLInputElement).value,
  });
}

/** Applies the opacity the user dragged to, as soon as the drag ends. */
function onOpacityChange(event: Event): void {
  const value = Number((event.target as HTMLInputElement).value);
  if (Number.isNaN(value)) {
    return;
  }
  diagram.updateArea(props.area.id, { opacity: Math.min(1, Math.max(0, value)) });
}
</script>

<template>
  <!--
    The details of the area are edited in place, in a panel below the title
    bar, so that the user does not have to leave the canvas to rename an area
    or to recolor it. The press inside the panel is stopped so that it neither
    starts the drag of the area nor reaches the canvas.
  -->
  <foreignObject
    :x="x"
    :y="y"
    :width="PANEL_WIDTH"
    :height="PANEL_HEIGHT"
    :data-testid="`area-details-${area.id}`"
  >
    <div
      xmlns="http://www.w3.org/1999/xhtml"
      class="ddb-area-details"
      :class="{ 'is-locked': locked }"
      @pointerdown.stop
    >
      <div class="ddb-area-details__head">
        <span class="ddb-area-details__title">Area details</span>
        <button
          class="ddb-area-details__close"
          type="button"
          :data-testid="`area-details-close-${area.id}`"
          title="Close the details"
          @click="$emit('close')"
        >
          ✕
        </button>
      </div>
      <input
        class="ddb-area-details__input"
        type="text"
        :value="nameDraft"
        :disabled="locked"
        placeholder="Area name"
        :data-testid="`area-details-name-${area.id}`"
        @input="nameDraft = ($event.target as HTMLInputElement).value"
        @blur="commitText"
        @keyup.enter="commitText"
      />
      <textarea
        class="ddb-area-details__textarea"
        :value="descriptionDraft"
        :disabled="locked"
        placeholder="Description"
        rows="2"
        :data-testid="`area-details-description-${area.id}`"
        @input="descriptionDraft = ($event.target as HTMLTextAreaElement).value"
        @blur="commitText"
      ></textarea>
      <p
        v-if="errors.length > 0"
        class="ddb-area-details__error"
        :data-testid="`area-details-error-${area.id}`"
      >
        {{ errors.map((code) => ERROR_MESSAGES[code]).join(" ") }}
      </p>
      <label class="ddb-area-details__row">
        <span>Color</span>
        <input
          type="color"
          :value="colorDraft"
          :disabled="locked"
          :data-testid="`area-details-color-${area.id}`"
          @change="onColorChange"
        />
      </label>
      <label class="ddb-area-details__row">
        <span>Opacity {{ opacityDraft }}%</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          :value="(area.opacity ?? DEFAULT_AREA_OPACITY)"
          :disabled="locked"
          :data-testid="`area-details-opacity-${area.id}`"
          @change="onOpacityChange"
        />
      </label>
    </div>
  </foreignObject>
</template>
