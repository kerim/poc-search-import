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
        // Expose globals - though logseq plugins run in their own context
        extend: true,
        globals: {
          '@logseq/libs': 'logseq'
        }
      },
      external: ['@logseq/libs'],
    },
  },
})
