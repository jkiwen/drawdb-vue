<script setup lang="ts">
import { computed } from "vue";
import { useImportWizardStore } from "../../stores/import-wizard.ts";
import { IMPORT_STEPS, stepIndex } from "./import-wizard-model.ts";
import ImportApplyStep from "./ImportApplyStep.vue";
import ImportConflictStep from "./ImportConflictStep.vue";
import ImportReportStep from "./ImportReportStep.vue";
import ImportSourceStep from "./ImportSourceStep.vue";
import ImportTargetStep from "./ImportTargetStep.vue";
import styles from "./import.module.css";

// TODO(i18n): English until P8 task 8.
defineOptions({ name: "DrawDBImportWizard" });

const wizard = useImportWizardStore();
const current = computed(() => stepIndex(wizard.step));
const isLast = computed(() => wizard.step === "conflict");

const LABELS: Record<(typeof IMPORT_STEPS)[number], string> = {
  source: "Source",
  report: "Report",
  target: "Where",
  conflict: "Decisions",
  apply: "Done",
};

/** The conflict step is where the import happens; earlier steps only move. */
function primary(): void {
  if (wizard.step === "conflict") {
    wizard.apply();
    return;
  }
  wizard.advance();
}

function cancel(): void {
  wizard.close();
}
</script>

<template>
  <div v-if="wizard.open" :class="styles.wizard" data-testid="import-wizard">
    <h2 :class="styles.title">Import a diagram</h2>
    <ol :class="styles.steps">
      <li
        v-for="(name, index) in IMPORT_STEPS"
        :key="name"
        :class="[styles.stepName, index === current ? styles.stepNameOn : '']"
        :data-testid="`import-stepper-${name}`"
      >
        {{ LABELS[name] }}
      </li>
    </ol>
    <div :class="styles.body">
      <ImportSourceStep v-if="wizard.step === 'source'" />
      <ImportReportStep v-else-if="wizard.step === 'report'" />
      <ImportTargetStep v-else-if="wizard.step === 'target'" />
      <ImportConflictStep v-else-if="wizard.step === 'conflict'" />
      <ImportApplyStep v-else />
    </div>
    <div :class="styles.actions">
      <button
        v-if="wizard.step === 'apply'"
        type="button"
        :class="styles.button"
        data-testid="import-close"
        @click="cancel"
      >
        Close
      </button>
      <template v-else>
        <button type="button" :class="styles.button" data-testid="import-cancel" @click="cancel">
          Cancel
        </button>
        <button
          v-if="current > 0"
          type="button"
          :class="styles.button"
          data-testid="import-back"
          @click="wizard.back()"
        >
          Back
        </button>
        <button
          type="button"
          :class="[styles.button, styles.primary]"
          :disabled="isLast ? !wizard.canNext : !wizard.canNext"
          :data-testid="isLast ? 'import-apply' : 'import-next'"
          @click="primary"
        >
          {{ isLast ? "Import" : "Next" }}
        </button>
      </template>
    </div>
    <p v-if="wizard.error" :class="styles.error" data-testid="import-error">{{ wizard.error }}</p>
  </div>
</template>
