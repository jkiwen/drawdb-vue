<script setup lang="ts">
import { computed } from "vue";
import { useDiagramStore } from "../../stores/diagram.ts";
import { useHistoryStore } from "../../stores/history.ts";
import { useImportWizardStore } from "../../stores/import-wizard.ts";
import styles from "./import.module.css";

// TODO(i18n): English until P8 task 8.
const wizard = useImportWizardStore();
const history = useHistoryStore();
const diagramStore = useDiagramStore();

const kind = computed(() => wizard.plan?.target.kind ?? "empty");
const title = computed(() =>
  wizard.targetChoice === "new" ? "" : (diagramStore.diagram.title ?? ""),
);
const adds = computed(() => wizard.plan?.adds.tables ?? 0);
</script>

<template>
  <section :class="styles.step" data-testid="import-step-target">
    <dl :class="styles.counts">
      <div>
        <dt>The diagram on screen</dt>
        <dd data-testid="import-target-kind">{{ kind }}</dd>
      </div>
      <div>
        <dt>Its title</dt>
        <dd data-testid="import-target-title">{{ title }}</dd>
      </div>
      <div>
        <dt>Tables coming in</dt>
        <dd data-testid="import-target-adds">{{ adds }}</dd>
      </div>
    </dl>
    <div :class="styles.choices" role="radiogroup">
      <button
        type="button"
        role="radio"
        :aria-checked="wizard.targetChoice === 'current'"
        :class="[styles.choice, wizard.targetChoice === 'current' ? styles.choiceOn : '']"
        data-testid="import-target-current"
        @click="wizard.setTarget('current')"
      >
        Add to this diagram
      </button>
      <button
        type="button"
        role="radio"
        :aria-checked="wizard.targetChoice === 'new'"
        :class="[styles.choice, wizard.targetChoice === 'new' ? styles.choiceOn : '']"
        data-testid="import-target-new"
        @click="wizard.setTarget('new')"
      >
        Start a new diagram
      </button>
    </div>
    <p v-if="kind === 'occupied' && wizard.targetChoice === 'current'" :class="styles.hint">
      The tables that clash with what is here will be decided in the next step.
    </p>
    <p v-if="history.canUndo" :class="styles.hint" data-testid="import-unsaved">
      This diagram has changes that are not saved yet. The import can be undone in one step.
    </p>
  </section>
</template>
