<script setup lang="ts">
import { computed } from "vue";
import { useDiagramStore } from "../../stores/diagram.ts";
import { useHistoryStore } from "../../stores/history.ts";
import { useImportWizardStore } from "../../stores/import-wizard.ts";
import { t } from "../../i18n/index.ts";
import styles from "./import.module.css";

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
        <dt>{{ t("wizard_target_diagram") }}</dt>
        <dd data-testid="import-target-kind">{{ kind }}</dd>
      </div>
      <div>
        <dt>{{ t("wizard_target_title") }}</dt>
        <dd data-testid="import-target-title">{{ title }}</dd>
      </div>
      <div>
        <dt>{{ t("wizard_target_adds") }}</dt>
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
        {{ t("wizard_target_current") }}
      </button>
      <button
        type="button"
        role="radio"
        :aria-checked="wizard.targetChoice === 'new'"
        :class="[styles.choice, wizard.targetChoice === 'new' ? styles.choiceOn : '']"
        data-testid="import-target-new"
        @click="wizard.setTarget('new')"
      >
        {{ t("wizard_target_new") }}
      </button>
    </div>
    <p v-if="kind === 'occupied' && wizard.targetChoice === 'current'" :class="styles.hint">
      {{ t("wizard_clash_next") }}
    </p>
    <p v-if="history.canUndo" :class="styles.hint" data-testid="import-unsaved">
      {{ t("wizard_unsaved") }}
    </p>
  </section>
</template>
