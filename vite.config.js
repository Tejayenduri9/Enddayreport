import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { fileURLToPath } from 'url'

const root = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  resolve: {
    alias: mode === 'karavalli' ? {
      './firebaseConfig': resolve(root, 'src/firebaseConfig.karavalli.js'),
    } : {},
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(root, 'index.html'),
        admin: resolve(root, 'admin.html'),
      },
    },
  },
}))
