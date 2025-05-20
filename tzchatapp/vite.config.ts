import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'path'; // ✅ 이 줄 추가

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src') // ✅ 여기 추가
    }
  },
  server: {
    port: 8083
  },
  build: {
    outDir: 'dist'
  }
});