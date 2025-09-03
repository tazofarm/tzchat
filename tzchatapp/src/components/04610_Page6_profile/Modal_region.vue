<template>
  <div class="popup-overlay" @click.self="$emit('close')">
    <div class="popup-content" role="dialog" aria-modal="true" aria-labelledby="region-edit-title">
      <h3 id="region-edit-title">지역 수정</h3>

      <div class="select-group">
        <label for="region1">지역1 (시/도)</label>
        <select id="region1" v-model="selectedRegion1" @change="onRegion1Change">
          <option disabled value="">시/도 선택</option>
          <option v-for="(districts, province) in regions" :key="province">{{ province }}</option>
        </select>

        <label for="region2">지역2 (시/군/구)</label>
        <select id="region2" v-model="selectedRegion2">
          <option disabled value="">시/군/구 선택</option>
          <option v-for="district in region2Options" :key="district">{{ district }}</option>
        </select>
      </div>

      <p v-if="errorMsg" class="error-msg" role="alert">{{ errorMsg }}</p>
      <p v-if="successMsg" class="success-msg" role="status">{{ successMsg }}</p>

      <div class="button-group">
        <ion-button expand="block" color="medium" @click="$emit('close')">닫기</ion-button>
        <ion-button
          expand="block"
          color="primary"
          @click="submitRegion"
          :disabled="isSubmitting"
        >
          {{ isSubmitting ? '수정 중…' : '수정' }}
        </ion-button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { IonButton } from '@ionic/vue'
import axios from '@/lib/axiosInstance'
import { regions } from '@/data/regions.js'

// props 및 emit 정의
const props = defineProps({
  // 예: '서울 강남구' 또는 '서울특별시 강남구'
  message: { type: String, default: '' }
})
const emit = defineEmits(['close', 'updated'])

// 상태 변수
const selectedRegion1 = ref('')
const selectedRegion2 = ref('')
const region2Options = ref([])

const errorMsg = ref('')
const successMsg = ref('')
const isSubmitting = ref(false)

// 초기 세팅: message를 기반으로 selectedRegion1/2 설정
onMounted(() => {
  applyInitialMessage(props.message)
})

watch(
  () => props.message,
  (val) => applyInitialMessage(val),
  { immediate: false }
)

function applyInitialMessage(msg = '') {
  try {
    const [r1, r2] = (msg || '').split(' ')
    selectedRegion1.value = r1 || ''
    selectedRegion2.value = r2 || ''
    region2Options.value = regions[r1] || []
  } catch {
    selectedRegion1.value = ''
    selectedRegion2.value = ''
    region2Options.value = []
  }
}

// 지역1 변경 시 하위 옵션 재설정
const onRegion1Change = () => {
  region2Options.value = regions[selectedRegion1.value] || []
  selectedRegion2.value = ''
}

// 서버 전송
const submitRegion = async () => {
  errorMsg.value = ''
  successMsg.value = ''

  const r1 = (selectedRegion1.value || '').trim()
  const r2 = (selectedRegion2.value || '').trim()

  if (!r1 || !r2) {
    errorMsg.value = '지역을 모두 선택하세요.'
    return
  }

  const combined = `${r1} ${r2}`
  if (combined === (props.message || '').trim()) {
    errorMsg.value = '기존 지역과 동일합니다.'
    return
  }

  try {
    isSubmitting.value = true
    const res = await axios.patch(
      '/api/user/region',
      { region1: r1, region2: r2 },
      { withCredentials: true }
    )

    // 서버가 일관되게 { ok: true } 또는 { message: '...' }를 줄 수 있음
    if (res.data?.ok || res.data?.message) {
      console.log('[Modal_region] 지역 수정 성공 →', combined)
      successMsg.value = '지역이 성공적으로 수정되었습니다.'
      setTimeout(() => {
        emit('updated', combined)
        emit('close')
      }, 900)
    } else {
      errorMsg.value = res.data?.message || '수정 실패'
    }
  } catch (err) {
    console.error('[Modal_region] 서버 오류', err)
    errorMsg.value = err?.response?.data?.message || '서버 오류가 발생했습니다.'
  } finally {
    isSubmitting.value = false
  }
}
</script>

<style scoped>
/* ──────────────────────────────────────────────────────────────
   지역 수정 모달 - CSS 보정(HTML/JS 변경 최소)
   목적
   - 모바일 가독성(검정 글씨) & 터치 타깃 강화(≥44px)
   - 안전영역(safe-area) / 작은 화면 스크롤 안정성
   - 포커스 접근성(:focus-visible) / 모션 최소화 대응
   - 일관된 여백·그림자·라운드 및 반응형 폰트 스케일
────────────────────────────────────────────────────────────── */

/* 오버레이: 화면 전체 덮기 + 살짝 블러 */
.popup-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;             /* 세로 중앙 */
  justify-content: center;         /* 가로 중앙 */
  background-color: rgba(0, 0, 0, 0.45);
  -webkit-backdrop-filter: blur(2px);
  backdrop-filter: blur(2px);
  z-index: 1000;

  /* 스크롤 체인/바운스 방지 + 안전영역 반영 */
  overscroll-behavior: contain;
  padding: calc(env(safe-area-inset-top, 0px) + 12px)
           12px
           calc(env(safe-area-inset-bottom, 0px) + 12px);
}

/* 모달 카드 */
.popup-content {
  background: #fff;
  color: #000;                     /* 가독성: 기본 검정 */
  width: min(92vw, 420px);
  max-height: min(86vh, 640px);    /* 작은 화면에서 넘치면 내부 스크롤 */
  border: 1px solid #eaeaea;
  border-radius: 14px;
  box-shadow: 0 10px 28px rgba(0,0,0,0.18);
  padding: 16px 18px;
  text-align: center;              /* 기존 가운데 정렬 유지 */
  overflow: auto;                  /* 내부 스크롤 */
  box-sizing: border-box;
  animation: modal-in .18s ease-out;
  transform-origin: center;
}

/* 제목 */
.popup-content h3 {
  margin: 0 0 10px;
  font-size: clamp(16px, 3.4vw, 18px);
  font-weight: 800;
  line-height: 1.25;
}

/* 선택 그룹 레이아웃: 라벨/셀렉트 간격 일관화 */
.select-group {
  margin-top: 12px;
  text-align: left;
  display: grid;
  grid-template-columns: 1fr;      /* 단일 컬럼 */
  grid-row-gap: 8px;               /* 요소 간 간격 */
}

/* 라벨: 시인성 강화 */
.select-group label {
  font-size: clamp(14px, 2.8vw, 15px);
  font-weight: 700;
  color: #111;
  letter-spacing: 0.1px;
}

/* 셀렉트: iOS 확대 방지(16px), 포커스 링, 터치 타깃 강화 */
.select-group select {
  width: 100%;
  min-height: 44px;                /* 터치 타깃 */
  padding: 10px 12px;
  font-size: 16px;                 /* iOS 줌 방지 기준값 */
  line-height: 1.3;
  background: #fff;
  color: #111;
  border: 1px solid #ccc;
  border-radius: 10px;
  outline: none;
  transition: border-color .15s, box-shadow .15s;
  -webkit-appearance: none;        /* 플랫폼 기본 화살표 최소화(브라우저별) */
  appearance: none;
}
.select-group select:focus-visible {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59,130,246,.25);
  border-radius: 10px;
}

/* 버튼 그룹: 가로 나란히(좁을 땐 자동 랩) */
.button-group {
  display: grid;
  grid-auto-flow: column;
  gap: 8px;
  margin-top: 12px;
}
.button-group ion-button {
  --border-radius: 12px;
  --padding-start: 12px; --padding-end: 12px;
  --padding-top: 8px; --padding-bottom: 8px;
  min-height: 44px;                /* 터치 타깃 강화 */
  font-weight: 700;
}

/* 메시지(오류/성공) */
.error-msg,
.success-msg {
  margin: 6px 0 0;
  font-size: clamp(14px, 2.8vw, 15px);
  line-height: 1.3;
  word-break: break-word;
  text-align: left;
}
.error-msg { color: #c0392b; }
.success-msg { color: #2d7a33; }

/* 키보드 포커스 접근성(공통) */
:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(59,130,246,.35);
  border-radius: 10px;
}

/* 초소형 화면(≤360px) 보정 */
@media (max-width: 360px) {
  .popup-content { padding: 14px; width: 94vw; }
  .button-group { gap: 6px; }
}

/* 사용자 모션 최소화 설정 존중 */
@media (prefers-reduced-motion: reduce) {
  .popup-content { animation: none !important; }
}

/* 가벼운 등장 애니메이션 */
@keyframes modal-in {
  from { opacity: 0; transform: translateY(6px) scale(.98); }
  to   { opacity: 1; transform: translateY(0)   scale(1); }
}
</style>
