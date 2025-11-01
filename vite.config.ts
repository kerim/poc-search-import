import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    target: 'esnext',
    minify: false,
    sourcemap: false,
    rollupOptions: {
      input: 'index.html',
      external: ['@logseq/libs'],
    },
  },
})
