// vite.config.ts  (타입 에러 해결: https 옵션을 객체로 지정하여 Vite 타입과 일치)
/// <reference types="vitest" />

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

/**
 * 운영 원칙
 * - 모든 모드에서 API/Socket 목적지는 .env.* 값으로만 결정
 * - Vite dev 서버 프록시(/api, /socket.io) 완전 제거
 * - 프론트 자산 경로(base)와 outDir은 서버(Nginx) 설정과 일치
 * - 레이아웃 디버깅을 위해 dev sourcemap 활성화
 */
export default defineConfig(({ command, mode }) => {
  const isDev = command === 'serve'                    // npm run dev / dev:remote
  const outDir = 'dist'                                // 🔒 Nginx root와 동일 (/tzchatapp/dist)

  // 환경변수에 따라 HTTPS 개발 서버 활성화
  // ⚠️ 일부 타입 정의에서는 server.https가 boolean이 아닌 ServerOptions로 강제되는 경우가 있어
  // boolean 대신 빈 객체 {}를 넣어 타입 에러를 피합니다(모든 필드가 옵션).
  const useHttps = String(process.env.VITE_DEV_HTTPS || '').toLowerCase() === 'true'

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
  console.log('dev port:', 8081, '| preview port:', 4173, '| https:', useHttps)
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
    // ⚠️ 타입 이슈 회피: https는 true 대신 빈 객체({})로 지정
    server: {
      host: true,
      port: 8081,
      strictPort: true,
      ...(useHttps ? { https: {} } : {}),
    },

    // ✅ build 결과 미리보기
    preview: {
      port: 4173,
      strictPort: true,
      // 미리보기는 기본 HTTP, 필요 시 환경변수로 on
      ...(process.env.VITE_PREVIEW_HTTPS?.toLowerCase() === 'true' ? { https: {} } : {}),
    },

    // 🔒 빌드 산출물: 서버 nginx root와 일치
    build: {
      outDir,
      sourcemap: false,
      cssCodeSplit: true,
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['vue', 'vue-router', '@ionic/vue', '@vueuse/core', 'axios'],
          },
        },
      },
      target: 'es2019',
    },

    // 🔎 레이아웃/스타일 디버깅 편의(DEV)
    css: {
      devSourcemap: true,
    },

    // (선택) Vitest 사용 시
    test: {
      globals: true,
      environment: 'jsdom',
    },
  }
})
