import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5173,
    fs: { allow: ['../..'] },
    // The room server (apps/match) runs beside the game during development.
    proxy: { '/api': { target: 'http://127.0.0.1:8787', ws: true } },
  },
  build: { target: 'es2022', chunkSizeWarningLimit: 2500 },
});
