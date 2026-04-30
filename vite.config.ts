import { defineConfig } from "vite";
import { crx } from "@crxjs/vite-plugin";
import manifest from "./manifest.json";

export default defineConfig({
  plugins: [crx({ manifest })],
  esbuild: {
    // Fix #16: remove debug console.log from production build,
    // but keep console.warn and console.error
    drop: ["console", "debugger"],
    pure: ["console.log", "console.info", "console.debug"],
  },
});
