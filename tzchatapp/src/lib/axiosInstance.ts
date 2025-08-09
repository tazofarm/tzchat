// src/lib/axiosInstance.ts
// ------------------------------------------------------
// Axios 인스턴스 (환경별 Base URL + 세션 쿠키 + 상세 로그)
// - .env 로 제어: VITE_API_BASE_URL
// - DEV: http://localhost:2000
// - PROD: https://tzchat.duckdns.org
// ------------------------------------------------------
import axios, { AxiosInstance } from 'axios'

// .env 환경변수에서 API 주소 불러오기 (없으면 로컬 기본값)
const baseURL: string = import.meta.env.VITE_API_BASE_URL || 'http://localhost:2000'

console.log('🌐 [Axios] Base URL:', baseURL)

const instance: AxiosInstance = axios.create({
  baseURL,
  withCredentials: true, // ✅ 세션 쿠키 포함
  timeout: 10000         // 네트워크 지연 대비 타임아웃 (10초)
})

// ====== 요청/응답 인터셉터: 로그 분석용 ======
instance.interceptors.request.use((config) => {
  const { method, url, params, data } = config
  console.log('➡️ [Axios][REQ]', (method || '').toUpperCase(), url, { params, data })
  return config
})

instance.interceptors.response.use(
  (res) => {
    console.log('✅ [Axios][RES]', res.status, res.config.url)
    return res
  },
  (err) => {
    const status = err?.response?.status
    const url = err?.config?.url
    const payload = err?.response?.data || err?.message
    console.error('❌ [Axios][ERR]', status, url, payload)
    return Promise.reject(err)
  }
)

export default instance
