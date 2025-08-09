/// <reference types="vitest" />

import vue from '@vitejs/plugin-vue'
import path from 'path'
import { defineConfig } from 'vite'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // ✅ 빌드 모드에 따라 출력 디렉토리 설정 (기존 유지)
  const outDir = mode === 'app' ? 'www' : 'dist'

  // ✅ 로그 출력 (로그 분석용)
  console.log(`📦 Vite Build Mode: ${mode}`)
  console.log(`📂 Output Directory: ${outDir}`)
  console.log(`🧩 Chunk size limit set to 1000KB`)
  console.log(`🔀 Manual chunking for vendor libs enabled`)

  return {
    /* =========================================================
     * ✅ 핵심 변경: base 경로를 './' → '/' 로 변경
     *  - 배포 경로가 도메인 루트(tzchat.duckdns.org/)인 경우,
     *    SPA 라우트(/signup 등)에서도 CSS/JS가 항상
     *    /assets/... 로 절대 경로로 로드되어 404가 나지 않음.
     *  - 이전 './' 설정은 /signup/assets/... 로 요청되어
     *    배포 서버에서 CSS가 로드되지 않는 문제가 발생했음.
     * ======================================================= */
    base: '/',

    plugins: [
      vue({
        // ✅ ion- 및 emoji-picker 사용자 정의 엘리먼트 처리 (기존 유지)
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
        '@': path.resolve(__dirname, './src'), // @ → src 경로 (기존 유지)
      },
    },

    server: {
      port: 8081, // 개발 서버 포트 (기존 유지)
      proxy: {
        '/api': {
          target: 'http://localhost:2000', // 백엔드 서버 (기존 유지)
          changeOrigin: true,
          secure: false,
          rewrite: (p) => p.replace(/^\/api/, '/api'), // 경로 그대로 유지 (기존 유지)
        }
      }
    },

    build: {
      outDir,                    // 모드에 따라 dist 또는 www (기존 유지)
      chunkSizeWarningLimit: 1000, // 경고 제한 상향 (기존 유지)
      rollupOptions: {
        output: {
          manualChunks: {
            // 외부 라이브러리들을 vendor로 분리 (기존 유지)
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
