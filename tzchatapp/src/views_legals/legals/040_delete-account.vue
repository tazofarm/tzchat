<!-- src/views/legal/DeleteAccount.vue -->
<template>
  <main class="container">
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
      중요: 계정 삭제는 <u>되돌릴 수 없습니다</u>. 유료 결제나 환불 관련 이슈가 있다면 먼저 고객센터로 문의해 주세요.
    </div>

    <h2>삭제 요청 제출</h2>
    <form @submit.prevent="onSubmit">
      <div class="field">
        <label for="username">아이디 (필수)</label>
        <input
          id="username"
          v-model.trim="form.username"
          required
          :disabled="submitting"
        />
      </div>

      <div class="field">
        <label for="email">이메일 (선택)</label>
        <input
          id="email"
          v-model.trim="form.email"
          type="email"
          placeholder="you@example.com"
          :disabled="submitting"
        />
      </div>

      <div class="field">
        <label for="note">요청 사유 (선택)</label>
        <textarea
          id="note"
          v-model.trim="form.note"
          rows="5"
          placeholder="탈퇴 사유 또는 전달할 내용을 적어주세요."
          :disabled="submitting"
        ></textarea>
      </div>

      <button type="submit" :disabled="submitting">
        {{ submitting ? '전송 중…' : '삭제 요청 보내기' }}
      </button>
    </form>

    <p v-if="message.text" :class="['msg', message.type]">
      {{ message.text }}
    </p>

    <h2>처리 절차</h2>
    <ol>
      <li>요청 접수 → 담당자 검토</li>
      <li>본인확인(필요한 경우) → 삭제 처리</li>
      <li>처리 결과 안내</li>
    </ol>

    <p>
      문의: <a href="mail to:tazocode@gmail.com">tazocode@gmail.com</a>
    </p>
  </main>
</template>

<script setup>
import { reactive, ref, computed } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();

/** 현재 URL이 /home 으로 시작하면 홈 프리픽스 적용 */
const basePath = computed(() => (route.path.startsWith('/home') ? '/home' : ''));

/** API 엔드포인트 생성기: 접속 위치에 따라 /home 프리픽스 자동 부여 */
const apiPath = (slug) => `${basePath.value}/legal/${slug}`;

const form = reactive({
  username: '',
  email: '',
  note: '',
});

const submitting = ref(false);
const message = reactive({
  type: '', // 'success' | 'error'
  text: '',
});

const goBack = () => {
  window.history.back();
};

const onSubmit = async () => {
  if (!form.username) {
    message.type = 'error';
    message.text = '아이디는 필수입니다.';
    return;
  }

  submitting.value = true;
  message.type = '';
  message.text = '';

  try {
    // 접속 위치에 따라 /legal/public-delete-request 또는 /home/legal/public-delete-request
    const res = await fetch(apiPath('public-delete-request'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
      credentials: 'include', // 필요 시 쿠키 인증 고려
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(txt || `서버 오류 (HTTP ${res.status})`);
    }

    message.type = 'success';
    message.text = '삭제 요청이 접수되었습니다. 처리 결과는 별도로 안내됩니다.';
    // 전송 후 폼 초기화
    form.username = '';
    form.email = '';
    form.note = '';
  } catch (err) {
    message.type = 'error';
    message.text = `전송 실패: ${(err && err.message) || '알 수 없는 오류'}`;
  } finally {
    submitting.value = false;
  }
};
</script>

<style scoped>
.container {
  font-family: system-ui, -apple-system, "Segoe UI", Arial, sans-serif;
  margin: 0;
  padding: 2rem;
  line-height: 1.7;
  background: #fafafa;
  color: #111;

  /* ✅ 스크롤 보장 */
  height: 100dvh;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
}

main {
  max-width: 720px;
  margin: 0 auto;
  background: #fff;
  padding: 2rem;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,.08);
}

.back-wrap { margin-bottom: 1rem; }

.back-btn {
  background-color: #0077cc;
  color: #fff;
  border: none;
  padding: 0.6rem 1.2rem;
  border-radius: 6px;
  font-size: 0.9rem;
  cursor: pointer;
}

h1 { margin-top: 0; }

.note {
  background: #fff8e1;
  border: 1px solid #ffe08a;
  padding: 1rem;
  border-radius: 10px;
  margin: 1rem 0;
}

.field { margin: 0.6rem 0; }

label { display: block; margin-bottom: 0.25rem; }

input,
textarea,
button {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 8px;
  font: inherit;
  box-sizing: border-box;
}

button { cursor: pointer; }
button:hover { background: #f5f5f5; }

.msg {
  margin-top: 1rem;
  padding: 0.8rem 1rem;
  border-radius: 8px;
  border: 1px solid transparent;
}
.msg.success {
  background: #f0fff4;
  border-color: #b6f0c2;
}
.msg.error {
  background: #fff5f5;
  border-color: #ffc9c9;
}
</style>
