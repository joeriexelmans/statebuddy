import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import path from "node:path";
import {hashedDir} from "./vite-plugin-hashed-dir";
import pluginGitRev from './vite-plugin-git-rev';

const output = {
  entryFileNames: "assets/[name]_[hash:16].js",
  chunkFileNames: "assets/[name]_[hash:16].js",
  assetFileNames: "assets/[name]_[hash:16][extname]",
  codeSplitting: {
    groups: [
      {
        test: "node_modules/mqtt/",
        name: 'mqtt',
      },
      {
        test: "src/App/Logo/Logo.tsx",
        name: 'logo',
      },
      {
        test: "node_modules/react-dom/",
        name: 'react-dom',
      },
      // CBOR could be split off, but it is tiny (only 28 KB)
      // {
      //   test: "node_modules/cbor-x/",
      //   name: 'cbor-x',
      // },
    ]
  }
}

export default defineConfig({
  root: "src",
  plugins: [
    hashedDir(),
    react(),
    pluginGitRev(),
  ],
  resolve: {
    alias: {"@": path.resolve(import.meta.dirname, "src")},
  },
  assetsInclude: ["**/*.zip"],
  worker: {
    format: 'es',
    plugins: () => [hashedDir()],
    rolldownOptions: {
      output,
    }
  },
  publicDir: "public",
  build: {
    // sourcemap: true,
    outDir: path.resolve(import.meta.dirname, "dist"),
    rollupOptions: {
      input: ["index.html", "404.html", "tags/latest.html"],
      output,
    },
  },
});
