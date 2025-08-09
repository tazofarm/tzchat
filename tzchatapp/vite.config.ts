/// <reference types="vitest" />

import vue from '@vitejs/plugin-vue'
import path from 'path'
import { defineConfig } from 'vite'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // ✅ 빌드 모드별 출력 디렉토리 (기존 유지)
  const outDir = mode === 'app' ? 'www' : 'dist'

  // ===== 로그 (배포 확인용) =====
  console.log(`📦 Vite Build Mode: ${mode}`)
  console.log(`📂 Output Directory: ${outDir}`)
  console.log(`🧩 Chunk size limit set to 1000KB`)
  console.log(`🔀 Manual chunking for vendor libs enabled`)
  console.log(`🛣️ Base path: /`)

  return {
    /* =========================================================
     * ✅ 핵심: base는 도메인 루트('/')로 고정
     *    - /signup 같은 라우트에서도 /assets/... 절대경로로 로드
     *    - './' 사용 시 하위 라우트에서 404 가능성 ↑
     * ======================================================= */
    base: '/',

    plugins: [
      vue({
        // ✅ ion-* 및 emoji-picker를 커스텀 엘리먼트로 처리
        template: {
          compilerOptions: {
            isCustomElement: (tag) =>
              tag.startsWith('ion-') || tag === 'emoji-picker',
          },
        },
      }),
    ],

    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'), // @ → src
      },
    },

    server: {
      host: true,
      port: 8081, // 개발 서버 포트
      proxy: {
        // ✅ API 프록시 (로컬 개발 편의)
        '/api': {
          target: 'http://localhost:2000',
          changeOrigin: true,
          secure: false,
          rewrite: (p) => p.replace(/^\/api/, '/api'),
        },
      },
    },

    build: {
      outDir,                       // dist 또는 www
      sourcemap: false,
      target: 'es2018',
      chunkSizeWarningLimit: 1000,  // 경고 기준 상향
      rollupOptions: {
        output: {
          // ✅ 외부 라이브러리 vendor 청크 분리(캐시 안정성↑)
          manualChunks: {
            vendor: [
              'vue',
              'vue-router',
              '@ionic/vue',
              '@vueuse/core',
              'axios',
            ],
          },
        },
      },
    },

    // Vitest (있을 경우)
    test: {
      globals: true,
      environment: 'jsdom',
    },
  }
})
