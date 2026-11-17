import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  root: "revamp",
  publicDir: "../assets",
  plugins: [react()],
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        marketing: fileURLToPath(new URL("./revamp/index.html", import.meta.url)),
        transfer: fileURLToPath(new URL("./revamp/transfer.html", import.meta.url)),
      },
    },
  },
});
