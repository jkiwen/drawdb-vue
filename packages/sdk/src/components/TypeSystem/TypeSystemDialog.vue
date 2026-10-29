<script setup lang="ts">
import type { DatabaseType } from "@drawdb/core";
import { ref, watch } from "vue";

import styles from "./type-system.module.css";
import { t } from "../../i18n/index.ts";
import { useTypeScopeStore } from "../../stores/type-scope.ts";
import DomainsPane from "./DomainsPane.vue";
import FamiliesPane from "./FamiliesPane.vue";

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: [] }>();

const scope = useTypeScopeStore();
const tab = ref<"families" | "domains">("families");
const selected = ref(scope.families[0]?.id ?? "string");
const diagnostic = ref("");

watch(
  () => props.open,
  (open) => {
    if (open) {
      diagnostic.value = "";
    }
  },
);

function onMappingChange(database: DatabaseType, type: string, params: Record<string, number>): void {
  const outcome = scope.updateMapping(selected.value, database, {
    type,
    ...(Object.keys(params).length ? { params } : {}),
  });
  diagnostic.value = outcome.ok ? "" : outcome.diagnostic.message;
}
</script>

<template>
  <div v-if="open" :class="styles.overlay" data-testid="type-system" @keydown.escape="emit('close')">
    <div :class="styles.panel" role="dialog" :aria-label="t('type_system_title')">
      <header :class="styles.head">
        <h2 :class="styles.title">{{ t("type_system_title") }}</h2>
        <div :class="styles.headActions">
          <button
            type="button"
            :class="styles.linkButton"
            data-testid="type-system-reset"
            @click="scope.resetToBuiltins()"
          >
            {{ t("type_system_reset") }}
          </button>
          <button type="button" :class="styles.linkButton" data-testid="type-system-close" @click="emit('close')">
            {{ t("close") }}
          </button>
        </div>
      </header>

      <nav :class="styles.tabs">
        <button
          type="button"
          :class="[styles.tab, tab === 'families' && styles.tabOn]"
          data-testid="type-system-tab-families"
          @click="tab = 'families'"
        >
          {{ t("type_system_families") }}
        </button>
        <button
          type="button"
          :class="[styles.tab, tab === 'domains' && styles.tabOn]"
          data-testid="type-system-tab-domains"
          @click="tab = 'domains'"
        >
          {{ t("type_system_domains") }}
        </button>
      </nav>

      <div :class="styles.body">
        <FamiliesPane
          v-if="tab === 'families'"
          :families="scope.families"
          :selected="selected"
          @select="selected = $event"
          @change="onMappingChange"
        />
        <DomainsPane v-else />
      </div>

      <p v-if="diagnostic" :class="styles.diagnostic" data-testid="type-system-diagnostic">
        {{ diagnostic }}
      </p>
    </div>
  </div>
</template>
