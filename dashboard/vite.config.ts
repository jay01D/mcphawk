import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const here = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  root: here,
  plugins: [react()],
  server: {
    port: 4801,
    proxy: {
      "/api": "http://localhost:4800",
      "/ws": { target: "ws://localhost:4800", ws: true },
    },
  },
  build: {
    outDir: fileURLToPath(new URL("../dist/dashboard/public", import.meta.url)),
    emptyOutDir: true,
    sourcemap: false,
  },
});
