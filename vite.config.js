import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { fileURLToPath } from 'url'

const root = fileURLToPath(new URL('.', import.meta.url))

// A unique id for this build. It is baked into the app bundle (__BUILD_ID__)
// and also written to dist/version.json. An already-open tab polls version.json
// and, when the deployed id no longer matches the one it started with, reloads
// itself — so kiosks pick up new deploys on their own.
const BUILD_ID = String(Date.now())

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    {
      name: 'emit-version-json',
      generateBundle() {
        this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ buildId: BUILD_ID }) })
      },
    },
  ],
  define: {
    __RESTAURANT__: JSON.stringify(mode === 'production' ? 'spice' : mode),
    __BUILD_ID__: JSON.stringify(BUILD_ID),
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
