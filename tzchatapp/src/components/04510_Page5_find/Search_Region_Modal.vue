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
      </div>

      <!-- 스크롤 영역 -->
      <div class="modal-scroll-area">
        <div class="region-container">
          <!-- 좌: 지역1 -->
          <div class="region1-panel">
            <ul>
              <li :class="{ selected: selectedRegion1 === '전체' }" @click="selectRegion1('전체')">전체</li>
              <li
                v-for="region1 in Object.keys(regionTree)"
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
                <input type="checkbox" :checked="isAllChecked(selectedRegion1)" @change="toggleAll(selectedRegion1, $event)" />
                {{ selectedRegion1 }} 전체
              </label>
              <div class="region2-list">
                <label v-for="region2 in regionTree[selectedRegion1]" :key="region2">
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
import { IonButton } from '@ionic/vue'
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

console.log('▶ [SearchRegionModal] mounted props.regions:', props.regions)

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
  const value = event.target.checked
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
  return (regionTree[region1] || []).every(r2 => checked[region1]?.[r2])
}

// ✅ 특정 지역1 전체 토글
function toggleAll(region1, event) {
  const value = event.target.checked
  for (const r2 of regionTree[region1]) {
    if (!checked[region1]) checked[region1] = {}
    checked[region1][r2] = value
  }
  updateSelectedList()
  console.log('▶ [SearchRegionModal] toggleAll:', region1, value)
}

// ✅ 개별 지역2 토글
function toggleSingle(region1, region2, event) {
  if (!checked[region1]) checked[region1] = {}
  checked[region1][region2] = event.target.checked
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
  console.log('▶ [SearchRegionModal] resetSelection')
}

// ✅ 적용 → 부모에 결과 전달
function applySelection() {
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

  console.log('✅ [SearchRegionModal] applySelection -> emit updated:', result)
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
    for (const { region1, region2 } of props.regions) {
      if (!region1 || !region2 || region1 === '전체') {
        // 전체
        for (const r1 of Object.keys(regionTree)) {
          if (!checked[r1]) checked[r1] = {}
          for (const r2 of regionTree[r1]) checked[r1][r2] = true
        }
        break
      } else if (region2 === '전체') {
        if (!checked[region1]) checked[region1] = {}
        for (const r2 of regionTree[region1] || []) checked[region1][r2] = true
      } else {
        if (!checked[region1]) checked[region1] = {}
        checked[region1][region2] = true
      }
    }
    updateSelectedList()
  } catch (e) {
    console.error('❌ [SearchRegionModal] restore failed:', e)
  }
})
</script>

<style scoped>
/* ✅ 가독성: 기본 검정 글씨 */
* { color: #000; }

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
  background: white;
  color: black;
  border-radius: 8px;
  max-width: 400px;
  width: 90%;
  max-height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.modal-header {
  padding: 10px;
  border-bottom: 1px solid #ccc;
  background-color: #fafafa;
}
.modal-title {
  font-size: 16px;
  margin: 0 0 8px 0;
}
/* 스크롤 영역 */
.modal-scroll-area {
  overflow-y: auto;
  flex-grow: 1;
  padding: 10px;
}
/* 선택된 박스 */
.selected-box {
  border: 1px solid #ccc;
  padding: 6px;
  height: 80px;
  overflow-y: auto;
  margin-bottom: 6px;
}
.selected-tags { margin-top: 6px; }
.tags-wrapper {
  display: flex; flex-wrap: wrap; gap: 6px;
}
.tag {
  background: #f0f0f0; border-radius: 4px; padding: 4px 8px; font-size: 13px;
  color: black;
}
.remove-btn {
  margin-left: 4px; background: none; border: none; color: red; cursor: pointer;
}
/* 버튼 */
.button-group {
  display: flex; justify-content: space-between; margin: 4px 0;
}
.small-btn {
  --padding-start: 10px; --padding-end: 10px;
  --padding-top: 4px; --padding-bottom: 4px;
  font-size: 14px;
}
/* 레이아웃 */
.region-container { display: flex; border-top: 1px solid #eee; }
.region1-panel { width: 100px; border-right: 1px solid #ccc; }
.region1-panel ul { list-style: none; padding: 0; margin: 0; }
.region1-panel li { padding: 6px; cursor: pointer; }
.region1-panel li.selected { background-color: #007bff; color: white; }
.region2-panel { flex-grow: 1; padding: 10px; }
.region2-list { display: flex; flex-direction: column; gap: 4px; }
</style>
