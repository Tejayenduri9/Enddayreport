import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { fileURLToPath } from 'url'

const root = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  define: {
    __RESTAURANT__: JSON.stringify(mode === 'production' ? 'spice' : mode),
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(root, mode === 'karavalli' ? 'index.karavalli.html' : 'index.html'),
        admin: resolve(root, 'admin.html'),
      },
    },
  },
}))
