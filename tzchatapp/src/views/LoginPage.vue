<template>
  <div class="login-container">
    <div class="login-box">
      <h2>로그인</h2>

      <!-- 로그인 폼 -->
      <form @submit.prevent="login" class="login-form" autocomplete="on">
        <!-- 아이디 입력 -->
        <div class="form-group">
          <label for="login-username">아이디</label>
          <input
            id="login-username"
            name="username"
            type="text"
            placeholder="아이디"
            v-model="username"
            autocomplete="username"
            required
          />
        </div>

        <!-- 비밀번호 입력 -->
        <div class="form-group">
          <label for="login-password">비밀번호</label>
          <input
            id="login-password"
            name="password"
            type="password"
            placeholder="비밀번호"
            v-model="password"
            autocomplete="current-password"
            required
          />
        </div>

        <!-- 로그인 버튼 -->
        <button type="submit">로그인</button>
      </form>

      <!-- 에러 메시지 -->
      <p class="error" v-if="message">{{ message }}</p>

      <!-- 회원가입 링크 -->
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

// 사용자 입력값
const username = ref('')
const password = ref('')
const message = ref('')

// 로그인 함수
const login = async () => {
  try {
    console.log('🔐 입력된 아이디:', username.value)
    console.log('🔐 입력된 비밀번호:', password.value)

    // ✅ 로그인 요청
    const res = await axios.post(
      '/api/login',
      {
        username: username.value,
        password: password.value,
      },
      {
        withCredentials: true, // ✅ 세션 쿠키 포함
      }
    )

    console.log('✅ 로그인 응답:', res.data)
    message.value = res.data.message || '로그인 성공'

    // ✅ 로그인 후 사용자 정보 요청
    const userRes = await axios.get('/api/me', {
      withCredentials: true,
    })

    console.log('👤 로그인한 사용자 정보:', userRes.data.user)

    // ✅ 홈으로 이동
    router.push('/home/1page')
  } catch (err) {
    console.error('❌ 로그인 오류 발생:', err)
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
  color: #ffffff;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* form-group으로 input과 label 정리 */
.form-group {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.login-box label {
  margin-bottom: 0.25rem;
  font-size: 0.95rem;
  color: #ffffff;
}

.login-box input {
  padding: 0.75rem;
  border-radius: 0.5rem;
  border: 1px solid #ccc;
  font-size: 1rem;
  width: 100%;
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
  color: #ffffff;
}

.link-container a {
  color: #3498db;
  text-decoration: none;
}

.link-container a:hover {
  text-decoration: underline;
}
</style>
