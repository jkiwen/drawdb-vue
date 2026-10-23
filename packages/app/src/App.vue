<script setup lang="ts">
import { RouterLink, RouterView } from "vue-router";
</script>

<template>
  <div class="app">
    <header class="app-header">
      <RouterLink class="brand" to="/" data-testid="brand">drawDB</RouterLink>
      <nav class="app-nav">
        <RouterLink to="/" data-testid="nav-home">Diagrams</RouterLink>
        <RouterLink to="/templates" data-testid="nav-templates">Templates</RouterLink>
      </nav>
    </header>
    <main class="app-main">
      <RouterView />
    </main>
  </div>
</template>
