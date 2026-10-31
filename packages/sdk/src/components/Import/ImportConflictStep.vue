<script setup lang="ts">
import { computed } from "vue";
import type { ConflictAction, DomainDecision } from "@drawdb/core";
import { useImportWizardStore } from "../../stores/import-wizard.ts";
import { t } from "../../i18n/index.ts";
import styles from "./import.module.css";

const wizard = useImportWizardStore();

const conflicts = computed(() => wizard.plan?.conflicts ?? []);
const domainConflicts = computed(() => wizard.plan?.domainConflicts ?? []);
const tables = computed(() => wizard.source?.diagram?.tables ?? []);
const chosen = computed(() => new Set(wizard.chosenTables ?? tables.value.map((table) => String(table.id))));
const tablesActions: readonly ConflictAction[] = ["skip", "rename", "merge"];
const otherActions: readonly ConflictAction[] = ["skip", "rename"];
const sides = computed<{ decision: DomainDecision; key: string; name: string }[]>(() =>
  domainConflicts.value.flatMap((conflict) => [
    {
      decision: { name: conflict.name, kind: conflict.kind, database: conflict.database, side: "mine" },
      key: "wizard_keep_mine",
      name: String(conflict.mine),
    },
    {
      decision: { name: conflict.name, kind: conflict.kind, database: conflict.database, side: "theirs" },
      key: "wizard_take_theirs",
      name: String(conflict.theirs),
    },
  ]),
);

function actionsOf(kind: string): readonly ConflictAction[] {
  return kind === "table" ? tablesActions : otherActions;
}

function chosenAction(id: string): ConflictAction | undefined {
  return wizard.conflictDecisions.find((entry) => entry.id === id)?.action;
}

function isDecided(conflict: DomainDecision & { kind: string; name: string }): boolean {
  return wizard.domainDecisions.some(
    (entry) => entry.name === conflict.name && entry.kind === conflict.kind && entry.side === conflict.side,
  );
}
</script>

<template>
  <section :class="styles.step" data-testid="import-step-conflict">
    <p v-if="conflicts.length === 0 && domainConflicts.length === 0" :class="styles.hint" data-testid="import-conflicts-none">
      {{ t("wizard_conflicts_none") }}
    </p>
    <ul v-if="conflicts.length > 0" :class="styles.conflicts" data-testid="import-conflicts">
      <li v-for="conflict in conflicts" :key="conflict.id" :class="styles.conflict" data-testid="import-conflict">
        <div :class="styles.conflictHead">
          <span :class="styles.conflictName">{{ conflict.name }}</span>
          <span :class="styles.conflictDetail">{{ conflict.kind }} · {{ conflict.detail ?? conflict.path }}</span>
        </div>
        <div :class="styles.choices">
          <button
            v-for="action in actionsOf(conflict.kind)"
            :key="action"
            type="button"
            :aria-pressed="chosenAction(conflict.id) === action"
            :class="[styles.choice, chosenAction(conflict.id) === action ? styles.choiceOn : '']"
            :data-testid="`import-decide-${conflict.id}-${action}`"
            @click="wizard.decide(conflict.id, action)"
          >
            {{ t(`wizard_decide_${action}`) }}
          </button>
        </div>
      </li>
    </ul>
    <div v-if="domainConflicts.length > 0" data-testid="import-domain-conflicts">
      <p :class="styles.hint">{{ t("wizard_domains_both") }}</p>
      <ul :class="styles.conflicts">
        <li v-for="(entry, index) in sides" :key="`${entry.decision.name}-${entry.decision.kind}-${entry.decision.side}`" :class="styles.conflict">
          <div :class="styles.conflictHead">
            <span :class="styles.conflictName">{{ entry.decision.name }}</span>
            <span :class="styles.conflictDetail">{{ entry.decision.kind }}</span>
          </div>
          <div :class="styles.choices">
            <button
              type="button"
              :aria-pressed="isDecided(entry.decision)"
              :class="[styles.choice, isDecided(entry.decision) ? styles.choiceOn : '']"
              :data-testid="`import-domain-${index}-${entry.decision.side}`"
              @click="wizard.decideDomain(entry.decision)"
            >
              {{ t(entry.key, { name: entry.name }) }}
            </button>
          </div>
        </li>
      </ul>
    </div>
    <div v-if="wizard.targetChoice === 'current' && tables.length > 0">
      <p :class="styles.hint">{{ t("wizard_tables_list") }}</p>
      <ul :class="styles.tableList" data-testid="import-tables">
        <li v-for="table in tables" :key="table.id" :class="styles.tableRow">
          <input
            type="checkbox"
            :data-testid="`import-table-${table.id}`"
            :checked="chosen.has(String(table.id))"
            @change="wizard.toggleTable(String(table.id))"
          />
          <span>{{ table.name }}</span>
        </li>
      </ul>
    </div>
    <p :class="styles.hint" data-testid="import-undecided">{{ wizard.reasons.join(" ") }}</p>
  </section>
</template>
