<script setup lang="ts">
import { computed } from "vue";
import type { ImportFormat } from "@drawdb/core";
import { useImportWizardStore } from "../../stores/import-wizard.ts";
import { t } from "../../i18n/index.ts";
import { IMPORT_FORMATS, formatOfFileName } from "./import-wizard-model.ts";
import styles from "./import.module.css";

const wizard = useImportWizardStore();

const chosen = computed(() => IMPORT_FORMATS.find((entry) => entry.format === wizard.format));

function pick(format: ImportFormat): void {
  wizard.setFormat(format);
}

async function loadFile(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file === undefined) return;
  wizard.fileName = file.name;
  wizard.text = await file.text();
  const guessed = formatOfFileName(file.name);
  if (guessed !== undefined) wizard.setFormat(guessed);
}
</script>

<template>
  <section :class="styles.step" data-testid="import-step-source">
    <div :class="styles.formats" role="radiogroup">
      <button
        v-for="entry in IMPORT_FORMATS"
        :key="entry.format"
        type="button"
        role="radio"
        :aria-checked="wizard.format === entry.format"
        :class="[styles.format, wizard.format === entry.format ? styles.formatOn : '']"
        :data-testid="`import-format-${entry.format}`"
        @click="pick(entry.format)"
      >
        {{ t(entry.labelKey) }}
      </button>
    </div>
    <label :class="styles.field">
      <span :class="styles.label">{{ t("wizard_file") }}</span>
      <input
        type="file"
        accept=".sql,.dbml,.json,.xml"
        :class="styles.file"
        data-testid="import-file"
        @change="loadFile"
      />
    </label>
    <p v-if="wizard.fileName" :class="styles.hint" data-testid="import-file-name">
      {{ wizard.fileName }}
    </p>
    <label :class="styles.field">
      <span :class="styles.label">{{ t("wizard_paste") }}</span>
      <textarea
        :class="styles.text"
        data-testid="import-text"
        rows="8"
        :value="wizard.text"
        @input="wizard.text = ($event.target as HTMLTextAreaElement).value"
      ></textarea>
    </label>
    <p :class="styles.hint" data-testid="import-source-hint">
      {{ t("wizard_reading", { format: chosen === undefined ? "" : t(chosen.labelKey), database: wizard.database }) }}
    </p>
    <p v-if="wizard.error" :class="styles.error" data-testid="import-source-error">
      {{ wizard.error }}
    </p>
  </section>
</template>
