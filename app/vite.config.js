import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync('./package.json', 'utf8'));

export default defineConfig({
  plugins: [react()],
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(pkg.version),
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    target: 'es2020',
    rollupOptions: {
      output: {
        // Three.js is a third of the bundle and is only needed once the globe
        // is opened; splitting it keeps the first frame off its download.
        manualChunks: {
          three: ['three'],
          atlas: ['world-atlas/land-110m.json', 'topojson-client'],
        },
      },
    },
  },
  server: { host: true, port: 5173 },
});
