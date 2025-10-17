/// <reference types="vitest" />

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

/**
 * 운영 원칙
 * - 모든 모드에서 API/Socket 목적지는 .env.* 값으로만 결정
 * - Vite dev 서버 프록시(/api, /socket.io) 완전 제거
 * - 프론트 자산 경로(base)와 outDir은 서버(Nginx) 설정과 일치
 */
export default defineConfig(({ command, mode }) => {
  const isDev = command === 'serve'          // npm run dev / dev:remote
  const outDir = 'dist'                      // 🔒 Nginx root와 동일 (/tzchatapp/dist)

  // === 모드 플래그(로깅용) ===
  const isDevLocal     = isDev && mode === 'development'   // npm run dev
  const isDevRemote    = isDev && mode === 'dev-remote'    // npm run dev:remote
  const isWebBuild     = !isDev && mode === 'web'          // npm run build:web
  const isAppBuild     = !isDev && mode === 'app'          // npm run build:app
  const isProdWebBuild = !isDev && mode === 'production'   // npm run build:production

  // ===== 콘솔 로그(동작 확인용) =====
  console.log('================= Vite Config =================')
  console.log('command:', command, '| mode:', mode)
  console.log('flags:', { isDevLocal, isDevRemote, isWebBuild, isAppBuild, isProdWebBuild })
  console.log('base:', '/')
  console.log('outDir:', outDir)
  console.log('dev port:', 8081, '| preview port:', 4173)
  console.log('API/WS -> 프록시 미사용 (항상 .env.* 의 절대 URL 사용)')
  console.log('✅ Vue template will treat <emoji-picker> as custom element (build-time)')
  console.log('================================================')

  return {
    // 🔒 dev/build 동일 경로 기준
    base: '/',

    plugins: [
      vue({
        // ✅ SFC 템플릿 컴파일 단계에서 커스텀 엘리먼트로 인식
        template: {
          compilerOptions: {
            isCustomElement: (tag) => tag === 'emoji-picker',
          },
        },
      }),
    ],

    // 경로 별칭: @ -> src (tsconfig.paths와 일치)
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },

    // ✅ 프록시 완전 제거: .env의 절대 URL만 사용
    server: {
      host: true,
      port: 8081,
      strictPort: true,
    },

    // ✅ build 결과 미리보기
    preview: {
      port: 4173,
      strictPort: true,
    },

    // 🔒 빌드 산출물: 서버 nginx root와 일치
    build: {
      outDir,
      sourcemap: false,
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['vue', 'vue-router', '@ionic/vue', '@vueuse/core', 'axios'],
          },
        },
      },
    },

    // (선택) Vitest 사용 시
    test: {
      globals: true,
      environment: 'jsdom',
    },
  }
})
  