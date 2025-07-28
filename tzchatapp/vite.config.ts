/// <reference types="vitest" />

// import legacy from '@vitejs/plugin-legacy'  // 🔴 빌드 오류 원인: 주석 처리
import vue from '@vitejs/plugin-vue'
import path from 'path'
import { defineConfig } from 'vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue()
    // legacy()  // 🔴 Rollup 오류 방지: 주석 처리
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 8081,         // 개발용 포트
  },
  test: {
    globals: true,
    environment: 'jsdom'
  }
})