<template>
  <div>
    <!-- 카드 클릭 시 모달 오픈 -->
    <div class="card editable-card" @click="modalOpen = true">
      <div class="card-title">검색지역</div>
      <div class="card-value">
        {{ displayRegion }}
      </div>
    </div>

    <!-- ✅ 팝업 모달 -->
    <div v-if="modalOpen" class="popup-overlay">
      <div class="popup-modal">
        <div class="modal-header">
          <h4 class="modal-title">검색 지역 선택</h4>

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

          <div class="button-group">
            <ion-button class="small-btn" @click="resetSelection" color="medium">초기화</ion-button>
            <ion-button class="small-btn" @click="applySelection" color="primary">적용하기</ion-button>
          </div>
        </div>

        <div class="modal-scroll-area">
          <div class="region-container">
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
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { regions as regionTree } from '@/data/regions'

// ✅ 부모에서 전달된 검색 지역 초기값
const props = defineProps({
  regions: {
    type: Array,
    default: () => []
  }
})

// ✅ 부모에게 emit
const emit = defineEmits(['updated'])

const modalOpen = ref(false)
const selectedRegion1 = ref('')
const checked = reactive({})
const selectedList = ref([])

// ✅ 사용자에게 보여주는 텍스트
const displayRegion = computed(() => {
  if (selectedList.value.length === 0) return '전체'
  return selectedList.value.join(', ')
})

// ✅ 지역1 클릭
function selectRegion1(region) {
  selectedRegion1.value = region
  if (region !== '전체' && !checked[region]) {
    checked[region] = {}
  }
}

// ✅ 전체 전체 체크 여부
const isGlobalAllChecked = computed(() => {
  for (const region1 of Object.keys(regionTree)) {
    for (const region2 of regionTree[region1]) {
      if (!checked[region1]?.[region2]) return false
    }
  }
  return true
})

// ✅ 전체 전체 토글
function toggleGlobalAll(event) {
  const value = event.target.checked
  for (const region1 of Object.keys(regionTree)) {
    if (!checked[region1]) checked[region1] = {}
    for (const region2 of regionTree[region1]) {
      checked[region1][region2] = value
    }
  }
  updateSelectedList()
}

// ✅ 지역2 전체 체크 여부
function isAllChecked(region1) {
  return regionTree[region1].every(r => checked[region1]?.[r])
}

// ✅ 지역2 전체 토글
function toggleAll(region1, event) {
  const value = event.target.checked
  for (const r2 of regionTree[region1]) {
    checked[region1][r2] = value
  }
  updateSelectedList()
}

// ✅ 지역2 개별 선택
function toggleSingle(region1, region2, event) {
  checked[region1][region2] = event.target.checked
  updateSelectedList()
}

// ✅ 선택된 지역 표시 리스트 업데이트
function updateSelectedList() {
  const list = []
  if (isGlobalAllChecked.value) {
    list.push('전체')
  } else {
    for (const region1 in checked) {
      const region2List = checked[region1]
      const allChecked = isAllChecked(region1)
      if (allChecked) {
        list.push(`${region1} 전체`)
      } else {
        for (const region2 in region2List) {
          if (region2List[region2]) {
            list.push(`${region1} - ${region2}`)
          }
        }
      }
    }
  }
  selectedList.value = list
}

// ✅ 항목 제거
function removeItem(item) {
  if (item === '전체') {
    for (const r1 in checked) {
      for (const r2 in checked[r1]) {
        checked[r1][r2] = false
      }
    }
  } else if (item.endsWith('전체')) {
    const r1 = item.replace(' 전체', '')
    for (const r2 of regionTree[r1] || []) {
      checked[r1][r2] = false
    }
  } else if (item.includes(' - ')) {
    const [r1, r2] = item.split(' - ')
    if (checked[r1]?.[r2]) {
      checked[r1][r2] = false
    }
  }
  updateSelectedList()
}

// ✅ 초기화
function resetSelection() {
  for (const r1 in checked) {
    for (const r2 in checked[r1]) {
      checked[r1][r2] = false
    }
  }
  selectedList.value = []
}

// ✅ 적용 시 emit
function applySelection() {
  modalOpen.value = false

  const result = []

  if (isGlobalAllChecked.value) {
    result.push({ region1: '전체', region2: '전체' })
  } else {
    for (const region1 in checked) {
      const region2List = checked[region1]
      const allChecked = isAllChecked(region1)
      if (allChecked) {
        result.push({ region1, region2: '전체' })
      } else {
        for (const region2 in region2List) {
          if (region2List[region2]) {
            result.push({ region1, region2 })
          }
        }
      }
    }
  }

  emit('updated', result)
}

// ✅ 초기값으로 체크 상태 복원
onMounted(() => {
  if (!Array.isArray(props.regions)) return

  for (const { region1, region2 } of props.regions) {
    if (!region1 || !region2 || region1 === '전체') {
      // 전체 선택
      for (const r1 of Object.keys(regionTree)) {
        if (!checked[r1]) checked[r1] = {}
        for (const r2 of regionTree[r1]) {
          checked[r1][r2] = true
        }
      }
      break
    } else if (region2 === '전체') {
      if (!checked[region1]) checked[region1] = {}
      for (const r2 of regionTree[region1]) {
        checked[region1][r2] = true
      }
    } else {
      if (!checked[region1]) checked[region1] = {}
      checked[region1][region2] = true
    }
  }

  updateSelectedList()
})
</script>

<style scoped>
.card {
  border: 1px solid #ccc;
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 1rem;
  background-color: #fff;
  color: #222;
}
.editable-card {
  cursor: pointer;
}
.card-title {
  font-weight: bold;
  font-size: 0.95rem;
  margin-bottom: 0.4rem;
  color: #333;
}
.card-value {
  font-size: 0.95rem;
  color: #000;
}

/* ✅ 팝업 레이아웃 */
.popup-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.4);
  z-index: 9999;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding-top: 150px;
}

.popup-modal {
  background: white;
  color: black;
  border-radius: 8px;
  max-width: 400px;
  width: 90%;
  max-height: 80%;
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

/* ✅ 스크롤 영역 */
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
.selected-tags {
  margin-top: 6px;
}
.tags-wrapper {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.tag {
  background: #f0f0f0;
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 13px;
  color: black;
}
.remove-btn {
  margin-left: 4px;
  background: none;
  border: none;
  color: red;
  cursor: pointer;
}

/* 버튼 크기 줄이기 */
.button-group {
  display: flex;
  justify-content: space-between;
  margin: 4px 0;
}
.small-btn {
  --padding-start: 10px;
  --padding-end: 10px;
  --padding-top: 4px;
  --padding-bottom: 4px;
  font-size: 14px;
}

/* 지역 선택 */
.region-container {
  display: flex;
  border-top: 1px solid #eee;
}
.region1-panel {
  width: 100px;
  border-right: 1px solid #ccc;
}
.region1-panel ul {
  list-style: none;
  padding: 0;
  margin: 0;
}
.region1-panel li {
  padding: 6px;
  cursor: pointer;
}
.region1-panel li.selected {
  background-color: #007bff;
  color: white;
}
.region2-panel {
  flex-grow: 1;
  padding: 10px;
}
.region2-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
</style>
