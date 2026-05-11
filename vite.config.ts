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
  define: {
    __BUILD_DATE__: JSON.stringify(
      new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Tokyo' }).replace(/\//g, '.')
    ),
  },
});
