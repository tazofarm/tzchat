/// <reference types="vitest" />

import legacy from '@vitejs/plugin-legacy'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import { defineConfig } from 'vite'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // 빌드 모드에 따라 출력 디렉토리 설정
  const outDir = mode === 'app' ? 'www' : 'dist'

  // 로그 출력 (로그 분석용)
  console.log(`📦 Vite Build Mode: ${mode}`)
  console.log(`📂 Output Directory: ${outDir}`)

  return {
    plugins: [
      vue(),              // Vue 플러그인
      legacy(),           // 구형 브라우저 호환성 플러그인
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'), // @ → src 경로로 매핑
      },
    },
    server: {
      port: 8081, // 개발 서버 포트 (npm run dev)
    },
    build: {
      outDir,            // 'dist' 또는 'www'로 빌드 디렉토리 지정
    },
    test: {
      globals: true,
      environment: 'jsdom'
    }
  }
})
