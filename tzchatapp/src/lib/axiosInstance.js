import axios from 'axios'

const instance = axios.create({
  baseURL: 'http://localhost:2000', // 또는 서버 주소
  withCredentials: true // ✅ 세션 쿠키 포함
})

export default instance
