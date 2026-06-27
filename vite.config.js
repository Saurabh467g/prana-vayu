import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import fs from 'fs';

// Plugin to copy index.html → 404.html after build (fixes GitHub Pages SPA routing)
const copyIndexTo404 = () => ({
  name: 'copy-index-to-404',
  closeBundle() {
    const dist = resolve(__dirname, 'dist');
    fs.copyFileSync(resolve(dist, 'index.html'), resolve(dist, '404.html'));
    console.log('Copied dist/index.html → dist/404.html for GitHub Pages SPA routing');
  }
});

export default defineConfig({
  plugins: [react(), copyIndexTo404()],
  base: '/prana-vayu/',
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        secure: false,
      }
    }
  }
});
