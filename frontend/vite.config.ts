import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The Django API runs on :8010; in development Vite forwards /api to it.
export default defineConfig({
  plugins: [react()],
  server: {
    // The footer imports ../VERSION (bumped with scripts/bump-version.sh); let the dev server read it.
    fs: { allow: ['..'] },
    proxy: { '/api': 'http://127.0.0.1:8010' },
  },
})
