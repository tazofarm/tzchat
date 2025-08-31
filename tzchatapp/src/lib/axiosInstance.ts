// src/lib/axiosInstance.ts
// ------------------------------------------------------
// Axios 인스턴스 (환경별 Base URL + 세션 쿠키 + 상세 로그)
// - .env 로 제어: VITE_API_BASE_URL
// - DEV 기본값 : http://localhost:2000
// - PROD 예시  : https://tzchat.duckdns.org
// - 변경사항 요약:
//   1) baseURL 끝 슬래시 제거 → 이중 슬래시(//) 방지
//   2) 요청 url 앞 슬래시 제거 → baseURL + url 결합시 안전
//   3) 요청/응답/에러 로그 강화(분석 용이)
//   4) 기존 구조 최대 유지
// ------------------------------------------------------
import axios, {
  AxiosInstance,
  InternalAxiosRequestConfig,
  AxiosResponse,
  AxiosError,
} from 'axios'

// 0) .env에서 API 주소 로드 (없으면 로컬 기본값)
//    - 예: VITE_API_BASE_URL=https://tzchat.duckdns.org
const RAW_BASE_URL: string = import.meta.env.VITE_API_BASE_URL || 'http://localhost:2000'

// 1) baseURL 끝의 슬래시 제거 (예: https://host/ → https://host)
const BASE_URL = RAW_BASE_URL.replace(/\/+$/, '')

// 초기 로깅: 환경별 설정 확인
console.log('🌐 [Axios] Base URL (raw):', RAW_BASE_URL)
console.log('🌐 [Axios] Base URL (normalized):', BASE_URL)

const instance: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  withCredentials: true, // ✅ 세션 쿠키 포함(로그인 유지 핵심)
  timeout: 10000,        // ⏱️ 네트워크 지연 대비 타임아웃 (10초)
})

// ================================================
// 요청 인터셉터: 경로 정규화 + 상세 로그
// ================================================
instance.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    try {
      // 2) 요청 url 앞 슬래시 제거 (예: /api/login → api/login)
      if (config.url) {
        const before = config.url
        config.url = config.url.replace(/^\/+/, '')
        if (before !== config.url) {
          console.log('🧹 [Axios][REQ] URL normalized:', before, '→', config.url)
        }
      }

      const { method, url, params, data, headers } = config

      // 로그: 민감정보/쿠키 노출 최소화, 구조 확인 위주
      console.log('➡️ [Axios][REQ]', (method || '').toUpperCase(), url, {
        baseURL: config.baseURL,
        withCredentials: config.withCredentials,
        params,
        // data는 보통 JSON이므로 길면 잘려서 보이지만, 분석에 유용
        data,
        // 필요한 경우에만 헤더 디버깅 (기본은 요약)
        headersSummary: {
          'Content-Type': headers?.['Content-Type'] || headers?.['content-type'],
          'X-Requested-With': headers?.['X-Requested-With'] || headers?.['x-requested-with'],
        },
      })
    } catch (e) {
      console.warn('⚠️ [Axios][REQ] 로깅/정규화 중 예외:', e)
    }
    return config
  },
  (error: AxiosError) => {
    console.error('❌ [Axios][REQ] 인터셉터 오류:', error.message)
    return Promise.reject(error)
  }
)

// ================================================
// 응답 인터셉터: 정상/에러 상세 로그
// ================================================
instance.interceptors.response.use(
  (res: AxiosResponse) => {
    try {
      console.log('✅ [Axios][RES]', res.status, res.config?.url, {
        // 필요시 헤더 참조: Set-Cookie는 브라우저 환경에서 비표시일 수 있음
        // 'set-cookie': res.headers?.['set-cookie'],
        timing: {
          // 성능 분석용(있으면): 서버 처리 시간 등 커스텀 헤더
          'x-response-time': res.headers?.['x-response-time'],
          'server-timing': res.headers?.['server-timing'],
        },
      })
    } catch (e) {
      console.warn('⚠️ [Axios][RES] 로깅 중 예외:', e)
    }
    return res
  },
  (err: AxiosError) => {
    try {
      const status = err?.response?.status
      const url = err?.config?.url
      // 서버에서 보낸 에러 바디(JSON/문자열 등)
      const payload = (err?.response?.data as any) || err?.message

      console.error('❌ [Axios][ERR]', status, url, payload)

      // 네트워크/타임아웃/취소 등 구분 로깅
      if (err.code === 'ECONNABORTED') {
        console.error('⏰ [Axios][ERR] 요청 타임아웃 발생:', err.message)
      } else if (err.message?.includes('Network Error')) {
        console.error('📡 [Axios][ERR] 네트워크 오류(도메인/SSL/CORS) 가능성:', err.message)
      }
    } catch (e) {
      console.warn('⚠️ [Axios][ERR] 로깅 중 예외:', e)
    }
    return Promise.reject(err)
  }
)

export default instance
