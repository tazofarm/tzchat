/// <reference types="vitest" />

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

// dev/build/preview 모두 "같은 경로/같은 API 경로"를 쓰게 정렬
export default defineConfig(({ command, mode }) => {
  const isDev = command === 'serve' // npm run dev 또는 dev:remote 모두 serve
  const outDir = 'dist'             // 🔒 Nginx root와 동일 (/tzchatapp/dist)

  // === 모드 플래그 ===
  const isDevLocal   = isDev && mode === 'development' // npm run dev
  const isDevRemote  = isDev && mode === 'dev-remote'  // npm run dev:remote
  const isWebBuild   = !isDev && mode === 'web'        // npm run build:web
  const isProdBuild  = !isDev && mode === 'production' // npm run build:app

  // ===== 콘솔 로그(동작 확인용) =====
  console.log('================= Vite Config =================')
  console.log('command:', command, '| mode:', mode)
  console.log('flags:', { isDevLocal, isDevRemote, isWebBuild, isProdBuild })
  console.log('base:', '/')
  console.log('outDir:', outDir)
  console.log('dev port:', 8081, '| preview port:', 4173)
  console.log(isDevLocal
    ? 'API in dev(local) -> proxy to http://localhost:2000 via /api'
    : 'API -> 프록시 미사용(절대 URL 사용, /api/api 중복 방지)')
  console.log('✅ Vue template will treat <emoji-picker> as custom element (build-time)')
  console.log('================================================')

  // ✅ 로컬 개발에서만 프록시 사용
  const serverProxy = isDevLocal
    ? {
        '/api': {
          target: 'http://localhost:2000',
          changeOrigin: true,
          headers: {
            // 백엔드가 Secure+None 쿠키(JWT) 세팅을 기대할 경우 힌트
            'X-Forwarded-Proto': 'https',
          },
        },
        '/socket.io': {
          target: 'http://localhost:2000',
          changeOrigin: true,
          ws: true,
          headers: {
            'X-Forwarded-Proto': 'https',
          },
        },
      }
    : undefined

  // ✅ preview는 기본적으로 정적 산출물 확인용 — 필요 시 로컬 프록시만
  const previewProxy = isDevLocal ? serverProxy : undefined

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

    // ✅ dev(local)에서만 /api 프록시. dev:remote/빌드는 절대 URL 사용.
    server: {
      host: true,
      port: 8081,
      strictPort: true,
      proxy: serverProxy,
    },

    // ✅ build 결과 미리보기(필요 시 dev(local) 모드와 동일 프록시)
    preview: {
      port: 4173,
      strictPort: true,
      proxy: previewProxy,
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
