import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

export default defineConfig({
  build: {
    target: "node20",
    outDir: "dist",
    emptyOutDir: true,
    lib: {
      entry: {
        index: "src/index.ts",
        "hooks/pre-tool-use": "src/hooks/pre-tool-use.ts",
        "hooks/post-tool-use": "src/hooks/post-tool-use.ts",
        "mcp/start": "src/mcp/start.ts",
        "cli/index": "src/cli/index.ts",
      },
      formats: ["es"],
    },
    rollupOptions: {
      external: [
        /^node:/,
        /^@modelcontextprotocol\/sdk/,
        "zod",
        "commander",
        "@clack/prompts",
        "picocolors",
      ],
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "_chunks/[name]-[hash].js",
        banner: (chunk) =>
          chunk.fileName === "cli/index.js" ? "#!/usr/bin/env node" : "",
      },
    },
    minify: false,
    sourcemap: true,
  },
  plugins: [
    dts({
      entryRoot: "src",
      include: ["src/**/*.ts"],
    }),
  ],
});
