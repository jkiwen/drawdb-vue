<script setup lang="ts">
/**
 * The print preview (ruling Q8): the sheet the browser prints, page by page.
 *
 * The preview is deliberately a paginated sheet and not the canvas at a
 * smaller zoom — a reader checks that the tables fit a page, not that the
 * diagram looks right. `window.print` does the printing, so the dialog only
 * has to lay the pages out and let a reader walk them.
 */
import { computed, ref, watch } from "vue";
import type { Table } from "@drawdb/core";
import { t } from "../../i18n/index.ts";
import { A4, PRINT_MARGIN, printPages } from "./print-layout.ts";
import classes from "./print.module.css";

const props = withDefaults(
  defineProps<{
    open: boolean;
    tables: Table[];
  }>(),
  { tables: () => [] },
);

const emit = defineEmits<{ "update:open": [value: boolean] }>();

const pages = computed(() => printPages(props.tables));
const page = ref(0);

/** Closes the dialog, which the host mirrors through its own open state. */
function close(): void {
  emit("update:open", false);
}

/** Steps through the pages, wrapping at either end. */
function step(delta: number): void {
  const total = pages.value.length;
  if (total === 0) return;
  page.value = (page.value + delta + total) % total;
}

/** Hands the sheet to the browser; the dialog stays open behind the dialog of the browser. */
function print(): void {
  if (typeof window !== "undefined" && typeof window.print === "function") {
    window.print();
  }
}

watch(
  () => [props.open, pages.value.length],
  () => {
    page.value = 0;
  },
);
</script>

<template>
  <div v-if="open" :class="classes.backdrop" data-testid="print-preview">
    <section :class="classes.sheet" role="dialog" :aria-label="t('file_print_preview')">
      <header :class="classes.header">
        <h2 :class="classes.title">{{ t("file_print_preview") }}</h2>
        <div :class="classes.actions">
          <button type="button" :class="classes.button" data-testid="print-previous" @click="step(-1)">
            ‹
          </button>
          <span :class="classes.counter" data-testid="print-page">
            {{ pages.length === 0 ? 0 : page + 1 }} / {{ pages.length }}
          </span>
          <button type="button" :class="classes.button" data-testid="print-next" @click="step(1)">
            ›
          </button>
          <button type="button" :class="[classes.button, classes.primary]" data-testid="print-run" @click="print">
            {{ t("file_print") }}
          </button>
          <button type="button" :class="classes.button" data-testid="print-close" @click="close">
            {{ t("close") }}
          </button>
        </div>
      </header>

      <p v-if="pages.length === 0" :class="classes.empty" data-testid="print-empty">
        {{ t("edit_panel_empty_none") }}
      </p>

      <div v-else :class="classes.pages">
        <div
          :class="classes.page"
          :style="{
            width: `${A4.width}px`,
            height: `${A4.height}px`,
            padding: `${PRINT_MARGIN}px`,
          }"
          data-testid="print-sheet"
        >
          <article
            v-for="box of pages[page]?.boxes ?? []"
            :key="String(box.table.id)"
            :class="classes.box"
            :style="{
              left: `${box.x}px`,
              top: `${box.y}px`,
              width: `${box.width}px`,
              height: `${box.height}px`,
            }"
            :data-testid="`print-box-${box.table.id}`"
          >
            <h3 :class="classes.boxTitle">{{ box.table.name }}</h3>
            <p v-for="(line, at) of box.lines" :key="at" :class="classes.boxLine">{{ line }}</p>
          </article>
        </div>
      </div>
    </section>
  </div>
</template>
