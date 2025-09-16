<template>
  <div class="popup-overlay" @click.self="$emit('close')" role="presentation">
    <div class="popup-content" role="dialog" aria-modal="true" aria-labelledby="pref-edit-title">
      <h3 id="pref-edit-title">성향 수정</h3>

      <!-- 🔸 셀렉트 박스 -->
      <select v-model="newPreference" class="select-box" aria-label="성향 선택">
        <option value="이성친구 - 일반">이성친구 - 일반</option>
        <option value="이성친구 - 특수" disabled>이성친구 - 특수</option>
        <option value="동성친구 - 일반" disabled>동성친구 - 일반</option>
        <option value="동성친구 - 특수" disabled>동성친구 - 특수</option>
      </select>

      <!-- 🔸 메시지 -->
      <p v-if="errorMsg" class="error-msg">{{ errorMsg }}</p>
      <p v-if="successMsg" class="success-msg">{{ successMsg }}</p>

      <!-- 🔸 버튼 그룹: 가로 2분할(좌: 닫기 / 우: 수정) -->
      <div class="button-group">
        <ion-button expand="block" color="medium" @click="$emit('close')">닫기</ion-button>
        <ion-button expand="block" color="primary" @click="submitPreference">수정</ion-button>
      </div>
    </div>
  </div>
</template>

<script setup>
/* ------------------------------------------------------------------
   Modal_preference.vue
   - 성향(preference) 수정 모달
   - 공통 axios 인스턴스 사용 (세션 쿠키 포함)
   - 입력 검증 / 에러 핸들링 / 성공 후 부모 반영
------------------------------------------------------------------- */
import { ref, onMounted } from 'vue'
import axios from '@/lib/api'
import { IonButton } from '@ionic/vue'

const props = defineProps({ message: String })
const emit = defineEmits(['close', 'updated'])

const newPreference = ref('')
const errorMsg = ref('')
const successMsg = ref('')

onMounted(() => {
  // 초기 값 세팅 (없으면 기본값)
  newPreference.value = props.message || '이성친구 - 일반'
})

const submitPreference = async () => {
  errorMsg.value = ''
  successMsg.value = ''

  const trimmed = (newPreference.value || '').trim()
  const prev = (props.message || '').trim()

  if (!trimmed) {
    errorMsg.value = '값을 선택하세요.'
    return
  }
  if (trimmed === prev) {
    errorMsg.value = '기존 값과 동일합니다.'
    return
  }

  try {
    console.log('[Preference] 업데이트 요청:', trimmed)
    const res = await axios.patch(
      '/api/user/preference',
      { preference: trimmed },
      { withCredentials: true }
    )

    if (res.data?.success) {
      console.log('[Preference] 업데이트 성공', res.data)
      successMsg.value = '성향이 성공적으로 수정되었습니다.'
      setTimeout(() => {
        emit('updated', trimmed)
        emit('close')
      }, 800)
    } else {
      errorMsg.value = res.data?.message || '수정 실패'
    }
  } catch (err) {
    console.error('[Preference] 업데이트 오류', err)
    const status = err?.response?.status
    if (status === 404) errorMsg.value = 'API 경로가 없습니다. 서버를 확인하세요.'
    else if (status === 500) errorMsg.value = '서버 오류가 발생했습니다.'
    else errorMsg.value = '알 수 없는 오류가 발생했습니다.'
  }
}
</script>

<style scoped>
/* ===========================================================
   성향 수정 모달 - 기준 템플릿 적용
   - dim+blur 오버레이, safe-area 패딩
   - 카드: 화이트, 검정 텍스트, 폭 min(92vw, 420px)
   - 버튼: 항상 가로 2분할 (닫기/수정)
   - 메시지/포커스/애니메이션 통일
=========================================================== */

/* 오버레이 */
.popup-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(0, 0, 0, 0.45);
  -webkit-backdrop-filter: blur(2px);
  backdrop-filter: blur(2px);
  z-index: 1000;
  overscroll-behavior: contain;
  padding: calc(env(safe-area-inset-top, 0px) + 12px)
           12px
           calc(env(safe-area-inset-bottom, 0px) + 12px);
}

/* 카드 */
.popup-content {
  background: #fff;
  color: #000;
  width: min(92vw, 420px);          /* ▶ 기준 폭으로 통일 */
  max-height: min(86vh, 640px);
  border: 1px solid #eaeaea;
  border-radius: 14px;
  box-shadow: 0 10px 28px rgba(0,0,0,0.18);
  padding: 16px 18px;
  text-align: center;
  overflow: auto;
  box-sizing: border-box;
  animation: modal-in .18s ease-out;
  transform-origin: center;
}

/* 제목 */
.popup-content h3 {
  margin: 0 0 12px;
  font-size: clamp(16px, 3.4vw, 18px);
  font-weight: 800;
  line-height: 1.25;
  letter-spacing: .1px;
}

/* 셀렉트 박스 */
.select-box {
  width: 100%;
  min-height: 44px;              /* 터치 타깃 */
  padding: 10px 12px;
  margin: 12px 0 8px;
  font-size: clamp(14px, 2.6vw, 15px);
  color: #000;
  background: #fff;
  border: 1px solid #d9d9d9;
  border-radius: 12px;           /* 통일된 라운드 */
  outline: none;
  transition: border-color .15s, box-shadow .15s;
  appearance: none;
}
.select-box:focus-visible {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59,130,246,.25);
}
.select-box option[disabled] { color: #aaa; }

/* 버튼 그룹: 항상 가로 2분할 (좌 닫기 / 우 수정) */
.button-group {
  display: grid;
  grid-template-columns: 1fr 1fr;  /* ← 가로 고정 */
  gap: 10px;
  margin-top: 12px;
}

/* IonButton 공통 */
.button-group ion-button {
  --border-radius: 12px;
  --padding-start: 12px;
  --padding-end: 12px;
  --padding-top: 10px;
  --padding-bottom: 10px;
  min-height: 44px;
  font-weight: 700;
}

/* 메시지 */
.error-msg,
.success-msg {
  margin: 6px 0 0;
  font-size: clamp(14px, 2.8vw, 15px);
  line-height: 1.3;
  word-break: break-word;
}
.error-msg { color: #c0392b; }
.success-msg { color: #2d7a33; }

/* 접근성: 포커스 링 */
:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(59,130,246,.35);
  border-radius: 12px;
}

/* 초소형 화면 보정 */
@media (max-width: 360px) {
  .popup-content { padding: 14px; width: 94vw; }
}

/* 모션 최소화 */
@media (prefers-reduced-motion: reduce) {
  .popup-content { animation: none !important; }
}

/* 등장 애니메이션 */
@keyframes modal-in {
  from { opacity: 0; transform: translateY(6px) scale(.98); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
</style>
