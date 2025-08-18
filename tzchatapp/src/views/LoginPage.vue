<template>
  <div class="login-container">
    <div class="login-box">

       <h2>Yes? Yes!</h2>
       <h2>네네챗1</h2>

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
    router.push('/home/2page')
  } catch (err) {
    console.error('❌ 로그인 오류 발생:', err)
    message.value = err.response?.data?.message || '로그인 실패'
  }
}
</script>

<style scoped>

/* ✅ 로그인 화면 - 비율 보정 전용(CSS만 수정, 구조 불변)
   - 라벨(아이디/비밀번호) 가독성 ↑ : 16~17px + 굵기 600
   - 입력/버튼은 16px, 높이 48px 유지(모바일 터치 타깃)
   - 오토필, 포커스 가시성, 안전영역, 작은 화면 대응 유지
*/

/* 전체 레이아웃 */
.login-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100dvh; /* 모바일 주소창 높이 변동 대응 */
  padding: clamp(12px, 3vw, 20px);
  padding-top: calc(env(safe-area-inset-top, 0px) + clamp(12px, 3vw, 20px));
  padding-bottom: calc(env(safe-area-inset-bottom, 0px) + clamp(12px, 3vw, 20px));
  padding-left: calc(env(safe-area-inset-left, 0px) + clamp(12px, 3vw, 20px));
  padding-right: calc(env(safe-area-inset-right, 0px) + clamp(12px, 3vw, 20px));
  background: #f4f6f9;
  color: #111; /* 기본 글자색(가독성) */
  overscroll-behavior: contain; /* 뷰포트 바운스 최소화 */
}

/* 로그인 카드 */
.login-box {
  width: min(100%, 420px);
  background: #141414;
  color: #fff; /* 다크 카드 내부는 흰색 유지 */
  padding: clamp(16px, 4.5vw, 28px);
  border-radius: 16px;
  box-shadow: 0 6px 18px rgba(0,0,0,0.25);
  text-align: center;
}

/* 제목: 반응형 크기 + 간격(기존 유지) */
.login-box h2 {
  margin: 0 0 clamp(8px, 2vw, 12px) 0;
  font-size: clamp(18px, 4.5vw, 24px);
  line-height: 1.25;
  color: #ffffff;
}
.login-box h2:last-of-type { margin-bottom: clamp(14px, 3vw, 18px); }

/* 폼 */
.login-form {
  display: flex;
  flex-direction: column;
  gap: clamp(12px, 3vw, 16px); /* 그룹 간격 살짝 ↑ */
}

/* 그룹 */
.form-group {
  display: flex;
  flex-direction: column;
  align-items: stretch; /* 모바일 넓이 꽉 채움 */
}

/* 라벨: ★ 비율 보정 핵심 */
.login-box label {
  margin-bottom: 8px;                   /* 6px → 8px */
  font-size: clamp(16px, 2.8vw, 17px);  /* 0.95rem → 16~17px */
  font-weight: 600;                     /* 굵기 추가로 시인성 ↑ */
  letter-spacing: 0.1px;                /* 미세 가독성 보정 */
  color: #ffffff;
}

/* 입력창 */
.login-box input {
  width: 100%;
  min-height: 48px;            /* 터치 타깃 유지 */
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid #cfcfcf;
  font-size: 16px;             /* iOS 입력 확대 방지 기준 */
  background: #ffffff;
  color: #111;
  outline: none;
  transition: box-shadow .15s, border-color .15s;
  accent-color: #3498db;       /* 체크/라디오 등 포커스 컬러 */
}
.login-box input::placeholder { color: #8d8d8d; }

/* 오토필(자동완성) 가독성 보정 */
.login-box input:-webkit-autofill,
.login-box input:-webkit-autofill:hover,
.login-box input:-webkit-autofill:focus {
  -webkit-text-fill-color: #111;
  transition: background-color 5000s;
  box-shadow: 0 0 0px 1000px #fff inset;
}

/* 포커스 가시성 */
.login-box input:focus-visible {
  border-color: #3498db;
  box-shadow: 0 0 0 3px rgba(52,152,219,0.25);
  border-radius: 12px;
}

/* 버튼 */
.login-box button {
  width: 100%;
  min-height: 48px;            /* 터치 타깃 유지 */
  padding: 12px 14px;
  background: #3498db;
  color: #fff;
  border: none;
  border-radius: 12px;
  font-size: 16px;             /* 입력과 동일 스케일 */
  font-weight: 700;            /* 600 → 700로 대비 약간 ↑ */
  cursor: pointer;
  transition: background .2s, transform .08s ease-out, opacity .2s;
  will-change: transform;
}
.login-box button:hover { background: #2980b9; }
.login-box button:active { transform: translateY(1px); }
.login-box button:disabled { opacity: 0.6; cursor: not-allowed; }

/* 키보드 포커스 */
.login-box button:focus-visible {
  outline: 3px solid rgba(52,152,219,0.5);
  outline-offset: 2px;
}

/* 메시지 */
.error {
  color: #ff5252;
  margin-top: 10px;
  font-size: clamp(15px, 2.6vw, 16px);  /* 가독성 소폭 ↑ */
  line-height: 1.45;
  word-break: break-word;
}

/* 하단 링크 */
.link-container {
  margin-top: clamp(16px, 3.5vw, 22px);
  font-size: clamp(15px, 2.6vw, 16px);  /* 가독성 소폭 ↑ */
  line-height: 1.45;
  color: #ffffff;
  word-break: break-word;
}
.link-container a { color: #7dc3ff; text-decoration: none; }
.link-container a:hover { text-decoration: underline; }
.link-container a:focus-visible {
  outline: 2px solid rgba(125,195,255,0.7);
  outline-offset: 2px;
  border-radius: 6px;
}

/* 스크롤바 얇게(데스크톱 보조) */
* { scrollbar-width: thin; scrollbar-color: #bbb transparent; }
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-thumb { background: #bbb; border-radius: 4px; }

/* 아주 작은 화면에서 패딩 축소 */
@media (max-width: 320px) {
  .login-container { padding: 8px; }
  .login-box { padding: 14px; }
}

/* 사용자 접근성 설정 존중: 모션 최소화 */
@media (prefers-reduced-motion: reduce) {
  * { transition-duration: 0.001ms !important; animation-duration: 0.001ms !important; }
}


</style>
