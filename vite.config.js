import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { copyFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const contentRoutes = new Map([
  ["/about", "/about.html"],
  ["/how-it-works", "/how-it-works.html"],
  ["/faq", "/faq.html"],
  ["/privacy", "/privacy.html"],
  ["/guides", "/guides.html"],
]);

function transferRoutes() {
  return {
    name: "transfer-routes",
    configureServer(server) {
      server.middlewares.use((request, _response, next) => {
        const path = String(request.url ?? "").split("?")[0];
        if (/^\/(send|receive)(\/|$)/.test(path)) {
          request.url = "/transfer.html";
        } else if (contentRoutes.has(path)) {
          request.url = contentRoutes.get(path);
        } else if (/^\/guides\/[^/]+$/.test(path)) {
          request.url = `${path}.html`;
        }
        next();
      });
    },
  };
}

const siteHeader = `
<header class="site-header">
  <a class="wordmark" href="/">LynkShare</a>
  <nav class="site-nav" aria-label="Main">
    <a href="/how-it-works">How it works</a>
    <a href="/guides">Guides</a>
    <a href="/faq">FAQ</a>
    <a href="/send">Send</a>
  </nav>
</header>`;

const siteFooter = `
<footer class="footer">
  <a href="/about">About</a>
  <a href="/how-it-works">How it works</a>
  <a href="/guides">Guides</a>
  <a href="/faq">FAQ</a>
  <a href="/privacy">Privacy</a>
  <a href="https://github.com/mudit-palvadi/LynkShare">GitHub</a>
</footer>`;

function contentLayout() {
  return {
    name: "content-layout",
    transformIndexHtml(html) {
      return html
        .replace("<!-- SITE_HEADER -->", siteHeader)
        .replace("<!-- SITE_FOOTER -->", siteFooter);
    },
  };
}

function copyBootScript() {
  return {
    name: "copy-boot-script",
    closeBundle() {
      const output = fileURLToPath(new URL("./dist", import.meta.url));
      mkdirSync(output, { recursive: true });
      for (const file of [
        "boot.js",
        "robots.txt",
        "sitemap.xml",
        "manifest.webmanifest",
        "_redirects",
      ]) {
        copyFileSync(
          fileURLToPath(new URL(`./revamp/${file}`, import.meta.url)),
          fileURLToPath(new URL(`./dist/${file}`, import.meta.url)),
        );
      }
      for (const file of ["ads.txt", "app-ads.txt"]) {
        copyFileSync(
          fileURLToPath(new URL(`./${file}`, import.meta.url)),
          fileURLToPath(new URL(`./dist/${file}`, import.meta.url)),
        );
      }
    },
  };
}

export default defineConfig({
  root: "revamp",
  publicDir: "../assets",
  plugins: [react(), contentLayout(), transferRoutes(), copyBootScript()],
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
        about: fileURLToPath(new URL("./revamp/about.html", import.meta.url)),
        howItWorks: fileURLToPath(
          new URL("./revamp/how-it-works.html", import.meta.url),
        ),
        faq: fileURLToPath(new URL("./revamp/faq.html", import.meta.url)),
        privacy: fileURLToPath(new URL("./revamp/privacy.html", import.meta.url)),
        guides: fileURLToPath(new URL("./revamp/guides.html", import.meta.url)),
        guideDirectVsCloud: fileURLToPath(
          new URL("./revamp/guides/direct-vs-cloud.html", import.meta.url),
        ),
        guideCrossDevice: fileURLToPath(
          new URL("./revamp/guides/cross-device-transfer.html", import.meta.url),
        ),
        guideIos: fileURLToPath(
          new URL("./revamp/guides/receive-on-iphone.html", import.meta.url),
        ),
        guideQr: fileURLToPath(
          new URL("./revamp/guides/sender-qr-vs-receiver-qr.html", import.meta.url),
        ),
        guideExpired: fileURLToPath(
          new URL("./revamp/guides/expired-link.html", import.meta.url),
        ),
        guideLimits: fileURLToPath(
          new URL("./revamp/guides/web-vs-app-limits.html", import.meta.url),
        ),
      },
    },
  },
});
