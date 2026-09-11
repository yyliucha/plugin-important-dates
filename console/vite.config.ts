import { viteConfig } from "@halo-dev/ui-plugin-bundler-kit/vite";
import path from "node:path";

// 官方 2.26 UI 构建流：format=auto → 依据 plugin.yaml requires(>=2.26.0) 选择 ESM provider
// 产物：build/dist/* + ui-plugin.json（由 halo 运行时经 manifest 加载）
export default viteConfig({
  vite: {
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "src"),
      },
    },
  },
});



