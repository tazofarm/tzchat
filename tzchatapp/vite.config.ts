/// <reference types="vitest" />

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

// dev/build/preview 모두 "같은 경로/같은 API 경로"를 쓰게 정렬
export default defineConfig(({ command, mode }) => {
  const isDev = command === 'serve' // npm run dev
  const outDir = 'dist'             // 🔒 Nginx root와 동일 (/tzchatapp/dist)

  // ===== 콘솔 로그(동작 확인용) =====
  console.log('================= Vite Config =================')
  console.log('command:', command, '| mode:', mode)
  console.log('base:', '/')
  console.log('outDir:', outDir)
  console.log('dev port:', 8081, '| preview port:', 4173)
  console.log('API in dev -> proxy to http://localhost:2000 via /api')
  console.log('================================================')

  return {
    // 🔒 dev/build 동일 경로 기준
    base: '/',

    plugins: [
      vue(),
    ],

    // 경로 별칭: @ -> src (tsconfig.paths와 일치)
    resolve: {
      alias: {
        '@': path.resolve(process.cwd(), 'src'),
      },
    },

    // ✅ dev 환경을 서버와 최대한 같게: /api 프록시
    server: {
      host: true,
      port: 8081,
      strictPort: true,
      proxy: {
        '/api': {
          target: 'http://localhost:2000',
          changeOrigin: true,
        },
        // (있다면) 소켓도 동일 경로 사용
        '/socket.io': {
          target: 'http://localhost:2000',
          ws: true,
          changeOrigin: true,
        },
      },
    },

    // ✅ build 결과 미리보기(배포와 동일 경로/포트 고정)
    preview: {
      port: 4173,
      strictPort: true,
      // 필요시 프록시도 동일하게 두면 외형·데이터 타이밍까지 맞추기 쉬움
      proxy: {
        '/api': {
          target: 'http://localhost:2000',
          changeOrigin: true,
        },
        '/socket.io': {
          target: 'http://localhost:2000',
          ws: true,
          changeOrigin: true,
        },
      },
    },

    // 🔒 빌드 산출물: 서버 nginx root와 일치
    build: {
      outDir,
      sourcemap: false,            // UI 동일성에는 영향 없음(원하면 true)
      chunkSizeWarningLimit: 1000, // 참고 로그
      rollupOptions: {
        output: {
          // 해시 파일명(기본값) → /assets immutable 캐시 전략과 호환
          // 파일 구조는 기본값 유지(동일성 목적)
          manualChunks: {
            // 벤더 청크 분리(캐시 안정성 ↑) — 기존 의도 유지
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

    // (선택) Vitest 사용 시
    test: {
      globals: true,
      environment: 'jsdom',
    },
  }
})
