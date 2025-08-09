/// <reference types="vitest" />

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
  console.log(`🧩 Chunk size limit set to 1000KB`)
  console.log(`🔀 Manual chunking for vendor libs enabled`)

  return {
    // ✅ 배포 시 상대 경로로 자산 로드 (CSS/JS 404 방지)
    base: './',

    plugins: [
      vue({
        // ✅ ion- 및 emoji-picker 사용자 정의 엘리먼트 처리
        template: {
          compilerOptions: {
            isCustomElement: (tag) =>
              tag.startsWith('ion-') || tag === 'emoji-picker'
          }
        }
      })
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'), // @ → src 경로
      },
    },
    server: {
      port: 8081, // 개발 서버 포트
      proxy: {
        '/api': {
          target: 'http://localhost:2000', // 백엔드 서버
          changeOrigin: true,
          secure: false,
          rewrite: (p) => p.replace(/^\/api/, '/api'),
        }
      }
    },
    build: {
      outDir,  // 모드에 따라 dist 또는 www
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: [
              'vue',
              'vue-router',
              '@ionic/vue',
              '@vueuse/core',
              'axios'
            ]
          }
        }
      }
    },
    test: {
      globals: true,
      environment: 'jsdom'
    }
  }
})
