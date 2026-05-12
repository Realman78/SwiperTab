import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import webExtension from "vite-plugin-web-extension";
import path from "node:path";
import { buildManifest } from "./src/manifest";

const target = (process.env.TARGET === "chrome" ? "chrome" : "firefox") as "firefox" | "chrome";

// Firefox extension pages serve assets from moz-extension:// without
// Access-Control-Allow-Origin headers. The `crossorigin` attribute Vite
// adds to <link> and <script> tags triggers CORS mode and the stylesheet
// load fails silently. Strip it.
const stripCrossorigin = (): Plugin => ({
  name: "swipertab:strip-crossorigin",
  transformIndexHtml: {
    order: "post",
    handler: (html) => html.replace(/\s+crossorigin(="[^"]*")?/g, ""),
  },
});

export default defineConfig({
  build: {
    outDir: `dist-${target}`,
    emptyOutDir: true,
  },
  plugins: [
    react(),
    webExtension({
      manifest: () => buildManifest(target),
      browser: target,
      additionalInputs: ["src/cleanup/index.html"],
    }),
    stripCrossorigin(),
  ],
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "./src") },
  },
});
