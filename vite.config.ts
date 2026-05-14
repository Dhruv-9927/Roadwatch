import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['onnxruntime-web'],
  },
  server: {
    port: 5173,
    host: true,
  },
  build: {
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks: {
          maplibre: ['maplibre-gl'],
          d3:       ['d3'],
          zustand:  ['zustand'],
          dexie:    ['dexie'],
        },
      },
    },
  },
});
