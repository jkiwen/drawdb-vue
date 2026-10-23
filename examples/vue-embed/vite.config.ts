import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      // The example runs against the sources of the workspace, so that a change
      // of the SDK is visible without a build.
      "@drawdb/core": new URL("../../packages/core/src/index.ts", import.meta.url).pathname,
      "@drawdb/vue-sdk": new URL("../../packages/sdk/src/index.ts", import.meta.url).pathname,
    },
  },
});
