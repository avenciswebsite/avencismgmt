import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

function cloudflareSpaPlugin(): Plugin {
  return {
    name: 'cloudflare-spa-fallback',
    closeBundle() {
      const indexPath = path.resolve(__dirname, 'dist/index.html');
      const spaFallbackPath = path.resolve(__dirname, 'dist/200.html');
      if (fs.existsSync(indexPath)) {
        fs.copyFileSync(indexPath, spaFallbackPath);
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), cloudflareSpaPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    open: false,
  },
});
