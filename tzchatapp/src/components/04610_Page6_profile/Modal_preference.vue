<template>
  <div class="popup-overlay" @click.self="$emit('close')">
    <div class="popup-content">
      <h3>성향 수정</h3>

      <!-- 셀렉트 박스 -->
      <select v-model="newPreference" class="select-box">
        <option value="이성친구 - 일반">이성친구 - 일반</option>
        <option value="이성친구 - 특수" disabled>이성친구 - 특수</option>
        <option value="동성친구 - 일반" disabled>동성친구 - 일반</option>
        <option value="동성친구 - 특수" disabled>동성친구 - 특수</option>
      </select>

      <!-- 메시지 -->
      <p v-if="errorMsg" class="error-msg">{{ errorMsg }}</p>
      <p v-if="successMsg" class="success-msg">{{ successMsg }}</p>

      <!-- 버튼 -->
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
import axios from '@/lib/axiosInstance'
import { IonButton } from '@ionic/vue'

const props = defineProps({ message: String })
const emit = defineEmits(['close', 'updated'])

const newPreference = ref('')
const errorMsg = ref('')
const successMsg = ref('')

onMounted(() => {
  newPreference.value = props.message || '이성친구 - 일반'
})

const submitPreference = async () => {
  errorMsg.value = ''
  successMsg.value = ''

  const trimmed = (newPreference.value || '').trim()

  if (!trimmed) {
    errorMsg.value = '값을 선택하세요.'
    return
  }

  if (trimmed === (props.message || '').trim()) {
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
      successMsg.value = '특징이 성공적으로 수정되었습니다.'
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
/* ────────────────────────────────────────────────────────────────
   Preference_Edit_Modal (style scoped)
   - 오버레이: 딤/블러, safe-area, 스크롤 체인 방지
   - 카드: 폭/패딩/라운드/그림자, 타이포 간격
   - 셀렉트: 터치 타깃(≥44px), 라운드 12px, 포커스 링
   - 버튼: 터치 타깃/라운드/간격 통일(모바일 세로, 넓으면 2분할)
   - 메시지: 가독성/여백
   - 모션 최소화 환경 대응
──────────────────────────────────────────────────────────────── */

.popup-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;

  background-color: rgba(0, 0, 0, 0.45);
  -webkit-backdrop-filter: blur(2px);
  backdrop-filter: blur(2px);

  padding: env(safe-area-inset-top, 0px)
           env(safe-area-inset-right, 0px)
           env(safe-area-inset-bottom, 0px)
           env(safe-area-inset-left, 0px);

  overscroll-behavior: contain;
  z-index: 1000;
}

.popup-content {
  width: min(92vw, 360px);
  max-height: min(86vh, 640px);
  overflow: auto;

  background: #fff;
  color: #000;
  border: 1px solid #eaeaea;
  border-radius: 14px;
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.20);
  padding: 16px 18px;
  text-align: center;
  box-sizing: border-box;

  -webkit-font-smoothing: antialiased;
}

.popup-content h3 {
  margin: 0 0 12px;
  font-size: clamp(16px, 3.4vw, 18px);
  font-weight: 800;
  line-height: 1.25;
  letter-spacing: 0.1px;
  color: #000;
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
  transition: box-shadow .15s, border-color .15s;
  appearance: none;              /* iOS 기본 화살표 톤 보정 */
}
.select-box:focus-visible {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59,130,246,.25);
}
.select-box option[disabled] {
  color: #aaa;
}

/* 버튼 그룹: 기본 세로, 넓으면 2분할 */
.button-group {
  display: grid;
  grid-auto-flow: row;
  gap: 8px;
  margin-top: 12px;
}
@media (min-width: 420px) {
  .button-group { grid-template-columns: 1fr 1fr; }
}

/* IonButton 터치 타깃/라운드/두께 */
.button-group ion-button {
  --border-radius: 12px;
  --padding-start: 12px;
  --padding-end: 12px;
  min-height: 40px;
  font-weight: 600;
}

/* 메시지 */
.error-msg,
.success-msg {
  margin: 6px 0 0;
  font-size: clamp(13px, 2.8vw, 14px);
  line-height: 1.35;
}
.error-msg { color: #c0392b; }
.success-msg { color: #2d7a33; }

/* 접근성: 포커스 링 공통 */
:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(59,130,246,.35);
  border-radius: 12px;
}

/* 초소형(≤360px) 보정 */
@media (max-width: 360px) {
  .popup-content { padding: 14px; }
}

/* 모션 최소화 환경 */
@media (prefers-reduced-motion: reduce) {
  * { transition-duration: 0.001ms !important; animation-duration: 0.001ms !important; }
}
</style>
