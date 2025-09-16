<template>
  <main class="page">
    <!-- 뒤로가기 버튼 -->
    <div class="back-wrap">
      <button class="back-btn" @click="goBack">← 뒤로가기</button>
    </div>

    <h1>계정 삭제 안내</h1>
    <p>
      회원 탈퇴를 요청하시면 법령에서 별도 보관을 요구하는 정보를 제외하고 지체없이 삭제됩니다.
      대화 기록 등 일부 데이터는 상대방의 기록 보존을 위해 완전 삭제가 어려울 수 있습니다.
    </p>

    <div class="note">
      <b>중요:</b> 계정 삭제는 <u>되돌릴 수 없습니다</u>. 유료 결제나 환불 관련 이슈가 있다면
      먼저 고객센터로 문의해 주세요.
    </div>

    <h2>삭제 요청 제출</h2>
    <form @submit.prevent="submitDeleteRequest">
      <div class="field">
        <label for="username">아이디 (필수)</label>
        <input id="username" v-model="form.username" required />
      </div>
      <div class="field">
        <label for="email">이메일 (선택)</label>
        <input id="email" v-model="form.email" type="email" placeholder="you@example.com" />
      </div>
      <div class="field">
        <label for="note">요청 사유 (선택)</label>
        <textarea
          id="note"
          v-model="form.note"
          rows="5"
          placeholder="탈퇴 사유 또는 전달할 내용을 적어주세요."
        ></textarea>
      </div>
      <button type="submit">삭제 요청 보내기</button>
    </form>

    <h2>처리 절차</h2>
    <ol>
      <li>요청 접수 → 담당자 검토</li>
      <li>본인확인(필요한 경우) → 삭제 처리</li>
      <li>처리 결과 안내</li>
    </ol>

    <p>문의: <a href="mailto:tazocode@gmail.com">tazocode@gmail.com</a></p>
  </main>
</template>

<script setup>
import { reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import axios from '@/lib/api' // ← 프로젝트 axios 인스턴스 경로에 맞게 수정하세요

const router = useRouter()

const form = reactive({
  username: '',
  email: '',
  note: ''
})

function goBack() {
  if (window.history.length > 1) window.history.back()
  else router.push('/')
}

async function submitDeleteRequest() {
  try {
    const res = await axios.post('/legal/public-delete-request', form)
    alert('삭제 요청이 접수되었습니다.')
    router.push('/')
  } catch (err) {
    console.error(err)
    alert('요청 처리 중 오류가 발생했습니다.')
  }
}

onMounted(() => {
  document.title = '계정 삭제 안내 | 네네챗'
})
</script>

<style scoped>
.page {
  max-width: 720px;
  margin: 0 auto;
  background: #fff;
  padding: 2rem;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  font-family: system-ui, -apple-system, Segoe UI, Arial, sans-serif;
  line-height: 1.7;
  color: #111;
}
:root,
:host,
body {
  background: #fafafa;
}

h1 {
  margin-top: 0;
}
.note {
  background: #fff8e1;
  border: 1px solid #ffe08a;
  padding: 1rem;
  border-radius: 10px;
  margin: 1rem 0;
}
.field {
  margin: 0.6rem 0;
}
label {
  display: block;
  margin-bottom: 0.25rem;
}
input,
textarea,
button {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 8px;
  font: inherit;
}
button {
  cursor: pointer;
}
button:hover {
  background: #f5f5f5;
}
.back-wrap {
  margin-bottom: 1rem;
}
.back-btn {
  background-color: #0077cc;
  color: #fff;
  border: none;
  padding: 0.6rem 1.2rem;
  border-radius: 6px;
  font-size: 0.9rem;
  cursor: pointer;
}
.back-btn:hover {
  opacity: 0.9;
}
</style>
