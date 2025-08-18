<template>
  <!-- ✅ 배경 클릭 시 닫힘 -->
  <div class="popup-overlay" @click.self="onClose">
    <div class="popup-modal">
      <div class="modal-header">
        <h4 class="modal-title">검색 지역 선택</h4>

        <!-- 선택 미리보기 -->
        <div class="selected-box">
          <strong>선택된 지역:</strong>
          <div class="selected-tags">
            <div v-if="selectedList.length === 0" class="no-selection">없음</div>
            <div v-else class="tags-wrapper">
              <span v-for="(item, index) in selectedList" :key="index" class="tag">
                {{ item }}
                <button class="remove-btn" @click="removeItem(item)">x</button>
              </span>
            </div>
          </div>
        </div>

        <!-- ✅ 버튼 그룹: 초기화 적용하기 닫기 -->
        <div class="button-group">
          <ion-button class="small-btn" @click="resetSelection" color="medium">초기화</ion-button>
          <ion-button class="small-btn" @click="applySelection" color="primary">적용하기</ion-button>
          <ion-button class="small-btn" @click="onClose" color="danger">닫기</ion-button>
        </div>

        <!-- ✅ 인라인 상태 메시지 (선택사항) -->
        <p v-if="errorMsg" class="error-msg">{{ errorMsg }}</p>
        <p v-if="successMsg" class="success-msg">{{ successMsg }}</p>
      </div>

      <!-- 스크롤 영역 -->
      <div class="modal-scroll-area">
        <div class="region-container">
          <!-- 좌: 지역1 -->
          <div class="region1-panel">
            <ul>
              <li :class="{ selected: selectedRegion1 === '전체' }" @click="selectRegion1('전체')">전체</li>
              <li
                v-for="region1 in region1Keys"
                :key="region1"
                :class="{ selected: selectedRegion1 === region1 }"
                @click="selectRegion1(region1)"
              >
                {{ region1 }}
              </li>
            </ul>
          </div>

          <!-- 우: 지역2 -->
          <div class="region2-panel" v-if="selectedRegion1">
            <template v-if="selectedRegion1 === '전체'">
              <label>
                <input type="checkbox" :checked="isGlobalAllChecked" @change="toggleGlobalAll($event)" />
                전체
              </label>
            </template>

            <template v-else>
              <label>
                <input
                  type="checkbox"
                  :checked="isAllChecked(selectedRegion1)"
                  @change="toggleAll(selectedRegion1, $event)"
                />
                {{ selectedRegion1 }} 전체
              </label>

              <div class="region2-list">
                <label v-for="region2 in region2Options" :key="region2">
                  <input
                    type="checkbox"
                    :checked="checked[selectedRegion1]?.[region2] || false"
                    @change="toggleSingle(selectedRegion1, region2, $event)"
                  />
                  {{ region2 }}
                </label>
              </div>
            </template>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
// ✅ 상세 주석/로그 포함
import { ref, reactive, computed, onMounted } from 'vue'
import { IonButton, toastController } from '@ionic/vue'
import { regions as regionTree } from '@/data/regions' // 기존 사용 경로와 동일 유지

const props = defineProps({
  // 예: [{ region1:'전체', region2:'전체' }] ...
  regions: {
    type: Array,
    default: () => []
  }
})
const emit = defineEmits(['close', 'updated'])

const selectedRegion1 = ref('')
const checked = reactive({})    // 구조: { [region1]: { [region2]: boolean } }
const selectedList = ref([])    // 사용자 표시용 문자열 리스트
const errorMsg = ref('')        // 인라인 에러 메시지(선택)
const successMsg = ref('')      // 인라인 성공 메시지(선택)

console.log('▶ [SearchRegionModal] mounted props.regions:', props.regions)

// 안전한 키/옵션 컴퓨티드
const region1Keys = computed(() => Object.keys(regionTree || {}))
const region2Options = computed(() => {
  if (!selectedRegion1.value || selectedRegion1.value === '전체') return []
  return Array.isArray(regionTree[selectedRegion1.value]) ? regionTree[selectedRegion1.value] : []
})

// ✅ 좌측 지역1 클릭
function selectRegion1(region) {
  selectedRegion1.value = region
  if (region !== '전체' && !checked[region]) {
    checked[region] = {}
  }
  console.log('▶ [SearchRegionModal] selectRegion1:', region)
}

// ✅ 전체 전체 체크 여부
const isGlobalAllChecked = computed(() => {
  for (const r1 of Object.keys(regionTree)) {
    for (const r2 of regionTree[r1]) {
      if (!checked[r1]?.[r2]) return false
    }
  }
  return true
})

// ✅ 전체 전체 토글
function toggleGlobalAll(event) {
  const value = !!event?.target?.checked
  for (const r1 of Object.keys(regionTree)) {
    if (!checked[r1]) checked[r1] = {}
    for (const r2 of regionTree[r1]) {
      checked[r1][r2] = value
    }
  }
  updateSelectedList()
  console.log('▶ [SearchRegionModal] toggleGlobalAll:', value)
}

// ✅ 특정 지역1의 전체 체크 여부
function isAllChecked(region1) {
  const list = regionTree[region1] || []
  if (!list.length) return false
  return list.every(r2 => !!checked[region1]?.[r2])
}

// ✅ 특정 지역1 전체 토글
function toggleAll(region1, event) {
  const value = !!event?.target?.checked
  const list = regionTree[region1] || []
  if (!checked[region1]) checked[region1] = {}
  for (const r2 of list) {
    checked[region1][r2] = value
  }
  updateSelectedList()
  console.log('▶ [SearchRegionModal] toggleAll:', region1, value)
}

// ✅ 개별 지역2 토글
function toggleSingle(region1, region2, event) {
  if (!checked[region1]) checked[region1] = {}
  checked[region1][region2] = !!event?.target?.checked
  updateSelectedList()
  console.log('▶ [SearchRegionModal] toggleSingle:', region1, region2, checked[region1][region2])
}

// ✅ 표시 리스트 재계산
function updateSelectedList() {
  const list = []
  if (isGlobalAllChecked.value) {
    list.push('전체')
  } else {
    for (const r1 in checked) {
      const r2Map = checked[r1] || {}
      const all = isAllChecked(r1)
      if (all) {
        list.push(`${r1} 전체`)
      } else {
        for (const r2 in r2Map) {
          if (r2Map[r2]) list.push(`${r1} - ${r2}`)
        }
      }
    }
  }
  selectedList.value = list
}

// ✅ 선택 태그 삭제
function removeItem(item) {
  if (item === '전체') {
    for (const r1 in checked) {
      for (const r2 in checked[r1]) checked[r1][r2] = false
    }
  } else if (item.endsWith('전체')) {
    const r1 = item.replace(' 전체', '')
    for (const r2 of regionTree[r1] || []) {
      if (!checked[r1]) checked[r1] = {}
      checked[r1][r2] = false
    }
  } else if (item.includes(' - ')) {
    const [r1, r2] = item.split(' - ')
    if (!checked[r1]) checked[r1] = {}
    checked[r1][r2] = false
  }
  updateSelectedList()
  console.log('▶ [SearchRegionModal] removeItem:', item)
}

// ✅ 초기화
function resetSelection() {
  for (const r1 in checked) {
    for (const r2 in checked[r1]) checked[r1][r2] = false
  }
  updateSelectedList()
  errorMsg.value = ''
  successMsg.value = ''
  console.log('▶ [SearchRegionModal] resetSelection')
}

// ✅ 적용 → 부모에 결과 전달 + 성공 토스트
async function applySelection() {
  errorMsg.value = ''
  successMsg.value = ''

  const result = []

  if (isGlobalAllChecked.value) {
    result.push({ region1: '전체', region2: '전체' })
  } else {
    for (const r1 in checked) {
      const r2Map = checked[r1] || {}
      const all = isAllChecked(r1)
      if (all) {
        result.push({ region1: r1, region2: '전체' })
      } else {
        for (const r2 in r2Map) {
          if (r2Map[r2]) result.push({ region1: r1, region2: r2 })
        }
      }
    }
  }

  // 선택 없음 방어
  if (result.length === 0) {
    errorMsg.value = '선택된 지역이 없습니다.'
    console.warn('❗ [SearchRegionModal] applySelection: empty selection')
    return
  }

  console.log('✅ [SearchRegionModal] applySelection -> emit updated:', result)

  // ✅ 먼저 토스트로 사용자 피드백
  try {
    const t = await toastController.create({
      message: '적용되었습니다.',
      duration: 1200,
      color: 'success'
    })
    await t.present()
    successMsg.value = '적용되었습니다.'
  } catch (e) {
    console.warn('⚠️ [SearchRegionModal] toast failed:', e)
  }

  // ✅ 부모에 전달 후 닫기
  emit('updated', result)
  emit('close')
}

// ✅ 닫기
function onClose() {
  console.log('▶ [SearchRegionModal] close (button or backdrop)')
  emit('close')
}

// ✅ 초기값 복원
onMounted(() => {
  try {
    console.log('▶ [SearchRegionModal] onMounted, restore from props.regions')
    if (!Array.isArray(props.regions)) return

    // 전달된 값이 없으면 미선택 상태 유지
    if (props.regions.length === 0) {
      updateSelectedList()
      return
    }

    for (const item of props.regions) {
      const region1 = item?.region1
      const region2 = item?.region2
      if (!region1 || !region2 || region1 === '전체') {
        // 전체
        for (const r1 of Object.keys(regionTree)) {
          if (!checked[r1]) checked[r1] = {}
          for (const r2 of regionTree[r1]) checked[r1][r2] = true
        }
        break
      } else if (region2 === '전체') {
        if (!checked[region1]) checked[region1] = {}
        for (const r2 of (regionTree[region1] || [])) checked[region1][r2] = true
      } else {
        if (!checked[region1]) checked[region1] = {}
        // region2가 실제 목록에 없는 경우도 방어적으로 true 처리(데이터 이행 중 호환)
        checked[region1][region2] = true
      }
    }
    updateSelectedList()
  } catch (e) {
    console.error('❌ [SearchRegionModal] restore failed:', e)
    errorMsg.value = '초기값 복원 중 오류가 발생했습니다.'
  }
})
</script>

<style scoped>
/* ✅ 가독성: 기본 검정 글씨 */
* { color: #000; }

/* =========================================
   모달 레이아웃 (기존 유지, 약간만 컴팩트화)
========================================= */
.popup-overlay {
  position: fixed;
  top: 0; left: 0;
  width: 100%; height: 92%;
  background-color: rgba(0, 0, 0, 0.4);
  z-index: 9999;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding-top: 100px;
}
.popup-modal {
  background: #fff;
  color: #000;
  border-radius: 8px;
  max-width: 400px;
  width: 90%;
  max-height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.modal-header {
  padding: 8px 10px;               /* 살짝 컴팩트 */
  border-bottom: 1px solid #ccc;
  background-color: #fafafa;
}
.modal-title {
  font-size: 15px;                  /* 16 -> 15 */
  margin: 0 0 6px 0;
}

/* 스크롤 영역 */
.modal-scroll-area {
  overflow-y: auto;
  flex-grow: 1;
  padding: 8px 10px;                /* 10 -> 8 */
}

/* 선택된 박스 */
.selected-box {
  border: 1px solid #ccc;
  padding: 6px;
  min-height: 72px;                 /* 80 -> 72 */
  max-height: 110px;                /* 120 -> 110 */
  overflow-y: auto;
  margin-bottom: 6px;
}
.selected-tags { margin-top: 6px; }
.tags-wrapper { display: flex; flex-wrap: wrap; gap: 6px; }
.tag {
  background: #f0f0f0; border-radius: 4px; padding: 3px 7px; font-size: 12px; /* 더 컴팩트 */
  color: #000;
}
.remove-btn {
  margin-left: 4px; background: none; border: none; color: #d11; cursor: pointer;
}

/* 버튼 */
.button-group {
  display: flex; justify-content: space-between; gap: 6px; margin: 4px 0;
}
.small-btn {
  --padding-start: 8px; --padding-end: 8px;   /* 더 컴팩트 */
  --padding-top: 3px; --padding-bottom: 3px;
  font-size: 13px;
}

/* =========================================
   좌/우 패널 레이아웃 (기존 유지)
========================================= */
.region-container { display: flex; border-top: 1px solid #eee; }
.region1-panel { width: 100px; border-right: 1px solid #ccc; }
.region1-panel ul { list-style: none; padding: 0; margin: 0; }
.region1-panel li {
  padding: 5px 8px;                 /* 6 -> 5 */
  cursor: pointer;
  font-size: 13px;
  line-height: 1.25;
}
.region1-panel li.selected { background-color: #2f6df6; color: #fff; }
.region2-panel { flex-grow: 1; padding: 8px 10px; }
.region2-list { display: flex; flex-direction: column; gap: 4px; }

/* =========================================
   🔽 체크박스 컴팩트 스타일 (핵심 변경)
   - 모달 내부의 모든 체크박스에 동일 적용
   - 기본 네이티브 체크박스를 축소(scale) + 색상 통일
   - 라벨 행 높이/간격 정리
========================================= */

/* 라벨을 체크박스와 정렬 */
.region2-panel label,
.region2-panel .region2-list label,
.region2-panel > label,  /* '전체', '서울 전체' 라벨 */
.popup-modal .region2-list label {
  display: flex;
  align-items: center;
  gap: 8px;              /* 체크와 텍스트 간격 */
  font-size: 13px;
  line-height: 0.5;
  padding: 0px 0;        /* 행 간격 축소 */
}

/* ✅ 공통 체크박스 사이즈 축소 */
.popup-modal input[type="checkbox"] {
  /* iOS/Android 모두 잘 보이는 안전한 축소 방식 */
  transform: scale(0.85);      /* 크기 85% */
  transform-origin: left center;
  /* 기본 박스 크기 힌트를 줘서 줄튀는 것 방지 */
  width: 16px;
  height: 8px;
  margin: 0;                   /* 여백 초기화 */
  /* 시스템 체크박스 색상 */
  accent-color: #2f6df6;       /* 체크/포커스 색상 통일 */
}

/* 체크박스 오른쪽 텍스트가 너무 붙지 않도록 보조 마진 */
.popup-modal input[type="checkbox"] + span,
.popup-modal input[type="checkbox"] + label {
  margin-left: 2px;
}

/* 접근성: 탭 포커스 시 윤곽선 */
.popup-modal input[type="checkbox"]:focus-visible {
  outline: 2px solid rgba(47,109,246,.35);
  outline-offset: 2px;
  border-radius: 3px;
}

/* 메시지 */
.error-msg { color: #c0392b; font-size: 12.5px; margin-top: 6px; }
.success-msg { color: #2d7a33; font-size: 12.5px; margin-top: 6px; }

/* =========================================
   디버그/점검용 클래스 (필요 시 토글)
========================================= */
/* .debug-outline * { outline:1px dashed rgba(255,0,0,.25); } */
</style>
