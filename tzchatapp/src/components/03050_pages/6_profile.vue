<template>
  <div class="page-wrapper">
    <div class="container">
      <!-- ✅ 내 프로필 카드 -->
      <!-- ★ 변경지점: 공통코드 충돌을 막기 위한 스코프 클래스 pf-scope 추가 -->
      <div v-if="user" class="card pf-scope">
        <h3 class="card-title">
          <IonIcon :icon="icons.personCircleOutline" class="title-icon" />
          {{ user.nickname }}
        </h3>

        <!-- ✅ 프로필 사진 컴포넌트 (제목 아래, 중앙) -->
        <div class="pf-photo">
          <ProfilePhotoManager
            :gender="user?.gender || ''"
            :readonly="false"
            @updated="onProfilePhotoUpdated"
            @main-changed="onProfileMainChanged"
          />
        </div>

        <!-- ✅ 우측 상단 '설정' 버튼 (절대배치) -->
        <button
          class="title-action-btn"
          type="button"
          @click="goSetting"
          aria-label="설정으로 이동"
        >
          <IonIcon :icon="icons.settingsOutline" class="action-icon" />
          <span class="action-text">설정</span>
        </button>

        <table class="info-table">
          <!-- ★ 변경지점: 열 너비 클래스도 네임스페이스로 교체 -->
          <colgroup>
            <col class="pf-col-th" />
            <col class="pf-col-td" />
          </colgroup>
          <tbody>
            <tr
              class="editable-row"
              @click="goMembership"
              tabindex="0"
              @keydown.enter="goMembership"
            >
              <td class="pf-th">
                <IonIcon :icon="icons.ribbonOutline" class="row-icon" />
                <strong class="label">일반회원</strong>
              </td>
              <td class="pf-td editable-text">
                <span class="inline-cta">구독하기</span>
              </td>
            </tr>

            <!-- 출생년도 -->
            <tr>
              <td class="pf-th">
                <IonIcon :icon="icons.calendarOutline" class="row-icon" />
                <strong class="label">출생년도</strong>
              </td>
              <td class="pf-td readonly">{{ user.birthyear || '미입력' }}</td>
            </tr>

            <!-- 성별 -->
            <tr>
              <td class="pf-th">
                <IonIcon :icon="icons.maleFemaleOutline" class="row-icon" />
                <strong class="label">성별</strong>
              </td>
              <td class="pf-td readonly">
                {{ user.gender === 'man' ? '남자' : user.gender === 'woman' ? '여자' : '미입력' }}
              </td>
            </tr>

            <!-- 비밀번호 변경 -->
            <tr
              class="editable-row"
              @click="openPasswordModal"
              tabindex="0"
              @keydown.enter="openPasswordModal"
            >
              <td class="pf-th">
                <IonIcon :icon="icons.lockClosedOutline" class="row-icon" />
                <strong class="label">비밀번호</strong>
              </td>
              <td class="pf-td editable-text">변경하기</td>
            </tr>

            <!-- 닉네임 -->
            <tr
              @click="openPopup(4, user.nickname)"
              class="editable-row"
              tabindex="0"
              @keydown.enter="openPopup(4, user.nickname)"
            >
              <td class="pf-th">
                <IonIcon :icon="icons.personCircleOutline" class="row-icon" />
                <strong class="label">닉네임</strong>
              </td>
              <td class="pf-td editable-text">{{ user.nickname }}</td>
            </tr>

            <!-- 지역 -->
            <tr
              @click="openPopup(1, user.region1 + ' ' + user.region2)"
              class="editable-row"
              tabindex="0"
              @keydown.enter="openPopup(1, user.region1 + ' ' + user.region2)"
            >
              <td class="pf-th">
                <IonIcon :icon="icons.locationOutline" class="row-icon" />
                <strong class="label">지역</strong>
              </td>
              <td class="pf-td editable-text">{{ user.region1 }} {{ user.region2 }}</td>
            </tr>

            <!-- 성향 -->
            <tr
              @click="openPopup(2, user.preference)"
              class="editable-row"
              tabindex="0"
              @keydown.enter="openPopup(2, user.preference)"
            >
              <td class="pf-th">
                <IonIcon :icon="icons.sparklesOutline" class="row-icon" />
                <strong class="label">특징</strong>
              </td>
              <td class="pf-td editable-text">{{ user.preference }}</td>
            </tr>

            <!-- 소개 -->
            <tr
              @click="openPopup(3, user.selfintro || '소개 없음')"
              class="editable-row"
              tabindex="0"
              @keydown.enter="openPopup(3, user.selfintro || '소개 없음')"
            >
              <td class="pf-th">
                <IonIcon :icon="icons.chatbubbleEllipsesOutline" class="row-icon" />
                <strong class="label">소개</strong>
              </td>
              <td class="pf-td editable-text">{{ user.selfintro || '소개 없음' }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <br />

      <!-- ✅ 친구 찾기 설정 카드 -->
      <div v-if="user" class="card pf-scope">
        <h3 class="card-title">
          <IonIcon :icon="icons.optionsOutline" class="title-icon" />
          친구 찾기 설정
        </h3>

        <table class="info-table">
          <colgroup>
            <col class="pf-col-th" />
            <col class="pf-col-td" />
          </colgroup>
          <tbody>
            <!-- 검색나이 -->
            <tr
              class="editable-row"
              @click="openSearchYearModal"
              tabindex="0"
              @keydown.enter="openSearchYearModal"
            >
              <td class="pf-th">
                <IonIcon :icon="icons.calendarNumberOutline" class="row-icon" />
                <strong class="label">검색나이</strong>
              </td>
              <td class="pf-td editable-text">
                {{ toAll(user.search_birthyear1) }} ~ {{ toAll(user.search_birthyear2) }}
              </td>
            </tr>

            <!-- 검색지역 -->
            <tr
              class="editable-row"
              @click="openSearchRegionModal"
              tabindex="0"
              @keydown.enter="openSearchRegionModal"
            >
              <td class="pf-th">
                <IonIcon :icon="icons.locationOutline" class="row-icon" />
                <strong class="label">검색지역</strong>
              </td>
              <td class="pf-td editable-text">
                {{ searchRegionDisplay }}
              </td>
            </tr>

            <!-- 검색특징 -->
            <tr
              class="editable-row"
              @click="openSearchPreferenceModal"
              tabindex="0"
              @keydown.enter="openSearchPreferenceModal"
            >
              <td class="pf-th">
                <IonIcon :icon="icons.sparklesOutline" class="row-icon" />
                <strong class="label">검색특징</strong>
              </td>
              <td class="pf-td editable-text">{{ user.search_preference }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <br />

      <!-- ✅ 노출제한 설정 카드 -->
      <div v-if="user" class="card pf-scope">
        <h3 class="card-title">
          <IonIcon :icon="icons.optionsOutline" class="title-icon" />
          설정 제한
        </h3>

        <table class="info-table">
          <colgroup>
            <col class="pf-col-th" />
            <col class="pf-col-td" />
          </colgroup>
          <tbody>
            <tr
              class="editable-row"
              @click="openSearchPreferenceModal"
              tabindex="0"
              @keydown.enter="openSearchPreferenceModal"
            >
              <td class="pf-th">
                <IonIcon :icon="icons.sparklesOutline" class="row-icon" />
                <strong class="label">휴대폰에 포함된</strong>
              </td>
              <td class="pf-td editable-text">사람 검색 제외하기</td>
            </tr>
            <tr
              class="editable-row"
              @click="openSearchPreferenceModal"
              tabindex="0"
              @keydown.enter="openSearchPreferenceModal"
            >
              <td class="pf-th">
                <IonIcon :icon="icons.sparklesOutline" class="row-icon" />
                <strong class="label">휴대폰에 포함된</strong>
              </td>
              <td class="pf-td editable-text">사람에게 노출 되지 않기</td>
            </tr>
            <tr
              class="editable-row"
              @click="openSearchPreferenceModal"
              tabindex="0"
              @keydown.enter="openSearchPreferenceModal"
            >
              <td class="pf-th">
                <IonIcon :icon="icons.sparklesOutline" class="row-icon" />
                <strong class="label">사진이 없는</strong>
              </td>
              <td class="pf-td editable-text">사람 검색 제외하기</td>
            </tr>
            <tr
              class="editable-row"
              @click="openSearchPreferenceModal"
              tabindex="0"
              @keydown.enter="openSearchPreferenceModal"
            >
              <td class="pf-th">
                <IonIcon :icon="icons.sparklesOutline" class="row-icon" />
                <strong class="label">사진이 없는</strong>
              </td>
              <td class="pf-td editable-text">사람에게 노출 되지 않기</td>
            </tr>
            <tr
              class="editable-row"
              @click="openSearchPreferenceModal"
              tabindex="0"
              @keydown.enter="openSearchPreferenceModal"
            >
              <td class="pf-th">
                <IonIcon :icon="icons.sparklesOutline" class="row-icon" />
                <strong class="label">알림설정</strong>
              </td>
              <td class="pf-td editable-text">온 / off</td>
            </tr>
          </tbody>
        </table>
      </div>

      <p v-else class="loading-text">유저 정보를 불러오는 중입니다...</p>
    </div>

    <!-- ✅ 모달들 -->
    <PopupModal_1
      v-if="showModal1"
      :message="popupMessage"
      @close="showModal1 = false"
      @updated="handleRegionUpdate"
    />
    <PopupModal_2
      v-if="showModal2"
      :message="popupMessage"
      @close="showModal2 = false"
      @updated="handlePreferenceUpdate"
    />
    <PopupModal_3
      v-if="showModal3"
      :message="popupMessage"
      @close="showModal3 = false"
      @updated="handleIntroUpdate"
    />
    <PopupModal_4
      v-if="showModal4"
      :message="popupMessage"
      @close="showModal4 = false"
      @updated="handleNicknameUpdate"
    />

    <Search_Year_Modal
      v-if="showSearchYear"
      :initial-from="user?.search_birthyear1 ?? ''"
      :initial-to="user?.search_birthyear2 ?? ''"
      :from="user?.search_birthyear1 ?? ''"
      :to="user?.search_birthyear2 ?? ''"
      @close="showSearchYear = false"
      @updated="onSearchYearUpdated"
    />
    <Search_Region_Modal
      v-if="showSearchRegion"
      :regions="regionsForModal"
      @close="showSearchRegion = false"
      @updated="onSearchRegionUpdated"
    />
    <Search_Preference_Modal
      v-if="showSearchPreference"
      :message="user?.search_preference ?? ''"
      @close="showSearchPreference = false"
      @updated="onSearchPreferenceUpdated"
    />

    <PasswordChangeModal
      :is-open="showPasswordModal"
      @close="showPasswordModal = false"
      @updated="onPasswordUpdated"
    />
  </div>
</template>

<script setup>
/* ===========================================================
   6_profile.vue
   - 우측 상단 '설정' 버튼 추가 (절대배치)
   - 프로필 사진 컴포넌트 삽입
   =========================================================== */
import { ref, computed, onMounted } from 'vue'
import { toastController, IonIcon } from '@ionic/vue'
import axios from '@/lib/api'
import { useRouter } from 'vue-router'

/* (유지) 프로필 편집 모달 4종 */
import PopupModal_1 from '@/components/04610_Page6_profile/Modal_region.vue'
import PopupModal_2 from '@/components/04610_Page6_profile/Modal_preference.vue'
import PopupModal_3 from '@/components/04610_Page6_profile/Modal_mention.vue'
import PopupModal_4 from '@/components/04610_Page6_profile/Modal_nickname.vue'

/* (유지) 검색 설정 모달 3종 */
import Search_Year_Modal from '@/components/04610_Page6_profile/Search_Year_Modal.vue'
import Search_Region_Modal from '@/components/04610_Page6_profile/Search_Region_Modal.vue'
import Search_Preference_Modal from '@/components/04610_Page6_profile/Search_Preference_Modal.vue'

/* 비밀번호 변경 모달 */
import PasswordChangeModal from '@/components/04610_Page6_profile/Modal_password_chagne.vue'

/* ✅ 프로필 사진 컴포넌트 */
import ProfilePhotoManager from '@/components/04610_Page6_profile/ProfilePhotoManager.vue'

/* Ionicons 아이콘들 */
import {
  personCircleOutline,
  lockClosedOutline,
  calendarOutline,
  calendarNumberOutline,
  maleFemaleOutline,
  locationOutline,
  sparklesOutline,
  chatbubbleEllipsesOutline,
  logInOutline,
  timeOutline,
  optionsOutline,
  settingsOutline,
  ribbonOutline,
} from 'ionicons/icons'

/* 템플릿에서 사용하기 쉽게 묶어서 노출 */
const icons = {
  personCircleOutline,
  lockClosedOutline,
  calendarOutline,
  calendarNumberOutline,
  maleFemaleOutline,
  locationOutline,
  sparklesOutline,
  chatbubbleEllipsesOutline,
  logInOutline,
  timeOutline,
  optionsOutline,
  settingsOutline,
  ribbonOutline,
}

const router = useRouter()
const nickname = ref('')
const user = ref(null)

/* (유지) 프로필 모달 on/off */
const showModal1 = ref(false) // 지역
const showModal2 = ref(false) // 성향
const showModal3 = ref(false) // 소개
const showModal4 = ref(false) // 닉네임
const popupMessage = ref('')

/* (유지) 검색 모달 on/off */
const showSearchYear = ref(false)
const showSearchRegion = ref(false)
const showSearchPreference = ref(false)

/* 비밀번호 변경 */
const showPasswordModal = ref(false)
function openPasswordModal() { showPasswordModal.value = true }
async function onPasswordUpdated() {
  const t = await toastController.create({
    message: '비밀번호가 변경되었습니다.',
    duration: 1400,
    color: 'success'
  })
  t.present()
}

/* ✅ 설정 버튼 핸들러 */
function goSetting() {
  router.push('/home/7page')
}

/* [추가] 사진 컴포넌트 이벤트 핸들러 */
function onProfilePhotoUpdated() {
  // 필요 시 유저 정보/목록 재조회 로직 추가
  console.log('[profile] photos updated')
}
async function onProfileMainChanged(imageId) {
  console.log('[profile] main changed:', imageId)
  const t = await toastController.create({
    message: '대표 사진이 변경되었습니다.',
    duration: 1200,
    color: 'success'
  })
  t.present()
}

// [함수 추가: 구독 페이지로 이동]
function goMembership() {
  router.push('/home/setting/0001') // 필요 시 실제 라우트로 변경
}

/* null, '', undefined → '전체' */
const toAll = (v) => (v === null || v === undefined || v === '' ? '전체' : v)

/* ----- (유지) 프로필 모달 오픈 ----- */
const openPopup = (modalNum, value) => {
  popupMessage.value = value
  showModal1.value = modalNum === 1
  showModal2.value = modalNum === 2
  showModal3.value = modalNum === 3
  showModal4.value = modalNum === 4
}

/* ----- 5_find 모달 오픈 ----- */
const openSearchYearModal = () => { showSearchYear.value = true }
const openSearchRegionModal = () => { showSearchRegion.value = true }
const openSearchPreferenceModal = () => { showSearchPreference.value = true }

/* ===========================================================
   ✅ 화면/모달 복원용 regions 계산 (검색조건)
   =========================================================== */
const regionsForModal = computed(() => {
  if (!user.value) return []
  const fromSnake = Array.isArray(user.value.search_regions) ? user.value.search_regions : []
  const fromCamel = Array.isArray(user.value.searchRegions) ? user.value.searchRegions : []
  const list = (fromSnake.length ? fromSnake : fromCamel).map((r) => ({
    region1: r?.region1 || '',
    region2: r?.region2 || ''
  }))
  if (list.length) return list
  const r1 = user.value.search_region1 || ''
  const r2 = user.value.search_region2 || ''
  if (!r1 && !r2) return []
  if (r1 === '전체' && r2 === '전체') return [{ region1: '전체', region2: '전체' }]
  return [{ region1: r1, region2: r2 }]
})

/* ===========================================================
   ✅ “표시에 사용할” 지역 배열(검색조건)
   =========================================================== */
const searchRegionsBuffer = ref([])
const effectiveRegions = computed(() => {
  if (searchRegionsBuffer.value?.length) return searchRegionsBuffer.value
  const snake = Array.isArray(user.value?.search_regions) ? user.value.search_regions : []
  const camel = Array.isArray(user.value?.searchRegions) ? user.value.searchRegions : []
  if (snake.length) return snake
  if (camel.length) return camel
  const r1 = user.value?.search_region1 || ''
  const r2 = user.value?.search_region2 || ''
  return r1 || r2 ? [{ region1: r1, region2: r2 }] : []
})

/* ===========================================================
   ✅ 카드 표시용 요약 문자열(검색조건)
   =========================================================== */
function labelOf(item) {
  const r1 = (item?.region1 || '').trim()
  const r2 = (item?.region2 || '').trim()
  if (!r1 && !r2) return '전체'
  if (r1 === '전체' && r2 === '전체') return '전체'
  if (r2 === '전체') return `${r1} 전체`
  return `${r1} ${r2}`.trim()
}
const searchRegionDisplay = computed(() => {
  const list = effectiveRegions.value
  if (!list.length) return '전체'
  if (list.length === 1 && list[0].region1 === '전체' && list[0].region2 === '전체') return '전체'
  const firstLabel = labelOf(list[0])
  return list.length === 1 ? firstLabel : `${firstLabel} 외 ${list.length - 1}`
})

/* ===========================================================
   ✅ 검색나이 저장 (기존 그대로)
   =========================================================== */
async function onSearchYearUpdated(payload) {
  let from = '', to = ''
  if (typeof payload === 'string') {
    const [f = '', t = ''] = payload.split('~').map((s) => s.trim())
    from = f; to = t
  } else if (Array.isArray(payload)) {
    from = payload[0] ?? ''; to = payload[1] ?? ''
  } else if (payload && typeof payload === 'object') {
    from = payload.from ?? payload.year1 ?? ''
    to = payload.to ?? payload.year2 ?? ''
  }

  if (user.value) {
    user.value.search_birthyear1 = from
    user.value.search_birthyear2 = to
  }

  try {
    const { data } = await axios.patch('/api/search/year', { year1: from, year2: to }, { withCredentials: true })
    console.log('saved /search/year:', data)
    const t = await toastController.create({ message: '검색 나이가 적용되었습니다.', duration: 1500, color: 'success' })
    await t.present()
  } catch (err) {
    const t = await toastController.create({ message: '저장 실패: ' + (err?.response?.data?.error || err.message), duration: 2000, color: 'danger' })
    await t.present()
  } finally {
    showSearchYear.value = false
  }
}

/* ===========================================================
   ✅ 검색지역 저장 (기존 그대로)
   =========================================================== */
function normalizeRegionsPayload(payload) {
  let arr = []
  if (Array.isArray(payload)) {
    if (payload.length && typeof payload[0] === 'object') arr = payload
    else { const [r1 = '', r2 = ''] = payload; arr = [{ region1: r1, region2: r2 }] }
  } else if (payload && typeof payload === 'object') {
    arr = [{ region1: payload.region1 ?? payload.r1 ?? '', region2: payload.region2 ?? payload.r2 ?? '' }]
  } else if (typeof payload === 'string') {
    const parts = payload.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean)
    const [r1 = '', r2 = ''] = parts
    arr = [{ region1: r1, region2: r2 }]
  }
  arr = arr.map((it) => ({ region1: (it.region1 || '').trim(), region2: (it.region2 || '').trim() }))
           .filter((it) => it.region1 && it.region2)
  if (arr.some((it) => it.region1 === '전체' && it.region2 === '전체')) return [{ region1: '전체', region2: '전체' }]
  return arr
}
async function onSearchRegionUpdated(payload) {
  const normalized = normalizeRegionsPayload(payload)
  if (user.value) {
    const first = normalized[0] || { region1: '', region2: '' }
    user.value.search_region1 = first.region1 || ''
    user.value.search_region2 = first.region2 || ''
    user.value.search_regions = normalized
    user.value.searchRegions = normalized
  }
  searchRegionsBuffer.value = normalized
  try {
    const { data } = await axios.patch('/api/search/regions', { regions: normalized }, { withCredentials: true })
    console.log('saved /search/regions:', data)
    const t = await toastController.create({ message: '검색 지역이 적용되었습니다.', duration: 1500, color: 'success' })
    await t.present()
  } catch (err) {
    const t = await toastController.create({ message: '저장 실패: ' + (err?.response?.data?.error || err.message), duration: 2000, color: 'danger' })
    await t.present()
  } finally {
    showSearchRegion.value = false
  }
}

/* ===========================================================
   ✅ 검색특징 저장 (기존 그대로)
   =========================================================== */
async function onSearchPreferenceUpdated(payload) {
  const preference = typeof payload === 'string' ? payload : payload?.preference ?? ''
  if (user.value) user.value.search_preference = preference
  try {
    const { data } = await axios.patch('/api/search/preference', { preference }, { withCredentials: true })
    console.log('saved /search/preference:', data)
    const t = await toastController.create({ message: '검색 특징이 적용되었습니다.', duration: 1500, color: 'success' })
    await t.present()
  } catch (err) {
    const t = await toastController.create({ message: '저장 실패: ' + (err?.response?.data?.error || err.message), duration: 2000, color: 'danger' })
    await t.present()
  } finally {
    showSearchPreference.value = false
  }
}

/* ===========================================================
   ⭐ 프로필 편집 반영용 핸들러 4종 (즉시 반영)
   =========================================================== */
async function handleNicknameUpdate(payload) {
  const newNickname = typeof payload === 'string' ? payload : payload?.nickname ?? ''
  if (user.value && newNickname) user.value.nickname = newNickname
  const t = await toastController.create({ message: '닉네임이 변경되었습니다.', duration: 1400, color: 'success' })
  await t.present()
  showModal4.value = false
}
async function handleRegionUpdate(payload) {
  let r1 = '', r2 = ''
  if (Array.isArray(payload)) { [r1 = '', r2 = ''] = payload }
  else if (payload && typeof payload === 'object') { r1 = payload.region1 ?? payload.r1 ?? ''; r2 = payload.region2 ?? payload.r2 ?? '' }
  else if (typeof payload === 'string') {
    const parts = payload.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean); [r1 = '', r2 = ''] = parts
  }
  if (user.value) { user.value.region1 = r1; user.value.region2 = r2 }
  const t = await toastController.create({ message: '지역이 변경되었습니다.', duration: 1400, color: 'success' })
  await t.present()
  showModal1.value = false
}
async function handlePreferenceUpdate(payload) {
  const pref = typeof payload === 'string' ? payload : payload?.preference ?? ''
  if (user.value) user.value.preference = pref
  const t = await toastController.create({ message: '성향이 변경되었습니다.', duration: 1400, color: 'success' })
  await t.present()
  showModal2.value = false
}
async function handleIntroUpdate(payload) {
  const intro = typeof payload === 'string' ? payload : payload?.selfintro ?? ''
  if (user.value) user.value.selfintro = intro
  const t = await toastController.create({ message: '소개가 변경되었습니다.', duration: 1400, color: 'success' })
  await t.present()
  showModal3.value = false
}

/* ===========================================================
   (유지) 초기 로딩
   =========================================================== */
onMounted(async () => {
  try {
    const res = await axios.get('/api/me', { withCredentials: true })
    nickname.value = res.data.user?.nickname || ''
    user.value = res.data.user

    const fromSnake = Array.isArray(user.value?.search_regions) ? user.value.search_regions : []
    const fromCamel = Array.isArray(user.value?.searchRegions) ? user.value.searchRegions : []
    const list = fromSnake.length ? fromSnake : fromCamel
    if (list.length) searchRegionsBuffer.value = list
  } catch (err) {
    console.error('유저 정보 로딩 실패:', err)
  }
})

/* (유지) 유틸 */
const formatDate = (dateStr) => (!dateStr ? '없음' : new Date(dateStr).toLocaleString())
const logout = async () => {
  try { await axios.post('/api/logout', {}, { withCredentials: true }); router.push('/login') }
  catch (err) { console.error('로그아웃 실패:', err) }
}
</script>

<style scoped>
/* ===========================================================
   블랙+골드 토큰 (변경 없음)
   =========================================================== */
:root {
  --bg: #0b0b0e;
  --panel: #111215;
  --panel-2: #15161a;
  --gold: #d4af37;
  --gold-2: #b8901e;
  --gold-3: #8c6f12;
  --text: #eaeaea;
  --text-dim: #bdbdbd;
  --text-muted: #9aa0a6;
  --divider: rgba(212, 175, 55, 0.18);
  --shadow: rgba(0, 0, 0, 0.35);
}

.page-wrapper {
  background:
    radial-gradient(1200px 800px at 20% -10%, rgba(212, 175, 55, 0.08), transparent 55%),
    radial-gradient(900px 700px at 110% -20%, rgba(184, 144, 30, 0.06), transparent 60%),
    var(--bg);
  color: var(--text);
  min-height: 100%;
}
.container { padding: 12px; }

/* 카드 */
.card {
  border: 1px solid var(--divider);
  border-radius: 12px;
  padding: 12px;
  background: linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.0)), var(--panel);
  color: var(--text);
  box-shadow: 0 8px 24px var(--shadow);
  backdrop-filter: blur(2px);
  position: relative; /* ✅ 우측 상단 버튼 절대배치용 */
}

/* 타이틀 */
.card-title {
  display: flex; align-items: center; gap: 8px;
  margin: 0 0 5px;     /* 사진 윗부분 간격 조정 */
  font-size: clamp(15px, 4.2vw, 18px);
  font-weight: 800; color: var(--text);
  position: relative;
}
.card-title::after {
  content: ""; height: 2px; width: 44px;
  background: linear-gradient(90deg, var(--gold), transparent);
  position: absolute; left: 0; bottom: -6px;
}
.title-icon { font-size: 18px; color: var(--gold); }

/* ✅ 프로필 사진 컨테이너- 사진 사이즈 */
.pf-photo {
  display: flex;
  justify-content: center;
  padding: 4px 0 12px;
}

/* 프로필 사진 썸네일 크기 오버라이드 (컴포넌트 수정 없이) */
.pf-photo :deep(.avatar) {
  /* 기존 컴포넌트 기본이 180px일 텐데, 150px로 축소 예시 */
  max-width: 120px;
  /* 필요 시 더 작게: 140px, 128px 등으로만 조절 */
}


/* ✅ 우측 상단 '설정' 버튼 */
.title-action-btn {
  position: absolute;
  top: 10px;
  right: 10px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 10px;
  border: 1px solid var(--divider);
  background: rgba(0,0,0,0.25);
  color: #ffffff;
  font-weight: 700;
  font-size: 13px;
  cursor: pointer;
  transition: transform .08s ease, background .2s ease, border-color .2s ease;
}
.title-action-btn:hover,
.title-action-btn:focus {
  background: rgba(212,175,55,0.12);
  border-color: var(--gold);
  outline: none;
}
.title-action-btn:active { transform: translateY(1px); }
.action-icon { font-size: 16px; color: var(--gold); }
.action-text { line-height: 1; }

/* 표(테이블) 공통 */
.info-table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: clamp(12px, 3.6vw, 14px); }
.info-table tr { border-bottom: 1px dashed var(--divider); }
.info-table tr:last-child { border-bottom: 0; }

/* ★ 변경지점: colgroup 네임스페이스(합 100%) */
.pf-col-th { width: 42%; }
.pf-col-td { width: 58%; }

/* ★ 교체 후 (안전: 테이블 셀 유지) */
.pf-scope .pf-th {
  padding: 8px 8px;
  vertical-align: middle;
  color: var(--text) !important;
  font-size: clamp(12.5px, 3.6vw, 14px) !important;
  line-height: 1.28;
  background: transparent !important;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}

/* 아이콘/라벨 간격은 margin으로 처리 */
.pf-scope .pf-th .row-icon {
  font-size: 14px !important;
  color: var(--gold) !important;
  margin-right: 6px;
  vertical-align: middle;
}

/* 라벨은 한 줄 말줄임 */
.pf-scope .pf-th .label {
  display: inline-block;
  max-width: calc(100% - 26px);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  color: var(--text) !important;
  font-weight: 700;
}
.pf-scope .pf-td {
  padding: 8px 8px;
  text-align: left;
  color: var(--text);
  background: transparent !important;
}

/* 아이콘 */
.pf-scope .row-icon {
  font-size: 14px !important;
  color: var(--gold) !important;
  opacity: .95;
}

/* ★ 변경지점: 라벨 가시성 강제(전역 규칙을 모두 덮음) */
.pf-scope .label {
  display: block;
  min-width: 0;
  color: var(--text) !important;
  -webkit-text-fill-color: var(--text) !important;
  opacity: 1 !important;
  visibility: visible !important;
  font-weight: 700;
  font-size: inherit !important;
  text-indent: 0 !important;
  filter: none !important;
  mix-blend-mode: normal !important;
}

/* 말줄임 */
.pf-scope .label,
.pf-scope .pf-td {
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}

/* 상태 텍스트 */
.pf-scope .readonly { color: var(--text-dim) !important; }

/* 행 hover/focus 배경을 "행 전체"에 동일 적용 */
.pf-scope .editable-row { cursor: pointer; border-left: 2px solid transparent; }
/* 편집 가능 행: 항상 강조된 흰색 */
.pf-scope .editable-row .pf-th,
.pf-scope .editable-row .pf-td {
  color: #ffffff;
  font-weight: 600;
}

/* 읽기 전용 행: 항상 흐린 회색 */
.pf-scope .readonly-row .pf-th,
.pf-scope .readonly-row .pf-td {
  color: var(--ink-weak);
  font-weight: 400;
}

.pf-scope .editable-row:hover .pf-td,
.pf-scope .editable-row:focus .pf-th,
.pf-scope .editable-row:focus .pf-td,
.pf-scope .editable-row:focus-within .pf-th,
.pf-scope .editable-row:focus-within .pf-td {
  background-color: var(--panel-2) !important;
}
.pf-scope .editable-row:hover { border-left-color: var(--gold-2); }
.pf-scope .editable-row:focus,
.pf-scope .editable-row:focus-within { border-left-color: var(--gold); }

/* 로딩 */
.loading-text { color: var(--text-muted); text-align: center; font-size: 14px; margin: 14px 0; }

/* 회원 등급 행의 '구독하기' 뱃지형 CTA */
.pf-scope .inline-cta {
  margin-left: 8px;
  padding: 4px 8px;
  border: 1px solid var(--gold);
  border-radius: 8px;
  color: var(--gold);
  font-weight: 700;
}
.pf-scope .editable-row:hover .inline-cta {
  background: rgba(212, 175, 55, 0.12);
}

/* 초소형 화면 */
@media (max-width: 360px) {
  .container { padding: 10px; }
  .card { border-radius: 10px; padding: 10px; }
  .info-table { font-size: 12px; }
  .pf-col-th { width: 46%; }
  .pf-col-td { width: 54%; }
  .pf-scope .pf-th, .pf-scope .pf-td { padding: 6px 6px; }
  .pf-scope .row-icon { font-size: 13px !important; }
}
</style>
