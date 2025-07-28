<template>
  <div class="login-container">
    <div class="login-box">
      <h2>로그인</h2>

      <form @submit.prevent="login" class="login-form">
        <input v-model="username" type="text" placeholder="아이디" required />
        <input v-model="password" type="password" placeholder="비밀번호" required />
        <button type="submit">로그인</button>
      </form>

      <p class="error" v-if="message">{{ message }}</p>

      <div class="link-container">
        <p>계정이 없으신가요? <router-link to="/signup">회원가입</router-link></p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import axios from '@/lib/axiosInstance'

const router = useRouter()
const username = ref('')
const password = ref('')
const message = ref('')

const login = async () => {
  try {
    // ✅ 로그인 요청
    const res = await axios.post('/api/login', {
      username: username.value,
      password: password.value,
    }, {
      withCredentials: true // ✅ 세션 쿠키 포함
    })

    message.value = res.data.message || '로그인 성공'

    // ✅ 로그인 후 세션으로 유저 정보 조회
    const userRes = await axios.get('/api/me', {
      withCredentials: true
    })

    console.log('✅ 로그인한 사용자 정보:', userRes.data.user)

    // ✅ 로그인 성공 후 이동
    router.push('/home/1page')
  } catch (err) {
    console.error('❌ 로그인 오류:', err)
    message.value = err.response?.data?.message || '로그인 실패'
  }
}
</script>

<style scoped>
.login-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background: #f4f6f9;
  padding: 1rem;
}

.login-box {
  background: rgb(20, 20, 20);
  padding: 2rem;
  border-radius: 1rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  width: 100%;
  max-width: 400px;
  text-align: center;
}

.login-box h2 {
  margin-bottom: 1.5rem;
  font-size: 1.8rem;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.login-box input {
  padding: 0.75rem;
  border-radius: 0.5rem;
  border: 1px solid #ccc;
  font-size: 1rem;
}

.login-box button {
  padding: 0.75rem;
  background: #3498db;
  color: white;
  border: none;
  border-radius: 0.5rem;
  font-size: 1rem;
  cursor: pointer;
  transition: background 0.2s;
}

.login-box button:hover {
  background: #2980b9;
}

.error {
  color: red;
  margin-top: 0.75rem;
  font-size: 0.95rem;
}

.link-container {
  margin-top: 1.5rem;
  font-size: 0.9rem;
}

.link-container a {
  color: #3498db;
  text-decoration: none;
}

.link-container a:hover {
  text-decoration: underline;
}
</style>
