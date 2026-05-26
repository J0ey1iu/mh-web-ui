import { defineConfig } from "vite"
import vue from "@vitejs/plugin-vue"

export default defineConfig({
  plugins: [
    vue(),
    {
      name: "inline-css",
      enforce: "post",
      apply: "build",
      generateBundle(_, bundle) {
        const cssEntry = Object.entries(bundle).find(
          ([, v]) => v.type === "asset" && v.fileName.endsWith(".css"),
        )
        const jsEntry = Object.entries(bundle).find(
          ([, v]) => v.type === "chunk" && v.fileName.endsWith(".js"),
        )

        if (cssEntry && jsEntry) {
          const [, cssAsset] = cssEntry
          const [, jsChunk] = jsEntry
          const cssText =
            typeof cssAsset.source === "string"
              ? cssAsset.source
              : new TextDecoder().decode(cssAsset.source)

          jsChunk.code = [
            `(function(){`,
            `var s=document.createElement("style");`,
            `s.textContent=${JSON.stringify(cssText)};`,
            `document.head.appendChild(s);`,
            `})();`,
            jsChunk.code,
          ].join("")

          delete bundle[cssEntry[0]]
        }
      },
    },
  ],
  build: {
    lib: {
      entry: "src/index.ts",
      name: "MHExtraToolComponents",
      formats: ["umd"],
    },
    rollupOptions: {
      external: ["vue"],
      output: {
        globals: { vue: "Vue" },
        entryFileNames: "mh-extra-components.umd.js",
      },
    },
  },
})
