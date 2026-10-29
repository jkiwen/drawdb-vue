<script setup lang="ts">
import { useRouter } from "vue-router";
import { TypeSystemDialog } from "@drawdb/vue-sdk";

/**
 * The data type system of the whole application.
 *
 * The SDK ships the interface as a full screen dialog; the standalone app puts
 * it on its own route so the same screen is reachable without opening a
 * diagram (ruling Q16). Closing it returns to the diagrams.
 */
const router = useRouter();

function close(): void {
  void router.push({ name: "home" });
}
</script>

<template>
  <section class="types-view" data-testid="types-view">
    <TypeSystemDialog :open="true" @close="close" />
  </section>
</template>

<style scoped>
.types-view {
  position: relative;
  width: 100%;
  height: 100vh;
  background: var(--surface);
}
</style>
