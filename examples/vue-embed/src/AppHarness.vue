<script setup lang="ts">
import { computed, ref } from "vue";
import { DrawDBEditor } from "@drawdb/vue-sdk";
import type { Diagram } from "@drawdb/core";
import AppHost from "./AppHost.vue";

/**
 * The harness of the example.
 *
 * It exists to make three things visible at a glance, because the SDK is
 * embedded by other people and the boundaries between "what the SDK renders"
 * and "what the host application renders" are easy to misunderstand:
 *
 * 1. the SDK component area - the part that `@drawdb/vue-sdk` owns,
 * 2. the test panel and button area - the part this harness owns, where the
 *    host application drives and inspects the editor,
 * 3. the test core area - the part that is actually being tested.
 *
 * The host application of the standalone app is mounted in the same way, so
 * that the two ways of using the SDK can be compared side by side.
 */

type Page = "sdk" | "app";

const page = ref<Page>("sdk");

const diagram = ref<Diagram | undefined>({
  id: "example",
  title: "Example diagram",
  database: "mysql",
  tables: [
    {
      id: "t1",
      name: "users",
      x: 60,
      y: 60,
      fields: [
        {
          id: "f1",
          name: "id",
          type: "INTEGER",
          primary: true,
          notNull: true,
          increment: true,
        },
        {
          id: "f2",
          name: "email",
          type: "VARCHAR",
          size: "255",
          notNull: true,
          unique: true,
        },
      ],
    },
    {
      id: "t2",
      name: "posts",
      x: 420,
      y: 60,
      fields: [
        {
          id: "f3",
          name: "id",
          type: "INTEGER",
          primary: true,
          notNull: true,
          increment: true,
        },
        { id: "f4", name: "user_id", type: "INTEGER", notNull: true },
        { id: "f5", name: "title", type: "VARCHAR", size: "255" },
      ],
    },
  ],
  relationships: [
    {
      id: "r1",
      name: "fk_posts_user",
      startTableId: "t2",
      startFieldId: "f4",
      endTableId: "t1",
      endFieldId: "f1",
      cardinality: "many_to_one",
    },
  ],
  notes: [],
  subjectAreas: [],
  types: [],
  enums: [],
  views: [],
  sqlHeader: "",
} as Diagram);

const saved = ref(false);
const log = ref<string[]>([]);

const tableCount = computed(() => diagram.value?.tables.length ?? 0);
const relationshipCount = computed(
  () => diagram.value?.relationships.length ?? 0,
);

/** Writes a line into the test log, so that a click can be observed. */
function record(message: string): void {
  log.value = [message, ...log.value].slice(0, 6);
}
</script>

<template>
  <main class="harness">
    <header class="harness__header">
      <div class="harness__title">
        <h1>drawDB Vue SDK test harness</h1>
        <p>
          The three regions below are the ones the SDK documentation talks about.
          Everything is labelled so that it is clear who owns what.
        </p>
      </div>

      <nav class="harness__pages" aria-label="Test pages">
        <button
          type="button"
          class="harness__page"
          :class="{ 'harness__page--active': page === 'sdk' }"
          data-testid="page-sdk"
          @click="page = 'sdk'"
        >
          SDK test page
        </button>
        <button
          type="button"
          class="harness__page"
          :class="{ 'harness__page--active': page === 'app' }"
          data-testid="page-app"
          @click="page = 'app'"
        >
          drawdb-vue-app test page
        </button>
      </nav>
    </header>

    <!-- ================= SDK test page ================= -->
    <template v-if="page === 'sdk'">
      <section
        class="region region--test-panel"
        data-testid="region-test-panel"
        aria-label="Test panel and button area"
      >
        <div class="region__label">
          <span class="region__label-text">Test panel &amp; button area</span>
          <span class="region__label-owner">owned by the host application</span>
        </div>

        <div class="region__body region__body--toolbar">
          <div class="control-group">
            <span class="control-group__label">Diagram</span>
            <button
              type="button"
              class="control"
              data-testid="test-add-table"
              @click="
                diagram = diagram
                  ? {
                      ...diagram,
                      tables: [
                        ...diagram.tables,
                        {
                          id: `t${diagram.tables.length + 1}`,
                          name: `table_${diagram.tables.length + 1}`,
                          x: 60 + diagram.tables.length * 40,
                          y: 260,
                          fields: [],
                        },
                      ],
                    }
                  : diagram
              "
            >
              Add table
            </button>
            <button
              type="button"
              class="control"
              data-testid="test-reset"
              @click="
                diagram = diagram
                  ? { ...diagram, tables: diagram.tables.slice(0, 2) }
                  : diagram
              "
            >
              Reset
            </button>
          </div>

          <div class="control-group">
            <span class="control-group__label">State</span>
            <span class="readout" data-testid="test-readout">
              {{ tableCount }} tables · {{ relationshipCount }} relations
            </span>
          </div>

          <div class="control-group control-group--end">
            <button
              type="button"
              class="control control--primary"
              data-testid="test-save"
              @click="saved = true"
            >
              Save
            </button>
          </div>
        </div>

        <div v-if="log.length" class="region__body region__body--log">
          <span class="control-group__label">Test log</span>
          <ul class="log" data-testid="test-log">
            <li v-for="(line, index) in log" :key="index">{{ line }}</li>
          </ul>
        </div>
      </section>

      <section
        class="region region--sdk"
        data-testid="region-sdk"
        aria-label="SDK component area"
      >
        <div class="region__label">
          <span class="region__label-text">SDK component area</span>
          <span class="region__label-owner">
            owned by <code>@drawdb/vue-sdk</code>
          </span>
        </div>

        <div class="region__body region__body--editor">
          <DrawDBEditor
            v-model="diagram"
            database="mysql"
            :auto-save="false"
            @save="saved = true; record('The editor emitted save.')"
          />
        </div>
      </section>

      <section
        class="region region--core"
        data-testid="region-core"
        aria-label="Test core area"
      >
        <div class="region__label">
          <span class="region__label-text">Test core area</span>
          <span class="region__label-owner">what the test asserts on</span>
        </div>

        <div class="region__body region__body--core">
          <dl class="facts" data-testid="test-facts">
            <div class="facts__row">
              <dt>Tables</dt>
              <dd data-testid="fact-tables">{{ tableCount }}</dd>
            </div>
            <div class="facts__row">
              <dt>Relations</dt>
              <dd data-testid="fact-relations">{{ relationshipCount }}</dd>
            </div>
            <div class="facts__row">
              <dt>Database</dt>
              <dd data-testid="fact-database">{{ diagram?.database }}</dd>
            </div>
            <div class="facts__row">
              <dt>Save event</dt>
              <dd data-testid="fact-saved">{{ saved ? "fired" : "pending" }}</dd>
            </div>
          </dl>
        </div>
      </section>
    </template>

    <!-- ================= drawdb-vue-app test page ================= -->
    <template v-else>
      <section
        class="region region--test-panel"
        data-testid="region-app-test-panel"
        aria-label="Test panel and button area"
      >
        <div class="region__label">
          <span class="region__label-text">Test panel &amp; button area</span>
          <span class="region__label-owner">owned by the host application</span>
        </div>

        <div class="region__body region__body--toolbar">
          <div class="control-group">
            <span class="control-group__label">Application</span>
            <span class="readout">
              The real <code>drawdb-vue-app</code> is mounted below, with its
              own router, storage and plugins.
            </span>
          </div>

          <div class="control-group control-group--end">
            <button
              type="button"
              class="control"
              data-testid="app-back-to-sdk"
              @click="page = 'sdk'"
            >
              Back to the SDK test page
            </button>
          </div>
        </div>
      </section>

      <section
        class="region region--sdk"
        data-testid="region-app"
        aria-label="SDK component area"
      >
        <div class="region__label">
          <span class="region__label-text">SDK component area</span>
          <span class="region__label-owner">
            owned by <code>drawdb-vue-app</code> on top of
            <code>@drawdb/vue-sdk</code>
          </span>
        </div>

        <div class="region__body region__body--editor">
          <AppHost />
        </div>
      </section>

      <section
        class="region region--core"
        data-testid="region-app-core"
        aria-label="Test core area"
      >
        <div class="region__label">
          <span class="region__label-text">Test core area</span>
          <span class="region__label-owner">what the test asserts on</span>
        </div>

        <div class="region__body region__body--core">
          <p class="hint">
            The application routes are the ones of the standalone app: the home
            view lists the diagrams, the editor view hosts the SDK editor.
          </p>
        </div>
      </section>
    </template>
  </main>
</template>

<style scoped>
.harness {
  display: flex;
  flex-direction: column;
  height: 100vh;
  margin: 0;
  font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
  color: #1c1e21;
  background: #f4f5f7;
}

.harness__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 20px;
  background: #ffffff;
  border-bottom: 1px solid #d9dce1;
}

.harness__title h1 {
  margin: 0 0 4px;
  font-size: 17px;
  font-weight: 650;
}

.harness__title p {
  margin: 0;
  color: #6b7280;
  font-size: 13px;
  max-width: 62ch;
}

.harness__pages {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.harness__page {
  padding: 6px 12px;
  border: 1px solid #d9dce1;
  border-radius: 6px;
  background: #ffffff;
  color: #1c1e21;
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 120ms ease, border-color 120ms ease,
    color 120ms ease;
}

.harness__page:hover {
  background: #f4f5f7;
}

.harness__page--active {
  background: #175e7a;
  border-color: #175e7a;
  color: #ffffff;
}

.region {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.region--test-panel {
  flex: 0 0 auto;
  background: #fbfbfc;
  border-bottom: 1px solid #d9dce1;
}

.region--sdk {
  flex: 1 1 auto;
  min-height: 0;
  background: #ffffff;
  border-bottom: 1px solid #d9dce1;
}

.region--core {
  flex: 0 0 auto;
  background: #ffffff;
}

.region__label {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 6px 20px;
  background: rgba(23, 94, 122, 0.06);
  border-bottom: 1px dashed rgba(23, 94, 122, 0.28);
}

.region__label-text {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #175e7a;
}

.region__label-owner {
  font-size: 11px;
  color: #6b7280;
}

.region__body {
  min-height: 0;
}

.region__body--toolbar {
  display: flex;
  align-items: center;
  gap: 20px;
  flex-wrap: wrap;
  padding: 10px 20px;
}

.region__body--log {
  display: flex;
  align-items: baseline;
  gap: 10px;
  padding: 0 20px 10px;
}

.region__body--editor {
  flex: 1 1 auto;
  min-height: 0;
}

.region__body--core {
  padding: 12px 20px;
}

.control-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.control-group--end {
  margin-left: auto;
}

.control-group__label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #6b7280;
}

.control {
  padding: 5px 10px;
  border: 1px solid #d9dce1;
  border-radius: 6px;
  background: #ffffff;
  color: #1c1e21;
  font: inherit;
  font-size: 13px;
  cursor: pointer;
  transition: background-color 120ms ease, border-color 120ms ease;
}

.control:hover {
  background: #f4f5f7;
}

.control--primary {
  background: #175e7a;
  border-color: #175e7a;
  color: #ffffff;
}

.control--primary:hover {
  background: #12485f;
}

.readout {
  font-size: 13px;
  color: #1c1e21;
}

.log {
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 12px;
  color: #6b7280;
}

.facts {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 24px;
  margin: 0;
}

.facts__row {
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.facts__row dt {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #6b7280;
}

.facts__row dd {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.hint {
  margin: 0;
  font-size: 13px;
  color: #6b7280;
}
</style>
