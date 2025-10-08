<template>
  <div class="page-wrapper">
    <div class="container">
      <!-- ✅ 내 프로필 카드 -->
      <div v-if="user" class="card pf-scope">
        <h3 class="card-title">
          <IonIcon :icon="icons.personCircleOutline" class="title-icon" />
          {{ user.nickname }}
        </h3>

        <!-- ✅ 프로필 사진 컴포넌트 -->
        <div class="pf-photo">
          <ProfilePhotoManager
            :gender="user?.gender || ''"
            :readonly="false"
            @updated="onProfilePhotoUpdated"
            @main-changed="onProfileMainChanged"
          />
        </div>

        <!-- ✅ 우측 상단 '설정' 버튼 -->
        <button class="title-action-btn" type="button" @click="goSetting" aria-label="설정으로 이동">
          <IonIcon :icon="icons.settingsOutline" class="action-icon" />
          <span class="action-text">설정</span>
        </button>

        <table class="info-table">
          <colgroup><col class="pf-col-th" /><col class="pf-col-td" /></colgroup>
          <tbody>
            <tr class="editable-row" @click="goMembership" tabindex="0" @keydown.enter="goMembership">
              <td class="pf-th">
                <IonIcon :icon="icons.ribbonOutline" class="row-icon" />
                <strong class="label">{{ user.user_level }}</strong>
              </td>
              <td class="pf-td editable-text"><span class="inline-cta">구독하기</span></td>
            </tr>

            <!-- 닉네임 -->
            <tr @click="openPopup(4, user.nickname)" class="editable-row" tabindex="0" @keydown.enter="openPopup(4, user.nickname)">
              <td class="pf-th"><IonIcon :icon="icons.personCircleOutline" class="row-icon" /><strong class="label">닉네임</strong></td>
              <td class="pf-td editable-text">{{ user.nickname }}</td>
            </tr>

            <tr>
              <td class="pf-th"><IonIcon :icon="icons.calendarOutline" class="row-icon" /><strong class="label">출생년도</strong></td>
              <td class="pf-td readonly editable-text">{{ user.birthyear || '미입력' }}</td>
            </tr>

            <tr>
              <td class="pf-th"><IonIcon :icon="icons.maleFemaleOutline" class="row-icon" /><strong class="label">성별</strong></td>
              <td class="pf-td readonly editable-text">
                {{ user.gender === 'man' ? '남자' : user.gender === 'woman' ? '여자' : '미입력' }}
              </td>
            </tr>

            <!-- 전화번호 -->
            <tr
              @click="openPopup(4, user.nickname)"
              class="editable-row"
              tabindex="0"
              @keydown.enter="openPopup(4, user.nickname)"
            >
              <td class="pf-th">
                <IonIcon :icon="icons.personCircleOutline" class="row-icon" />
                <strong class="label">{{ user.phone }}010-1234-1234</strong>
              </td>

              <!-- ✅ '번호변경' 버튼 (행 높이에 영향 X, 회색 처리) -->
              <td class="pf-td editable-text">
                <IonButton
                  size="small"
                  color="medium"
                  class="btn-inline-gray"
                  @click.stop="onChangePhoneClick(user)"
                >
                  번호변경
                </IonButton>
              </td>
            </tr>

            <!-- 지역 -->
            <tr @click="openPopup(1, user.region1 + ' ' + user.region2)" class="editable-row" tabindex="0" @keydown.enter="openPopup(1, user.region1 + ' ' + user.region2)">
              <td class="pf-th"><IonIcon :icon="icons.locationOutline" class="row-icon" /><strong class="label">지역</strong></td>
              <td class="pf-td editable-text">{{ user.region1 }} {{ user.region2 }}</td>
            </tr>

            <!-- 성향 -->
            <tr @click="openPopup(2, user.preference)" class="editable-row" tabindex="0" @keydown.enter="openPopup(2, user.preference)">
              <td class="pf-th"><IonIcon :icon="icons.sparklesOutline" class="row-icon" /><strong class="label">특징</strong></td>
              <td class="pf-td editable-text">{{ user.preference }}</td>
            </tr>

            <!-- 결혼유무 (개인 프로필) -->
            <tr @click="openMarriageModal" class="editable-row" tabindex="0" @keydown.enter="openMarriageModal">
              <td class="pf-th"><IonIcon :icon="icons.sparklesOutline" class="row-icon" /><strong class="label">결혼유무</strong></td>
              <td class="pf-td editable-text">{{ user.marriage }}</td>
            </tr>

            <!-- 소개 -->
            <tr @click="openPopup(3, user.selfintro || '소개 없음')" class="editable-row" tabindex="0" @keydown.enter="openPopup(3, user.selfintro || '소개 없음')">
              <td class="pf-th"><IonIcon :icon="icons.chatbubbleEllipsesOutline" class="row-icon" /><strong class="label">소개</strong></td>
              <td class="pf-td editable-text">{{ user.selfintro || '소개 없음' }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <br />

      <!-- ✅ 친구 찾기 설정 카드 -->
      <div v-if="user" class="card pf-scope">
        <h3 class="card-title"><IonIcon :icon="icons.optionsOutline" class="title-icon" />친구 찾기 설정</h3>

        <table class="info-table">
          <colgroup><col class="pf-col-th" /><col class="pf-col-td" /></colgroup>
          <tbody>
            <!-- 검색나이 -->
            <tr class="editable-row" @click="openSearchYearModal" tabindex="0" @keydown.enter="openSearchYearModal">
              <td class="pf-th"><IonIcon :icon="icons.calendarNumberOutline" class="row-icon" /><strong class="label">검색나이</strong></td>
              <td class="pf-td editable-text">{{ toAll(user.search_birthyear1) }} ~ {{ toAll(user.search_birthyear2) }}</td>
            </tr>

            <!-- 검색지역 -->
            <tr class="editable-row" @click="openSearchRegionModal" tabindex="0" @keydown.enter="openSearchRegionModal">
              <td class="pf-th"><IonIcon :icon="icons.locationOutline" class="row-icon" /><strong class="label">검색지역</strong></td>
              <td class="pf-td editable-text">{{ searchRegionDisplay }}</td>
            </tr>

            <!-- 휴대폰 내 번호 연결 끊기 -->
            <tr class="editable-row" tabindex="0" @keydown.enter.prevent="toggleDisconnectLocalContacts">
              <td class="pf-td2 pf-fullcell" colspan="2">
                <div class="pf-fullrow">
                  <IonIcon :icon="icons.optionsOutline" class="row-icon" />
                  <strong class="label pf-fullrow__label">휴대폰 내 번호 연결 끊기</strong>
                  <button type="button" class="pf-switch" role="switch"
                          :aria-checked="disconnectLocalContacts"
                          :class="{ 'is-on': disconnectLocalContacts }"
                          @click.stop="toggleDisconnectLocalContacts">
                    <span class="pf-switch__text pf-switch__text--left" aria-hidden="true">ON</span>
                    <span class="pf-switch__knob" />
                    <span class="pf-switch__label">{{ disconnectLocalContacts ? 'ON' : 'OFF' }}</span>
                  </button>
                </div>
              </td>
            </tr>

            <!-- 친구 신청 받지 않기 (불리언 반전 UI) -->
            <tr class="editable-row" tabindex="0" @keydown.enter.prevent="toggleAllowFriendRequests">
              <td class="pf-td2 pf-fullcell" colspan="2">
                <div class="pf-fullrow">
                  <IonIcon :icon="icons.optionsOutline" class="row-icon" />
                  <strong class="label pf-fullrow__label">친구 신청 받지 않기</strong>
                  <button type="button" class="pf-switch" role="switch"
                          :aria-checked="!allowFriendRequests"
                          :class="{ 'is-on': !allowFriendRequests }"
                          @click.stop="toggleAllowFriendRequests">
                    <span class="pf-switch__text pf-switch__text--left" aria-hidden="true">ON</span>
                    <span class="pf-switch__knob" />
                    <span class="pf-switch__label">{{ !allowFriendRequests ? 'ON' : 'OFF' }}</span>
                  </button>
                </div>
              </td>
            </tr>

            <!-- 알림 받지 않기 (불리언 반전 UI) -->
            <tr class="editable-row" tabindex="0" @keydown.enter.prevent="toggleAllowNotifications">
              <td class="pf-td2 pf-fullcell" colspan="2">
                <div class="pf-fullrow">
                  <IonIcon :icon="icons.optionsOutline" class="row-icon" />
                  <strong class="label pf-fullrow__label">알림 받지 않기</strong>
                  <button type="button" class="pf-switch" role="switch"
                          :aria-checked="!allowNotifications"
                          :class="{ 'is-on': !allowNotifications }"
                          @click.stop="toggleAllowNotifications">
                    <span class="pf-switch__text pf-switch__text--left" aria-hidden="true">ON</span>
                    <span class="pf-switch__knob" />
                    <span class="pf-switch__label">{{ !allowNotifications ? 'ON' : 'OFF' }}</span>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <br />

      <!-- ✅ 프리미엄 설정 카드 -->
      <div v-if="user" class="card pf-scope">
        <h3 class="card-title"><IonIcon :icon="icons.optionsOutline" class="title-icon" />프리미엄 설정</h3>

        <table class="info-table">
          <colgroup><col class="pf-col-th" /><col class="pf-col-td" /></colgroup>
          <tbody>
            <!-- 검색특징 -->
            <tr class="editable-row" @click="openSearchPreferenceModal" tabindex="0" @keydown.enter="openSearchPreferenceModal">
              <td class="pf-th"><IonIcon :icon="icons.sparklesOutline" class="row-icon" /><strong class="label">검색특징</strong></td>
              <td class="pf-td editable-text">{{ user.search_preference }}</td>
            </tr>

            <!-- 상대 결혼 유무 (검색 조건) -->
            <tr class="editable-row" @click="openSearchMarriageModal" tabindex="0" @keydown.enter="openSearchMarriageModal">
              <td class="pf-th"><IonIcon :icon="icons.sparklesOutline" class="row-icon" /><strong class="label">상대 결혼 유무</strong></td>
              <td class="pf-td editable-text">{{ user.search_marriage }}</td>
            </tr>

            <!-- 사진 없는 사람 연결 끊기 -->
            <tr class="editable-row" tabindex="0" @keydown.enter.prevent="toggleOnlyWithPhoto">
              <td class="pf-td2 pf-fullcell" colspan="2">
                <div class="pf-fullrow">
                  <IonIcon :icon="icons.optionsOutline" class="row-icon" />
                  <strong class="label pf-fullrow__label">사진 없는 사람 연결 끊기</strong>
                  <button type="button" class="pf-switch" role="switch"
                          :aria-checked="onlyWithPhoto"
                          :class="{ 'is-on': onlyWithPhoto }"
                          @click.stop="toggleOnlyWithPhoto">
                    <span class="pf-switch__text pf-switch__text--left" aria-hidden="true">ON</span>
                    <span class="pf-switch__knob" />
                    <span class="pf-switch__label">{{ onlyWithPhoto ? 'ON' : 'OFF' }}</span>
                  </button>
                </div>
              </td>
            </tr>

            <!-- Premium 만 연결하기 -->
            <tr class="editable-row" tabindex="0" @keydown.enter.prevent="toggleMatchPremiumOnly">
              <td class="pf-td2 pf-fullcell" colspan="2">
                <div class="pf-fullrow">
                  <IonIcon :icon="icons.optionsOutline" class="row-icon" />
                  <strong class="label pf-fullrow__label">Premium 만 연결하기</strong>
                  <button type="button" class="pf-switch" role="switch"
                          :aria-checked="matchPremiumOnly"
                          :class="{ 'is-on': matchPremiumOnly }"
                          @click.stop="toggleMatchPremiumOnly">
                    <span class="pf-switch__text pf-switch__text--left" aria-hidden="true">ON</span>
                    <span class="pf-switch__knob" />
                    <span class="pf-switch__label">{{ matchPremiumOnly ? 'ON' : 'OFF' }}</span>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p v-else class="loading-text">유저 정보를 불러오는 중입니다...</p>
    </div>

    <!-- ✅ 내 프로필 모달들 -->
    <PopupModal_1 v-if="showModal1" :message="popupMessage" @close="showModal1 = false" @updated="handleRegionUpdate" />
    <PopupModal_2 v-if="showModal2" :message="popupMessage" @close="showModal2 = false" @updated="handlePreferenceUpdate" />
    <PopupModal_3 v-if="showModal3" :message="popupMessage" @close="showModal3 = false" @updated="handleIntroUpdate" />
    <PopupModal_4 v-if="showModal4" :message="popupMessage" @close="showModal4 = false" @updated="handleNicknameUpdate" />
    <!-- 결혼유무(개인 프로필) -->
    <ModalMarriage v-if="showMarriageModal" :message="user?.marriage || ''" @close="showMarriageModal = false" @updated="handleMarriageUpdated" />

    <!-- ✅ 검색 모달들 -->
    <Search_Year_Modal v-if="showSearchYear"
      :initial-from="user?.search_birthyear1 ?? ''" :initial-to="user?.search_birthyear2 ?? ''"
      :from="user?.search_birthyear1 ?? ''" :to="user?.search_birthyear2 ?? ''"
      @close="showSearchYear = false" @updated="onSearchYearUpdated" />
    <Search_Region_Modal v-if="showSearchRegion" :regions="regionsForModal" @close="showSearchRegion = false" @updated="onSearchRegionUpdated" />
    <Search_Preference_Modal v-if="showSearchPreference" :message="user?.search_preference ?? ''" @close="showSearchPreference = false" @updated="onSearchPreferenceUpdated" />
    <!-- 상대 결혼유무(검색 조건) -->
    <Search_Marriage v-if="showSearchMarriage" :message="user?.search_marriage ?? '전체'" @close="showSearchMarriage = false" @updated="handleSearchMarriageUpdated" />

    <PasswordChangeModal :is-open="showPasswordModal" @close="showPasswordModal = false" @updated="onPasswordUpdated" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { toastController, alertController, IonIcon, IonButton } from '@ionic/vue'
import axios from '@/lib/api'
import { useRouter } from 'vue-router'
import { Contacts } from '@capacitor-community/contacts'

import PopupModal_1 from '@/components/04610_Page6_profile/Modal_region.vue'
import PopupModal_2 from '@/components/04610_Page6_profile/Modal_preference.vue'
import PopupModal_3 from '@/components/04610_Page6_profile/Modal_mention.vue'
import PopupModal_4 from '@/components/04610_Page6_profile/Modal_nickname.vue'
import Search_Year_Modal from '@/components/04610_Page6_profile/Search_Year_Modal.vue'
import Search_Region_Modal from '@/components/04610_Page6_profile/Search_Region_Modal.vue'
import Search_Preference_Modal from '@/components/04610_Page6_profile/Search_Preference_Modal.vue'
import PasswordChangeModal from '@/components/04610_Page6_profile/Modal_password_chagne.vue'
import ProfilePhotoManager from '@/components/04610_Page6_profile/ProfilePhotoManager.vue'
import ModalMarriage from '@/components/04610_Page6_profile/Modal_marriage.vue'
import Search_Marriage from '@/components/04610_Page6_profile/Search_Marriage.vue'

import {
  personCircleOutline, lockClosedOutline, calendarOutline, calendarNumberOutline,
  maleFemaleOutline, locationOutline, sparklesOutline, chatbubbleEllipsesOutline,
  logInOutline, timeOutline, optionsOutline, settingsOutline, ribbonOutline,
} from 'ionicons/icons'
const icons = { personCircleOutline, lockClosedOutline, calendarOutline, calendarNumberOutline, maleFemaleOutline, locationOutline, sparklesOutline, chatbubbleEllipsesOutline, logInOutline, timeOutline, optionsOutline, settingsOutline, ribbonOutline }

const router = useRouter()
const nickname = ref('')
const user = ref(null)

/* 모달 on/off */
const showModal1 = ref(false)
const showModal2 = ref(false)
const showModal3 = ref(false)
const showModal4 = ref(false)
const showMarriageModal = ref(false)
const showSearchMarriage = ref(false)
const popupMessage = ref('')

/* 검색 모달 */
const showSearchYear = ref(false)
const showSearchRegion = ref(false)
const showSearchPreference = ref(false)

/* ✅ 누락된 오프너 3종 추가 */
function openSearchYearModal(){ showSearchYear.value = true }
function openSearchRegionModal(){ showSearchRegion.value = true }
function openSearchPreferenceModal(){ showSearchPreference.value = true }

/* 비번 */
const showPasswordModal = ref(false)
function openPasswordModal() { showPasswordModal.value = true }
async function onPasswordUpdated() {
  const t = await toastController.create({ message: '비밀번호가 변경되었습니다.', duration: 1400, color: 'success' })
  t.present()
}

//전화번호 변경
function onChangePhoneClick(user) {
  console.log('번호 변경 요청:', user);
}

/* 이동 */
function goSetting() { router.push('/home/7page') }
function goMembership() { router.push('/home/setting/0001') }

/* 사진 */
function onProfilePhotoUpdated() {}
async function onProfileMainChanged() {
  const t = await toastController.create({ message: '대표 사진이 변경되었습니다.', duration: 1200, color: 'success' })
  t.present()
}

/* 유틸 */
const toAll = (v) => (v === null || v === undefined || v === '' ? '전체' : v)
const openPopup = (n, v) => { popupMessage.value = v; showModal1.value = n===1; showModal2.value = n===2; showModal3.value = n===3; showModal4.value = n===4 }

/* 결혼유무 모달 열기 */
function openMarriageModal() { showMarriageModal.value = true }
function openSearchMarriageModal() { showSearchMarriage.value = true }

/* 지역 모달 계산 */
const regionsForModal = computed(() => {
  if (!user.value) return []
  const fromSnake = Array.isArray(user.value.search_regions) ? user.value.search_regions : []
  const fromCamel = Array.isArray(user.value.searchRegions) ? user.value.searchRegions : []
  const list = (fromSnake.length ? fromSnake : fromCamel).map(r => ({ region1: r?.region1 || '', region2: r?.region2 || '' }))
  if (list.length) return list
  const r1 = user.value.search_region1 || ''; const r2 = user.value.search_region2 || ''
  if (!r1 && !r2) return []
  if (r1 === '전체' && r2 === '전체') return [{ region1: '전체', region2: '전체' }]
  return [{ region1: r1, region2: r2 }]
})

/* 지역 표시 */
const searchRegionsBuffer = ref([])
const effectiveRegions = computed(() => {
  if (searchRegionsBuffer.value?.length) return searchRegionsBuffer.value
  const snake = Array.isArray(user.value?.search_regions) ? user.value.search_regions : []
  const camel = Array.isArray(user.value?.searchRegions) ? user.value.searchRegions : []
  if (snake.length) return snake
  if (camel.length) return camel
  const r1 = user.value?.search_region1 || ''; const r2 = user.value?.search_region2 || ''
  return r1 || r2 ? [{ region1: r1, region2: r2 }] : []
})
function labelOf(it){ const r1=(it?.region1||'').trim(), r2=(it?.region2||'').trim(); if(!r1&&!r2) return '전체'; if(r1==='전체'&&r2==='전체') return '전체'; if(r2==='전체') return `${r1} 전체`; return `${r1} ${r2}`.trim() }
const searchRegionDisplay = computed(() => {
  const list = effectiveRegions.value
  if (!list.length) return '전체'
  if (list.length === 1 && list[0].region1 === '전체' && list[0].region2 === '전체') return '전체'
  const first = labelOf(list[0]); return list.length === 1 ? first : `${first} 외 ${list.length - 1}`
})

/* 검색나이 저장 */
async function onSearchYearUpdated(payload) {
  let from = '', to = ''
  if (typeof payload === 'string') { const [f='', t=''] = payload.split('~').map(s=>s.trim()); from=f; to=t }
  else if (Array.isArray(payload)) { from = payload[0] ?? ''; to = payload[1] ?? '' }
  else if (payload && typeof payload === 'object') { from = payload.from ?? payload.year1 ?? ''; to = payload.to ?? payload.year2 ?? '' }
  if (user.value) { user.value.search_birthyear1 = from; user.value.search_birthyear2 = to }
  try {
    await axios.patch('/api/search/year', { year1: from, year2: to }, { withCredentials: true })
    const t = await toastController.create({ message: '검색 나이가 적용되었습니다.', duration: 1500, color: 'success' }); await t.present()
  } catch (err) {
    const t = await toastController.create({ message: '저장 실패: ' + (err?.response?.data?.error || err.message), duration: 2000, color: 'danger' }); await t.present()
  } finally { showSearchYear.value = false }
}

/* 검색지역 저장 */
function normalizeRegionsPayload(payload){
  let arr=[]
  if (Array.isArray(payload)) {
    if (payload.length && typeof payload[0] === 'object') arr = payload
    else { const [r1='', r2=''] = payload; arr = [{ region1:r1, region2:r2 }] }
  } else if (payload && typeof payload === 'object') { arr = [{ region1: payload.region1 ?? payload.r1 ?? '', region2: payload.region2 ?? payload.r2 ?? '' }] }
  else if (typeof payload === 'string') { const parts = payload.split(/[,\s]+/).map(s=>s.trim()).filter(Boolean); const [r1='',r2='']=parts; arr=[{region1:r1, region2:r2}] }
  arr = arr.map(it=>({ region1:(it.region1||'').trim(), region2:(it.region2||'').trim() })).filter(it=>it.region1 && it.region2)
  if (arr.some(it=>it.region1==='전체' && it.region2==='전체')) return [{ region1:'전체', region2:'전체' }]
  return arr
}
async function onSearchRegionUpdated(payload){
  const normalized = normalizeRegionsPayload(payload)
  if (user.value) {
    const first = normalized[0] || { region1:'', region2:'' }
    user.value.search_region1 = first.region1 || ''
    user.value.search_region2 = first.region2 || ''
    user.value.search_regions = normalized
    user.value.searchRegions = normalized
  }
  searchRegionsBuffer.value = normalized
  try {
    await axios.patch('/api/search/regions', { regions: normalized }, { withCredentials: true })
    const t = await toastController.create({ message: '검색 지역이 적용되었습니다.', duration: 1500, color: 'success' }); await t.present()
  } catch (err) {
    const t = await toastController.create({ message: '저장 실패: ' + (err?.response?.data?.error || err.message), duration: 2000, color: 'danger' }); await t.present()
  } finally { showSearchRegion.value = false }
}

/* 검색특징 저장 */
async function onSearchPreferenceUpdated(payload){
  const preference = typeof payload === 'string' ? payload : payload?.preference ?? ''
  if (user.value) user.value.search_preference = preference
  try {
    await axios.patch('/api/search/preference', { preference }, { withCredentials: true })
    const t = await toastController.create({ message: '검색 특징이 적용되었습니다.', duration: 1500, color: 'success' }); await t.present()
  } catch (err) {
    const t = await toastController.create({ message: '저장 실패: ' + (err?.response?.data?.error || err.message), duration: 2000, color: 'danger' }); await t.present()
  } finally { showSearchPreference.value = false }
}

/* 결혼유무(개인) 업데이트 반영 */
async function handleMarriageUpdated(value){
  if (user.value) user.value.marriage = value
  const t = await toastController.create({ message: '결혼유무가 변경되었습니다.', duration: 1300, color: 'success' })
  await t.present()
  showMarriageModal.value = false
}

/* 상대 결혼유무(검색조건) 업데이트 반영 */
async function handleSearchMarriageUpdated(value){
  if (user.value) user.value.search_marriage = value
  const t = await toastController.create({ message: '검색 결혼유무가 변경되었습니다.', duration: 1300, color: 'success' })
  await t.present()
  showSearchMarriage.value = false
}

/* 즉시 반영 */
async function handleNicknameUpdate(payload){ const v = typeof payload==='string' ? payload : payload?.nickname ?? ''; if(user.value && v) user.value.nickname=v; (await toastController.create({message:'닉네임이 변경되었습니다.',duration:1400,color:'success'})).present(); showModal4.value=false }
async function handleRegionUpdate(payload){ let r1='',r2=''; if(Array.isArray(payload)){[r1='',r2='']=payload}else if(payload&&typeof payload==='object'){r1=payload.region1??payload.r1??''; r2=payload.region2??payload.r2??''} else if(typeof payload==='string'){const p=payload.split(/[,\s]+/).map(s=>s.trim()).filter(Boolean); [r1='',r2='']=p} if(user.value){user.value.region1=r1; user.value.region2=r2} (await toastController.create({message:'지역이 변경되었습니다.',duration:1400,color:'success'})).present(); showModal1.value=false }
async function handlePreferenceUpdate(payload){ const pref = typeof payload==='string' ? payload : payload?.preference ?? ''; if(user.value) user.value.preference=pref; (await toastController.create({message:'성향이 변경되었습니다.',duration:1400,color:'success'})).present(); showModal2.value=false }
async function handleIntroUpdate(payload){ const intro = typeof payload==='string' ? payload : payload?.selfintro ?? ''; if(user.value) user.value.selfintro=intro; (await toastController.create({message:'소개가 변경되었습니다.',duration:1400,color:'success'})).present(); showModal3.value=false }

/* ===========================
   ✅ 스위치(5개) — DB에 ON/OFF 저장
   =========================== */
const disconnectLocalContacts = ref(false)
const allowFriendRequests    = ref(false)  // UI: "받지 않기" → true면 DB OFF, false면 DB ON
const allowNotifications     = ref(false)  // UI: "받지 않기" → true면 DB OFF, false면 DB ON
const onlyWithPhoto          = ref(false)
const matchPremiumOnly       = ref(false)

const onOffToBool = (v) => String(v || '').toUpperCase() === 'ON'
const boolToOnOff = (b) => (b ? 'ON' : 'OFF')

async function saveSwitchesToDB() {
  if (!user.value) return
  // user 객체 문자열 동기화 (UI 반전 로직 반영)
  user.value.search_disconnectLocalContacts = boolToOnOff(disconnectLocalContacts.value)
  user.value.search_allowFriendRequests    = boolToOnOff(!allowFriendRequests.value)
  user.value.search_allowNotifications     = boolToOnOff(!allowNotifications.value)
  user.value.search_onlyWithPhoto          = boolToOnOff(onlyWithPhoto.value)
  user.value.search_matchPremiumOnly       = boolToOnOff(matchPremiumOnly.value)

  const payload = {
    disconnectLocalContacts: user.value.search_disconnectLocalContacts,
    allowFriendRequests:     boolToOnOff(!allowFriendRequests.value),
    allowNotifications:      boolToOnOff(!allowNotifications.value),
    onlyWithPhoto:           user.value.search_onlyWithPhoto,
    matchPremiumOnly:        user.value.search_matchPremiumOnly,
  }

  try {
    await axios.patch('/api/search/settings', payload, { withCredentials: true })
  } catch (err) {
    console.error('설정 저장 실패:', err)
    ;(await toastController.create({ message: '설정 저장에 실패했습니다.', duration: 1600, color: 'danger' })).present()
    throw err
  }
}

/* ---------------------------------------
   ✅ 연락처 업로드/삭제를 동반하는 토글 로직
   --------------------------------------- */
async function toggleDisconnectLocalContacts(){
  const nextState = !disconnectLocalContacts.value
  if (nextState) {
    const ok = await confirmDialog('휴대폰 내 번호 업데이트 하겠습니까?')
    if (!ok) return

    try {
      const hashes = await collectLocalContactHashes()
      await axios.post('/api/contacts/hashes', { hashes }, { withCredentials: true })
      disconnectLocalContacts.value = true
      await saveSwitchesToDB()
      ;(await toastController.create({ message: `연락처 ${hashes.length}건이 저장되었습니다.`, duration: 1500, color: 'success' })).present()
    } catch (err) {
      console.error('연락처 저장 실패:', err)
      ;(await toastController.create({ message: '연락처 저장에 실패했습니다.', duration: 1600, color: 'danger' })).present()
      disconnectLocalContacts.value = false
    }
  } else {
    const ok = await confirmDialog('저장된 전화번호를 삭제하겠습니다.')
    if (!ok) return

    try {
      await axios.delete('/api/contacts/hashes', { withCredentials: true })
      disconnectLocalContacts.value = false
      await saveSwitchesToDB()
      ;(await toastController.create({ message: '저장된 연락처가 삭제되었습니다.', duration: 1400, color: 'success' })).present()
    } catch (err) {
      console.error('연락처 삭제 실패:', err)
      ;(await toastController.create({ message: '연락처 삭제에 실패했습니다.', duration: 1600, color: 'danger' })).present()
      disconnectLocalContacts.value = true
    }
  }
}

/* 다른 스위치들 (동일) */
async function toggleAllowFriendRequests()   { allowFriendRequests.value    = !allowFriendRequests.value;    await saveSwitchesToDB(); feedbackOK('설정이 적용되었습니다.') }
async function toggleAllowNotifications()    { allowNotifications.value     = !allowNotifications.value;     await saveSwitchesToDB(); feedbackOK('설정이 적용되었습니다.') }
async function toggleOnlyWithPhoto()         { onlyWithPhoto.value          = !onlyWithPhoto.value;          await saveSwitchesToDB(); feedbackOK('설정이 적용되었습니다.') }
async function toggleMatchPremiumOnly()      { matchPremiumOnly.value       = !matchPremiumOnly.value;       await saveSwitchesToDB(); feedbackOK('설정이 적용되었습니다.') }

/* -------- 공통 유틸: 확인 다이얼로그 -------- */
async function confirmDialog(message){
  const alert = await alertController.create({
    header: '확인',
    message,
    cssClass: 'tz-alert',
    buttons: [
      { text: '취소', role: 'cancel' },
      { text: '확인', role: 'confirm' }
    ]
  })
  await alert.present()
  const { role } = await alert.onDidDismiss()
  return role === 'confirm'
}

/* -------- 연락처 수집 → 정규화 → 해시 -------- */
function normalizePhoneKR(raw=''){
  const digits = String(raw).replace(/[^\d+]/g, '')
  if (!digits) return ''
  if (digits.startsWith('+')) return digits
  if (digits.startsWith('0')) return '+82' + digits.slice(1)
  return '+82' + digits
}

async function sha256Hex(text){
  const enc = new TextEncoder().encode(text)
  const buf = await crypto.subtle.digest('SHA-256', enc)
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('')
}

// 연락처 -> 전화번호 배열 추출 (Capacitor 전용 구현)
async function getLocalContactPhoneNumbers() {
  try {
    if (typeof Contacts.requestPermissions === 'function') {
      await Contacts.requestPermissions()
    }
  } catch (_) {
    // 일부 버전에선 requestPermissions 미지원일 수 있으니 무시
  }

  // projection 지원 여부 가드
  const supportsProjection = typeof Contacts.getContacts === 'function' && Contacts.getContacts.length > 0

  let res
  if (supportsProjection) {
    res = await Contacts.getContacts({
      projection: { phones: true, name: false, organization: false, postalAddresses: false }
    })
  } else {
    res = await Contacts.getContacts()
  }

  const list = Array.isArray(res?.contacts) ? res.contacts : []
  const numbers = []

  for (const c of list) {
    const phones = c?.phones || c?.phoneNumbers || []
    for (const p of phones) {
      const v = typeof p === 'string' ? p : (p?.number || p?.value || '')
      if (v) numbers.push(v)
    }
  }

  if (!numbers.length) throw new Error('연락처에서 전화번호를 찾지 못했습니다.')
  return numbers
}

async function collectLocalContactHashes(){
  const phones = await getLocalContactPhoneNumbers()
  const normalized = Array.from(new Set(phones.map(normalizePhoneKR).filter(Boolean)))
  const hashes = await Promise.all(normalized.map(n => sha256Hex(n)))
  return hashes
}

/* 피드백 토스트 */
async function feedbackOK(message){ (await toastController.create({ message, duration: 1200, color: 'success' })).present() }

/* 초기 로딩 */
onMounted(async () => {
  try {
    const res = await axios.get('/api/me', { withCredentials: true })
    user.value = res.data.user
    nickname.value = user.value?.nickname || ''

    const fromSnake = Array.isArray(user.value?.search_regions) ? user.value.search_regions : []
    const fromCamel = Array.isArray(user.value?.searchRegions) ? user.value.searchRegions : []
    const list = fromSnake.length ? fromSnake : fromCamel
    if (list.length) searchRegionsBuffer.value = list

    // 🔹 스위치 초기값 (DB 문자열 → 불리언)
    disconnectLocalContacts.value = onOffToBool(user.value?.search_disconnectLocalContacts)
    allowFriendRequests.value     = !onOffToBool(user.value?.search_allowFriendRequests)
    allowNotifications.value      = !onOffToBool(user.value?.search_allowNotifications)
    onlyWithPhoto.value           = onOffToBool(user.value?.search_onlyWithPhoto)
    matchPremiumOnly.value        = onOffToBool(user.value?.search_matchPremiumOnly)
  } catch (err) {
    console.error('유저 정보 로딩 실패:', err)
  }
})

/* 기타 */
const formatDate = (s) => (!s ? '없음' : new Date(s).toLocaleString())
const logout = async () => { try { await axios.post('/api/logout', {}, { withCredentials: true }); router.push('/login') } catch (e) { console.error('로그아웃 실패:', e) } }
</script>

<style scoped>
/* === 스타일 동일 (생략 없이 유지) === */
:root{--bg:#0b0b0e;--panel:#111215;--panel-2:#15161a;--gold:#d4af37;--gold-2:#b8901e;--gold-3:#8c6f12;--text:#eaeaea;--text-dim:#bdbdbd;--text-muted:#9aa0a6;--divider:rgba(212,175,55,.18);--shadow:rgba(0,0,0,.35)}
.page-wrapper{background:radial-gradient(1200px 800px at 20% -10%, rgba(212,175,55,.08), transparent 55%), radial-gradient(900px 700px at 110% -20%, rgba(184,144,30,.06), transparent 60%), var(--bg); color:var(--text); min-height:100%}
.container{padding:12px}
.card{border:1px solid var(--divider); border-radius:12px; padding:12px; background:linear-gradient(180deg, rgba(255,255,255,.02), rgba(255,255,255,0)), var(--panel); color:var(--text); box-shadow:0 8px 24px var(--shadow); backdrop-filter:blur(2px); position:relative}
.card-title{display:flex; align-items:center; gap:8px; margin:0 0 5px 0; margin-bottom:15px; font-size:clamp(15px,4.2vw,18px); font-weight:800; color:var(--text); position:relative}
.card-title::after{content:""; height:2px; width:44px; background:linear-gradient(90deg, var(--gold), transparent); position:absolute; left:0; bottom:-6px}
.title-icon{font-size:18px; color:var(--gold)}
.pf-photo{display:flex; justify-content:center; padding:4px 0 12px}
.pf-photo :deep(.avatar){max-width:120px}
.title-action-btn{position:absolute; top:10px; right:10px; display:inline-flex; align-items:center; gap:6px; padding:6px 10px; border-radius:10px; border:1px solid var(--divider); background:rgba(0,0,0,.25); color:#fff; font-weight:700; font-size:13px; cursor:pointer; transition:transform .08s ease, background .2s ease, border-color .2s ease}
.title-action-btn:hover,.title-action-btn:focus{background:rgba(212,175,55,.12); border-color:var(--gold); outline:none}
.title-action-btn:active{transform:translateY(1px)}
.action-icon{font-size:16px; color:var(--gold)}
.info-table{width:100%; border-collapse:collapse; table-layout:fixed; font-size:clamp(12px,3.6vw,14px)}
.info-table tr{border-bottom:1px dashed var(--divider); padding:6px 0}
.info-table tr:last-child{border-bottom:0}
.pf-col-th{width:42%}.pf-col-td{width:58%}
.pf-scope .pf-th{padding:8px 8px; vertical-align:middle; color:var(--text)!important; font-size:clamp(12.5px,3.6vw,14px)!important; line-height:1.28; background:transparent!important; white-space:nowrap; overflow:hidden; text-overflow:ellipsis}
.pf-scope .pf-th .row-icon{font-size:14px!important; color:var(--gold)!important; margin-right:6px; vertical-align:middle}
.pf-scope .pf-th .label{display:inline-block; max-width:calc(100% - 26px); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; color:var(--text)!important; font-weight:700}
.pf-scope .pf-td{padding:8px 0px; padding-right:12px; text-align:right; color:var(--text); background:transparent!important}
.pf-scope .row-icon{font-size:14px!important; color:var(--gold)!important; opacity:.95}
.pf-scope .label,.pf-scope .pf-td{white-space:nowrap; overflow:hidden; text-overflow:ellipsis}
.pf-scope .readonly{color:var(--text-dim)!important}
.pf-scope .editable-row{cursor:pointer; border-left:2px solid transparent}
.pf-scope .editable-row .pf-th,.pf-scope .editable-row .pf-td{color:#fff; font-weight:600}
.pf-scope .editable-row:hover .pf-td,.pf-scope .editable-row:focus .pf-th,.pf-scope .editable-row:focus .pf-td,.pf-scope .editable-row:focus-within .pf-th,.pf-scope .editable-row:focus-within .pf-td{background-color:var(--panel-2)!important}
.pf-scope .editable-row:hover{border-left-color:var(--gold-2)}
.pf-scope .editable-row:focus,.pf-scope .editable-row:focus-within{border-left-color:var(--gold)}
.loading-text{color:var(--text-muted); text-align:center; font-size:14px; margin:14px 0}
.pf-scope .inline-cta{margin-left:8px; padding:4px 8px; border:1px solid var(--gold); border-radius:8px; color:var(--gold); font-weight:700}
.pf-scope .editable-row:hover .inline-cta{background:rgba(212,175,55,.12)}
.pf-switch{position:relative; display:inline-flex; align-items:center; gap:8px; width:54px; height:20px; padding:0 8px; border-radius:999px; border:1px solid var(--divider); background:rgba(0,0,0,.35); color:var(--text); font-weight:800; cursor:pointer; transition:background .2s ease, border-color .2s ease, box-shadow .2s ease}
.pf-switch.is-on{background:rgba(212,175,55,.18); border-color:var(--gold); box-shadow:0 0 0 2px rgba(212,175,55,.12) inset}
.pf-switch__knob{position:absolute; top:3px; left:3px; width:16px; height:16px; border-radius:50%; background:#fff; box-shadow:0 2px 6px var(--shadow); transition:transform .18s ease}
.pf-switch.is-on .pf-switch__knob{transform:translateX(32px)}
.pf-switch__label{margin-left:auto; font-size:11px; opacity:.9; user-select:none}
.pf-switch.is-on .pf-switch__label{opacity:0}
.pf-switch__text--left{position:absolute; left:10px; top:50%; transform:translateY(-50%); font-size:11px; font-weight:800; letter-spacing:.2px; color:var(--gold); opacity:0; transition:opacity .18s ease; pointer-events:none; user-select:none}
.pf-switch.is-on .pf-switch__text--left{opacity:.95}
.pf-fullcell{padding:8px 8px!important}
.pf-fullrow{display:flex; align-items:center; gap:8px; width:100%}
.pf-fullrow__label{flex:1 1 auto; white-space:normal!important; overflow:visible!important; text-overflow:unset!important}
.btn-inline-gray {
  --background: transparent;
  --color: #666;
  --border-color: #ccc;
  --border-width: 1px;
  --border-style: solid;
  --border-radius: 6px;
  --padding-start: 8px;
  --padding-end: 8px;
  --padding-top: 2px;
  --padding-bottom: 2px;
  font-size: 0.8rem;
  height: auto;
  min-height: unset;
  line-height: 1.2;
}

@media (max-width:360px){
  .container{padding:10px}
  .card{border-radius:10px; padding:10px}
  .info-table{font-size:12px}
  .pf-col-th{width:46%; padding-top:12px; padding-bottom:12px}
  .pf-col-td{width:54%}
  .pf-scope .pf-th,.pf-scope .pf-td{padding:6px 6px}
  .pf-scope .row-icon{font-size:13px!important}
}
</style>
