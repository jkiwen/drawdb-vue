<script setup lang="ts">
import type { LogicalDomain } from "@drawdb/core";
import { ref } from "vue";

import styles from "./type-system.module.css";
import { t } from "../../i18n/index.ts";
import { useTypeScopeStore } from "../../stores/type-scope.ts";
import { familyKey } from "./type-system-model.ts";

const scope = useTypeScopeStore();
const creating = ref(false);
const draftName = ref("");
const draftFamily = ref("string");
const diagnostic = ref("");

function startCreate(): void {
  creating.value = true;
  draftName.value = "";
  diagnostic.value = "";
}

function cancelCreate(): void {
  creating.value = false;
  draftName.value = "";
  diagnostic.value = "";
}

function confirmCreate(): void {
  const name = draftName.value.trim();
  if (!name) {
    return;
  }
  const domain: LogicalDomain = {
    id: `d_${name}`,
    name,
    family: draftFamily.value as LogicalDomain["family"],
  };
  const outcome = scope.registerDomain(domain);
  if (!outcome.ok) {
    diagnostic.value = outcome.diagnostic.message;
    return;
  }
  creating.value = false;
  draftName.value = "";
  diagnostic.value = "";
}

function removeDomain(domain: LogicalDomain): void {
  const outcome = scope.removeDomain(domain.name);
  diagnostic.value = outcome.ok ? "" : outcome.diagnostic.message;
}
</script>

<template>
  <section :class="styles.content">
    <div :class="styles.domainsHead">
      <span :class="styles.domainsTitle">{{ t("type_system_domains") }}</span>
      <button type="button" :class="styles.linkButton" data-testid="type-system-domain-create" @click="startCreate">
        {{ t("type_system_new_domain") }}
      </button>
    </div>

    <form v-if="creating" :class="styles.form" @submit.prevent="confirmCreate">
      <label :class="styles.field">
        <span>{{ t("name") }}</span>
        <input v-model="draftName" :class="styles.input" data-testid="type-system-domain-name" />
      </label>
      <label :class="styles.field">
        <span>{{ t("type_system_domain_family") }}</span>
        <select v-model="draftFamily" :class="styles.input" data-testid="type-system-domain-family">
          <option v-for="family in scope.families" :key="family.id" :value="family.id">
            {{ t(familyKey(family)) }}
          </option>
        </select>
      </label>
      <div :class="styles.formActions">
        <button
          type="button"
          :class="styles.linkButton"
          data-testid="type-system-domain-confirm"
          @click="confirmCreate"
        >
          {{ t("create") }}
        </button>
        <button type="button" :class="styles.linkButton" @click="cancelCreate">{{ t("cancel") }}</button>
      </div>
    </form>

    <p v-if="diagnostic" :class="styles.diagnostic" data-testid="type-system-diagnostic">{{ diagnostic }}</p>

    <p v-if="!scope.domains.length" :class="styles.empty" data-testid="type-system-domain-empty">
      {{ t("type_system_domain_empty") }}
    </p>
    <ul v-else :class="styles.domains">
      <li v-for="domain in scope.domains" :key="domain.name" :class="styles.domainRow">
        <span :class="styles.domainName">{{ domain.name }}</span>
        <span :class="styles.domainFamily">{{ t(`type_family.${domain.family}`) }}</span>
        <button
          type="button"
          :class="styles.linkButton"
          :data-testid="`type-system-domain-remove-${domain.name}`"
          @click="removeDomain(domain)"
        >
          {{ t("delete") }}
        </button>
      </li>
    </ul>
  </section>
</template>
