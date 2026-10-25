<script setup lang="ts">
import AppHarness from "./AppHarness.vue";

/*
 * The application brings its own global stylesheet, which the standalone
 * build loads from its entry point. The example loads it here, so that the
 * application looks inside the harness exactly like it looks on its own.
 */
import "../../../packages/app/src/styles.css";
</script>

<template>
  <AppHarness />
</template>
