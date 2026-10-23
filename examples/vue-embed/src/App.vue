<script setup lang="ts">
import { ref } from "vue";
import { DrawDBEditor } from "@drawdb/vue-sdk";
import type { Diagram } from "@drawdb/core";

/**
 * The diagram of the example. It is handed to the editor as the initial value
 * and stays under the control of the application afterwards.
 */
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
        { id: "f1", name: "id", type: "INTEGER", primary: true, notNull: true, increment: true },
        { id: "f2", name: "email", type: "VARCHAR", size: "255", notNull: true, unique: true },
      ],
    },
    {
      id: "t2",
      name: "posts",
      x: 420,
      y: 60,
      fields: [
        { id: "f3", name: "id", type: "INTEGER", primary: true, notNull: true, increment: true },
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
</script>

<template>
  <main class="example">
    <header class="example__header">
      <h1>drawDB embedded in a Vue application</h1>
      <p>The editor below is the component <code>@drawdb/vue-sdk</code>.</p>
    </header>

    <section class="example__editor">
      <DrawDBEditor
        v-model="diagram"
        database="mysql"
        :auto-save="false"
        @save="saved = true"
      />
    </section>

    <p v-if="saved" class="example__saved">The diagram was saved.</p>
  </main>
</template>

<style scoped>
.example {
  display: flex;
  flex-direction: column;
  height: 100vh;
  margin: 0;
  font-family: system-ui, sans-serif;
}

.example__header {
  padding: 12px 20px;
  border-bottom: 1px solid #e5e7eb;
}

.example__header h1 {
  margin: 0 0 4px;
  font-size: 18px;
}

.example__header p {
  margin: 0;
  color: #6b7280;
  font-size: 13px;
}

.example__editor {
  flex: 1;
  min-height: 0;
}

.example__saved {
  margin: 0;
  padding: 8px 20px;
  color: #16a34a;
  font-size: 13px;
}
</style>
