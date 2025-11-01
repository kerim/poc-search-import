import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    target: 'esnext',
    minify: false,
    rollupOptions: {
      input: 'src/index.tsx',
      output: {
        dir: 'dist',
        entryFileNames: 'index.js',
        format: 'iife',
        extend: true,
        globals: {
          '@logseq/libs': 'logseq'
        }
      },
      external: ['@logseq/libs'],
    },
  },
})
