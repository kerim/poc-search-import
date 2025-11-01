import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    target: 'esnext',
    minify: false,
    rollupOptions: {
      input: 'src/index.ts',
      output: {
        dir: 'dist',
        entryFileNames: 'index.js',
        format: 'iife',
      },
      external: ['@logseq/libs'],
    },
  },
})
