import { defineConfig } from "vite";
import Vue from "@vitejs/plugin-vue";
import { HaloUIPluginBundlerKit } from "@halo-dev/ui-plugin-bundler-kit";
import path from "node:path";

export default defineConfig({
  plugins: [Vue(), HaloUIPluginBundlerKit()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
});
