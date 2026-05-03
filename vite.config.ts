import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/blue-archive-tl-tool/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
});
