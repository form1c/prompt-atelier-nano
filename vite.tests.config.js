import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { shadowedPaths, singleFile, buildInfo } from './vite.config.js'

// A second build, for one page: the test bench.
//
// Its own configuration rather than a second entry in the main one, because
// `inlineDynamicImports` — the setting that keeps the application in a single
// file — refuses to work with more than one input. Two builds of one page each
// is the honest way round that, and it costs thirty lines.
//
// The bench is built exactly like the application: one file, a classic script,
// opened over file://. A test bench that ran under different rules would prove
// things about a build nobody ships.
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [shadowedPaths(), vue(), singleFile()],
  // The same constants as the application, or the bench would be checking a
  // build that differs from the shipped one in one more way than it should.
  define: buildInfo(),
  build: {
    outDir: resolve(fileURLToPath(new URL('.', import.meta.url)), 'dist-tests'),
    emptyOutDir: true,
    cssCodeSplit: false,
    assetsInlineLimit: 1024 * 1024,
    rollupOptions: {
      input: resolve(fileURLToPath(new URL('.', import.meta.url)), 'tests/browser/index.html'),
      output: { format: 'iife', inlineDynamicImports: true, entryFileNames: 'suite.js', assetFileNames: 'suite.[ext]' }
    }
  }
})
