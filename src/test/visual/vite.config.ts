import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  resolve: {
    alias: { "@": fileURLToPath(new URL("../../", import.meta.url)) },
  },
  oxc: { jsx: { runtime: "automatic" } },
  server: {
    host: "127.0.0.1",
    port: 3200,
    strictPort: true,
    // Public static assets only; never proxy a private route or Auth endpoint.
    proxy: { "/_next/static": "http://127.0.0.1:3100" },
  },
});
