import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { copyFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

function transferRoutes() {
  return {
    name: "transfer-routes",
    configureServer(server) {
      server.middlewares.use((request, _response, next) => {
        const path = String(request.url ?? "").split("?")[0];
        if (/^\/(send|receive)(\/|$)/.test(path)) {
          request.url = "/transfer.html";
        }
        next();
      });
    },
  };
}

function copyBootScript() {
  return {
    name: "copy-boot-script",
    closeBundle() {
      const output = fileURLToPath(new URL("./dist", import.meta.url));
      mkdirSync(output, { recursive: true });
      copyFileSync(
        fileURLToPath(new URL("./revamp/boot.js", import.meta.url)),
        fileURLToPath(new URL("./dist/boot.js", import.meta.url)),
      );
    },
  };
}

export default defineConfig({
  root: "revamp",
  publicDir: "../assets",
  plugins: [react(), transferRoutes(), copyBootScript()],
  resolve: {
    alias: {
      "#engine": fileURLToPath(new URL("./js/core", import.meta.url)),
    },
  },
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
