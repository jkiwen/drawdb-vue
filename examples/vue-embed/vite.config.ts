import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  // The root is the folder of the example, so that the dev server serves its
  // index.html and its sources, whatever the folder the command runs in.
  root: fileURLToPath(new URL(".", import.meta.url)),
  plugins: [vue()],
  resolve: {
    alias: {
      // The example runs against the sources of the workspace, so that a change
      // of the SDK is visible without a build.
      "@drawdb/core": fileURLToPath(new URL("../../packages/core/src/index.ts", import.meta.url)),
      "@drawdb/vue-sdk": fileURLToPath(new URL("../../packages/sdk/src/index.ts", import.meta.url)),
    },
  },
});
