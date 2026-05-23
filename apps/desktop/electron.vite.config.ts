import { resolve } from 'path';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@shared': resolve(__dirname, '../../packages/shared-types/src'),
      },
    },
    build: {
      rollupOptions: {
        external: ['better-sqlite3', 'nodejs-whisper'],
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@shared': resolve(__dirname, '../../packages/shared-types/src'),
      },
    },
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve(__dirname, 'src/renderer'),
        '@shared': resolve(__dirname, '../../packages/shared-types/src'),
      },
    },
    plugins: [react()],
    css: {
      postcss: resolve(__dirname, 'postcss.config.js'),
    },
  },
});
