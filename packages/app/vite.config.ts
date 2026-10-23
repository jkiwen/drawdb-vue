import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

/**
 * The build of the standalone application.
 *
 * The packages of the workspace are used through their source, so that the
 * application can be built without building the packages first.
 */
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      "@drawdb/core": fileURLToPath(
        new URL("../core/src/index.ts", import.meta.url),
      ),
      "@drawdb/vue-sdk": fileURLToPath(
        new URL("../sdk/src/index.ts", import.meta.url),
      ),
    },
  },
  server: {
    port: 5174,
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
});
