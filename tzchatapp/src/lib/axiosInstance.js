// src/lib/axiosInstance.js

import axios from 'axios'

// .env 환경변수에서 API 주소 불러오기
const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:2000/api'

console.log('🌐 Axios Base URL:', baseURL)

const instance = axios.create({
  baseURL,
  withCredentials: true // ✅ 세션 쿠키 포함
})

export default instance