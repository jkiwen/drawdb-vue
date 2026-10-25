<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import { createApp } from "vue";
import { createPinia } from "pinia";
import { createRouter, createWebHistory } from "vue-router";
import type { Router } from "vue-router";
import App from "../../../packages/app/src/App.vue";
import { appRoutes } from "../../../packages/app/src/router/index.ts";

/**
 * Hosts the standalone application inside the example.
 *
 * The application is a Vite app of its own, with its own `index.html` and its
 * own router. To be able to test it from the example, the harness mounts the
 * root component of the application on a router of its own, so that the
 * routes of the application work the same way as they work in the
 * application itself.
 */

const mountPoint = ref<HTMLElement | null>(null);

const router: Router = createRouter({
  history: createWebHistory(),
  routes: appRoutes,
});

const pinia = createPinia();

let app: ReturnType<typeof createApp> | null = null;

onMounted(() => {
  if (!mountPoint.value) return;
  app = createApp(App);
  app.use(router);
  app.use(pinia);
  app.mount(mountPoint.value);
});

onBeforeUnmount(() => {
  app?.unmount();
  app = null;
});
</script>

<template>
  <div class="app-host" data-testid="app-host">
    <div ref="mountPoint" class="app-host__mount"></div>
  </div>
</template>

<style scoped>
.app-host {
  height: 100%;
  min-height: 0;
  overflow: auto;
  background: var(--surface-muted, #f4f5f7);
}

.app-host__mount {
  height: 100%;
  min-height: 0;
}
</style>
