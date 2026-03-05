<template>
  <div class="page-wrapper">
    <div class="container">
      <!-- ✅ 내 프로필 카드 -->
      <div v-if="user" class="card pf-scope">
        <h3 class="card-title">
          <IonIcon :icon="icons.personCircleOutline" class="title-icon" />
          {{ user.nickname }}
        </h3>

        <!-- ✅ 프로필 사진 컴포넌트 (lazy-load) -->
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
            <!-- 회원등급 + 구독하기 버튼 -->
            <tr class="editable-row">
              <td class="pf-th">
                <IonIcon :icon="icons.ribbonOutline" class="row-icon" />
                <strong class="label">{{ user.user_level }}</strong>
              </td>
              <td class="pf-td editable-text">
                <IonButton
                  size="small"
                  color="primary"
                  class="btn-inline-gray"
                  @click.stop="goMembership"
                >
                  구독하기
                </IonButton>
              </td>
            </tr>

            <!-- 닉네임 -->
            <tr
              :class="['editable-row', { disabled: !canEditFieldLocal('nickname') }]"
              tabindex="0"
              @click="canEditFieldLocal('nickname') ? openPopup(4, user.nickname) : lock('닉네임')"
              @keydown.enter="canEditFieldLocal('nickname') ? openPopup(4, user.nickname) : null"
            >
              <td class="pf-th">
                <IonIcon :icon="icons.personCircleOutline" class="row-icon" />
                <strong class="label">닉네임</strong>
              </td>
              <td class="pf-td editable-text">{{ user.nickname }}</td>
            </tr>

            <!-- 나이 -->
            <tr class="editable-row disabled" aria-disabled="true">
              <td class="pf-th">
                <IonIcon :icon="icons.calendarOutline" class="row-icon" />
                <strong class="label">나이</strong>
              </td>
              <td class="pf-td readonly editable-text">
                {{ user.birthyear || '미입력' }}
              </td>
            </tr>

            <!-- 성별 -->
            <tr class="editable-row disabled" aria-disabled="true">
              <td class="pf-th">
                <IonIcon :icon="icons.maleFemaleOutline" class="row-icon" />
                <strong class="label">성별</strong>
              </td>
              <td class="pf-td readonly editable-text">
                {{ user.gender === 'man' ? '남자' : user.gender === 'woman' ? '여자' : '미입력' }}
              </td>
            </tr>

            <!-- 전화번호: 마스킹 
            <tr class="editable-row pf-row--phone" tabindex="-1">
              <td class="pf-td2 pf-fullcell" colspan="2">
                <div class="pf-fullrow">
                  <IonIcon :icon="icons.personCircleOutline" class="row-icon" />
                  <strong class="label pf-fullrow__label">
                    {{ maskedPhone }}
                  </strong>
                  <IonButton
                    size="small"
                    color="gray"
                    class="btn-inline-gray"
                    @click.stop="onChangePhoneClick"
                  >
                    번호변경
                  </IonButton>
                </div>
              </td>
            </tr>
-->
            <!-- 지역 -->
            <tr
              :class="['editable-row', { disabled: !canEditFieldLocal('region') }]"
              tabindex="0"
              @click="canEditFieldLocal('region') ? openPopup(1, user.region1 + ' ' + user.region2) : lock('지역')"
              @keydown.enter="canEditFieldLocal('region') ? openPopup(1, user.region1 + ' ' + user.region2) : null"
            >
              <td class="pf-th">
                <IonIcon :icon="icons.locationOutline" class="row-icon" />
                <strong class="label">지역</strong>
              </td>
              <td class="pf-td editable-text">{{ user.region1 }} {{ user.region2 }}</td>
            </tr>

            <!-- 특징 -->
            <tr
              :class="['editable-row', { disabled: !canEditFieldLocal('preference') }]"
              tabindex="0"
              @click="canEditFieldLocal('preference') ? openPopup(2, user.preference) : lock('특징')"
              @keydown.enter="canEditFieldLocal('preference') ? openPopup(2, user.preference) : null"
            >
              <td class="pf-th">
                <IonIcon :icon="icons.sparklesOutline" class="row-icon" />
                <strong class="label">특징</strong>
              </td>
              <td class="pf-td editable-text">
                <span
                  v-if="preferenceRestricted && !isPremiumComputed"
                  class="pf-hint"
                  title="일반/라이트회원은 '이성친구' 계열만 선택 가능"
                ></span>
                {{ user.preference }}
              </td>
            </tr>

            <!-- 결혼 -->
            <tr
              :class="['editable-row', { disabled: !canEditFieldLocal('marriage') }]"
              tabindex="0"
              @click="canEditFieldLocal('marriage') ? openMarriageModal() : lock('결혼')"
              @keydown.enter="canEditFieldLocal('marriage') ? openMarriageModal() : null"
            >
              <td class="pf-th">
                <IonIcon :icon="icons.sparklesOutline" class="row-icon" />
                <strong class="label">결혼</strong>
              </td>
              <td class="pf-td editable-text">{{ user.marriage }}</td>
            </tr>
          </tbody>
        </table>

        <table class="info-table">
          <colgroup><col class="pf-col-th" /><col class="pf-col-td" /></colgroup>
          <tbody>
            <!-- 소개 -->
            <tr
              :class="['editable-row', { disabled: !canEditFieldLocal('selfintro') }]"
              tabindex="0"
              @click="canEditFieldLocal('selfintro') ? openPopup(3, user.selfintro || '소개 없음') : lock('소개')"
              @keydown.enter="canEditFieldLocal('selfintro') ? openPopup(3, user.selfintro || '소개 없음') : null"
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
          <colgroup><col class="pf-col-th" /><col class="pf-col-td" /></colgroup>
          <tbody>
            <!-- 검색나이 -->
            <tr
              :class="['editable-row', { disabled: !canEditFieldLocal('search_year') }]"
              tabindex="0"
              @click="canEditFieldLocal('search_year') ? openSearchYearModal() : lock('검색나이')"
              @keydown.enter="canEditFieldLocal('search_year') ? openSearchYearModal() : null"
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
              :class="['editable-row', { disabled: !canEditFieldLocal('search_regions') }]"
              tabindex="0"
              @click="canEditFieldLocal('search_regions') ? openSearchRegionModal() : lock('검색지역')"
              @keydown.enter="canEditFieldLocal('search_regions') ? openSearchRegionModal() : null"
            >
              <td class="pf-th">
                <IonIcon :icon="icons.locationOutline" class="row-icon" />
                <strong class="label">검색지역</strong>
              </td>
              <td class="pf-td editable-text">{{ searchRegionDisplay }}</td>
            </tr>

            <!-- 휴대폰 내 번호 연결 끊기 -->
            <tr class="editable-row" tabindex="0" @keydown.enter.prevent="toggleDisconnectLocalContacts">
              <td class="pf-td2 pf-fullcell" colspan="2">
                <div class="pf-fullrow">
                  <IonIcon :icon="icons.optionsOutline" class="row-icon" />
                  <strong class="label pf-fullrow__label">휴대폰 내 번호 연결 끊기</strong>
                  <button
                    type="button"
                    class="pf-switch"
                    role="switch"
                    :aria-checked="disconnectLocalContacts"
                    :class="{ 'is-on': disconnectLocalContacts }"
                    @click.stop="toggleDisconnectLocalContacts"
                  >
                    <span class="pf-switch__text pf-switch__text--left" aria-hidden="true">ON</span>
                    <span class="pf-switch__knob" />
                    <span class="pf-switch__label">{{ disconnectLocalContacts ? 'ON' : 'OFF' }}</span>
                  </button>
                </div>
              </td>
            </tr>

            <!-- 친구 신청 받지 않기 -->
            <tr class="editable-row" tabindex="0" @keydown.enter.prevent="toggleAllowFriendRequests">
              <td class="pf-td2 pf-fullcell" colspan="2">
                <div class="pf-fullrow">
                  <IonIcon :icon="icons.optionsOutline" class="row-icon" />
                  <strong class="label pf-fullrow__label">친구 신청 받지 않기</strong>
                  <button
                    type="button"
                    class="pf-switch"
                    role="switch"
                    :aria-checked="!allowFriendRequests"
                    :class="{ 'is-on': !allowFriendRequests }"
                    @click.stop="toggleAllowFriendRequests"
                  >
                    <span class="pf-switch__text pf-switch__text--left" aria-hidden="true">ON</span>
                    <span class="pf-switch__knob" />
                    <span class="pf-switch__label">{{ !allowFriendRequests ? 'ON' : 'OFF' }}</span>
                  </button>
                </div>
              </td>
            </tr>

            <!-- 알림 받지 않기 -->
            <tr class="editable-row" tabindex="0" @keydown.enter.prevent="toggleAllowNotifications">
              <td class="pf-td2 pf-fullcell" colspan="2">
                <div class="pf-fullrow">
                  <IonIcon :icon="icons.optionsOutline" class="row-icon" />
                  <strong class="label pf-fullrow__label">알림 받지 않기</strong>
                  <button
                    type="button"
                    class="pf-switch"
                    role="switch"
                    :aria-checked="!allowNotifications"
                    :class="{ 'is-on': !allowNotifications }"
                    @click.stop="toggleAllowNotifications"
                  >
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
        <h3 class="card-title">
          <IonIcon :icon="icons.optionsOutline" class="title-icon" />
          프리미엄 설정
        </h3>

        <table class="info-table">
          <colgroup><col class="pf-col-th" /><col class="pf-col-td" /></colgroup>
          <tbody>
            <!-- 검색특징 -->
            <tr
              :class="['editable-row', { disabled: !canEditFieldLocal('search_preference') }]"
              tabindex="0"
              @click="canEditFieldLocal('search_preference') ? openSearchPreferenceModal() : lock('검색특징', '라이트회원 이상 사용 가능')"
              @keydown.enter="canEditFieldLocal('search_preference') ? openSearchPreferenceModal() : null"
            >
              <td class="pf-th">
                <IonIcon :icon="icons.sparklesOutline" class="row-icon" />
                <strong class="label">검색특징</strong>
              </td>
              <td class="pf-td editable-text">
                <span v-if="!canEditFieldLocal('search_preference')" class="pf-lock">🔒</span>
                {{ user.search_preference }}
              </td>
            </tr>

            <!-- 검색결혼 -->
            <tr
              :class="['editable-row', { disabled: !canEditFieldLocal('search_marriage') }]"
              tabindex="0"
              @click="canEditFieldLocal('search_marriage') ? openSearchMarriageModal() : lock('검색결혼', '라이트회원 이상 사용 가능')"
              @keydown.enter="canEditFieldLocal('search_marriage') ? openSearchMarriageModal() : null"
            >
              <td class="pf-th">
                <IonIcon :icon="icons.sparklesOutline" class="row-icon" />
                <strong class="label">검색결혼</strong>
              </td>
              <td class="pf-td editable-text">
                <span v-if="!canEditFieldLocal('search_marriage')" class="pf-lock">🔒</span>
                {{ user.search_marriage }}
              </td>
            </tr>

            <!-- 사진 있는 사람만 -->
            <tr class="editable-row">
              <td class="pf-td2 pf-fullcell" colspan="2">
                <div class="pf-fullrow">
                  <IonIcon :icon="icons.optionsOutline" class="row-icon" />
                  <strong class="label pf-fullrow__label">사진 있는 사람만 연결하기</strong>
                  <span v-if="!canEditFieldLocal('onlyWithPhoto')" class="pf-lock-inline">🔒</span>
                  <button
                    type="button"
                    class="pf-switch"
                    :class="{ 'is-on': onlyWithPhoto, disabled: !canEditFieldLocal('onlyWithPhoto') }"
                    role="switch"
                    :aria-checked="onlyWithPhoto"
                    :aria-disabled="!canEditFieldLocal('onlyWithPhoto')"
                    @click.stop="onToggleOnlyWithPhoto"
                  >
                    <span class="pf-switch__text pf-switch__text--left" aria-hidden="true">ON</span>
                    <span class="pf-switch__knob" />
                    <span class="pf-switch__label">
                      {{ onlyWithPhoto ? 'ON' : 'OFF' }}
                    </span>
                  </button>
                </div>
              </td>
            </tr>

            <!-- Speed Matching 만 연결하기 -->
            <tr class="editable-row">
              <td class="pf-td2 pf-fullcell" colspan="2">
                <div class="pf-fullrow">
                  <IonIcon :icon="icons.optionsOutline" class="row-icon" />
                  <strong class="label pf-fullrow__label">Speed Matching 만 연결하기</strong>
                  <span v-if="!canEditFieldLocal('matchPremiumOnly')" class="pf-lock-inline">🔒</span>
                  <button
                    type="button"
                    class="pf-switch"
                    :class="{ 'is-on': matchPremiumOnly, disabled: !canEditFieldLocal('matchPremiumOnly') }"
                    role="switch"
                    :aria-checked="matchPremiumOnly"
                    :aria-disabled="!canEditFieldLocal('matchPremiumOnly')"
                    @click.stop="onToggleMatchPremiumOnly"
                  >
                    <span class="pf-switch__text pf-switch__text--left" aria-hidden="true">ON</span>
                    <span class="pf-switch__knob" />
                    <span class="pf-switch__label">
                      {{ matchPremiumOnly ? 'ON' : 'OFF' }}
                    </span>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p v-else class="loading-text">유저 정보를 불러오는 중입니다...</p>
    </div>

    <!-- 모달들 (lazy-load) -->
    <PopupModal_1 v-if="showModal1" :message="popupMessage" @close="showModal1 = false" @updated="handleRegionUpdate" />
    <PopupModal_2
      v-if="showModal2"
      :message="popupMessage"
      :level="user?.user_level || '일반회원'"
      @close="showModal2 = false"
      @updated="handlePreferenceUpdate"
    />
    <PopupModal_3 v-if="showModal3" :message="popupMessage" @close="showModal3 = false" @updated="handleIntroUpdate" />
    <PopupModal_4 v-if="showModal4" :message="popupMessage" @close="showModal4 = false" @updated="handleNicknameUpdate" />
    <ModalMarriage v-if="showMarriageModal" :message="user?.marriage || ''" @close="showMarriageModal = false" @updated="handleMarriageUpdated" />

    <Search_Year_Modal
      v-if="showSearchYear"
      :initial-from="user?.search_birthyear1 ?? ''"
      :initial-to="user?.search_birthyear2 ?? ''"
      :from="user?.search_birthyear1 ?? ''"
      :to="user?.search_birthyear2 ?? ''"
      @close="showSearchYear = false"
      @updated="onSearchYearUpdated"
    />
    <Search_Region_Modal v-if="showSearchRegion" :regions="regionsForModal" @close="showSearchRegion = false" @updated="onSearchRegionUpdated" />
    <Search_Preference_Modal v-if="showSearchPreference" :message="user?.search_preference ?? ''" @close="showSearchPreference = false" @updated="onSearchPreferenceUpdated" />
    <Search_Marriage v-if="showSearchMarriage" :message="user?.search_marriage ?? '전체'" @close="showSearchMarriage = false" @updated="handleSearchMarriageUpdated" />

    <ModalLevel
      v-if="showLevelModal"
      :current="user?.user_level || '일반회원'"
      @close="showLevelModal = false"
      @updated="handleLevelUpdated"
    />

    <PasswordChangeModal :is-open="showPasswordModal" @close="showPasswordModal = false" @updated="onPasswordUpdated" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, defineAsyncComponent } from 'vue'
import { toastController, alertController, IonIcon, IonButton } from '@ionic/vue'
import axios from '@/lib/api'
import { useRouter } from 'vue-router'
import { Capacitor } from '@capacitor/core'
import { setNotificationsOptOut } from '@/push/webPush'

/**
 * ✅ 핵심 개선
 * 1) 모달/무거운 컴포넌트 lazy-load (초기 진입 번들/파싱량 감소)
 * 2) Contacts 정적 import 제거 (연락처 기능 사용할 때만 동적 import)
 * 3) 스위치 저장 PATCH 디바운스 (연타/중복 요청 방지)
 */

/* ===== lazy-load components ===== */
const PopupModal_1 = defineAsyncComponent(() => import('@/components/04610_Page6_profile/Modal_region.vue'))
const PopupModal_2 = defineAsyncComponent(() => import('@/components/04610_Page6_profile/Modal_preference.vue'))
const PopupModal_3 = defineAsyncComponent(() => import('@/components/04610_Page6_profile/Modal_mention.vue'))
const PopupModal_4 = defineAsyncComponent(() => import('@/components/04610_Page6_profile/Modal_nickname.vue'))

const Search_Year_Modal = defineAsyncComponent(() => import('@/components/04610_Page6_profile/Search_Year_Modal.vue'))
const Search_Region_Modal = defineAsyncComponent(() => import('@/components/04610_Page6_profile/Search_Region_Modal.vue'))
const Search_Preference_Modal = defineAsyncComponent(() => import('@/components/04610_Page6_profile/Search_Preference_Modal.vue'))

const PasswordChangeModal = defineAsyncComponent(() => import('@/components/04610_Page6_profile/Modal_password_chagne.vue'))
const ProfilePhotoManager = defineAsyncComponent(() => import('@/components/04610_Page6_profile/ProfilePhotoManager.vue'))

const ModalMarriage = defineAsyncComponent(() => import('@/components/04610_Page6_profile/Modal_marriage.vue'))
const Search_Marriage = defineAsyncComponent(() => import('@/components/04610_Page6_profile/Search_Marriage.vue'))

const ModalLevel = defineAsyncComponent(() => import('@/components/04610_Page6_profile/Modal_Level.vue'))

/* ===== grade rules (가벼운 js는 그대로 static import) ===== */
import {
  RULES,
  isPremium as isPremiumLevel,
  canEditField as canEditFieldByLevel,
  isRestricted as isRestrictedByLevel,
  normalizeLevel
} from '@/components/05110_Membership/grade/gradeRule.js'

import {
  personCircleOutline, lockClosedOutline, calendarOutline, calendarNumberOutline,
  maleFemaleOutline, locationOutline, sparklesOutline, chatbubbleEllipsesOutline,
  logInOutline, timeOutline, optionsOutline, settingsOutline, ribbonOutline,
} from 'ionicons/icons'
const icons = { personCircleOutline, lockClosedOutline, calendarOutline, calendarNumberOutline, maleFemaleOutline, locationOutline, sparklesOutline, chatbubbleEllipsesOutline, logInOutline, timeOutline, optionsOutline, settingsOutline, ribbonOutline }

const router = useRouter()
const nickname = ref('')
const user = ref(null)

/* 등급/편집 규칙 */
const myLevel = computed(() => normalizeLevel(user.value?.user_level || '일반회원'))
const myGender = computed(() => (user.value?.gender === 'woman' ? 'female' : 'male'))
const isPremiumComputed = computed(() => isPremiumLevel(myLevel.value))

function canEditFieldLocal(field) {
  return canEditFieldByLevel(field, myLevel.value, myGender.value)
}
function isRestrictedLocal(field, kind) {
  return isRestrictedByLevel(field, myLevel.value, myGender.value, kind)
}

/* 모달 상태 */
const showModal1 = ref(false)
const showModal2 = ref(false)
const showModal3 = ref(false)
const showModal4 = ref(false)
const showMarriageModal = ref(false)
const showSearchMarriage = ref(false)
const popupMessage = ref('')

const showSearchYear = ref(false)
const showSearchRegion = ref(false)
const showSearchPreference = ref(false)

const showLevelModal = ref(false)
function openLevelModal(){ showLevelModal.value = true }
async function handleLevelUpdated(val){
  if (user.value) user.value.user_level = val
  const t = await toastController.create({ message: '회원등급이 변경되었습니다.', duration: 1200, color: 'success' })
  t.present()
}

function openSearchYearModal(){ showSearchYear.value = true }
function openSearchRegionModal(){ showSearchRegion.value = true }
function openSearchPreferenceModal(){ showSearchPreference.value = true }

const showPasswordModal = ref(false)
function openPasswordModal() { showPasswordModal.value = true }
async function onPasswordUpdated() {
  const t = await toastController.create({ message: '비밀번호가 변경되었습니다.', duration: 1400, color: 'success' })
  t.present()
}

async function onChangePhoneClick() {
  router.push('/home/phoneupdate')
}

/* 이동 */
function goSetting() { router.push('/home/7page') }
function goMembership() { router.push('/home/setting/0002') }

/* 사진 */
function onProfilePhotoUpdated() {}
async function onProfileMainChanged() {
  const t = await toastController.create({ message: '대표 사진이 변경되었습니다.', duration: 1200, color: 'success' })
  t.present()
}

/* 유틸 */
const toAll = (v) => (v === null || v === undefined || v === '' ? '전체' : v)
const openPopup = (n, v) => {
  popupMessage.value = v
  showModal1.value = n===1
  showModal2.value = n===2
  showModal3.value = n===3
  showModal4.value = n===4
}

function openMarriageModal() { showMarriageModal.value = true }
function openSearchMarriageModal() { showSearchMarriage.value = true }

/* 지역 모달/표시 */
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
function labelOf(it){
  const r1=(it?.region1||'').trim(), r2=(it?.region2||'').trim()
  if(!r1&&!r2) return '전체'
  if(r1==='전체'&&r2==='전체') return '전체'
  if(r2==='전체') return `${r1} 전체`
  return `${r1} ${r2}`.trim()
}
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
  } else if (payload && typeof payload === 'object') {
    arr = [{ region1: payload.region1 ?? payload.r1 ?? '', region2: payload.region2 ?? payload.r2 ?? '' }]
  } else if (typeof payload === 'string') {
    const parts = payload.split(/[,\s]+/).map(s=>s.trim()).filter(Boolean); const [r1='',r2='']=parts; arr=[{region1:r1, region2:r2}]
  }
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
  const can = canEditFieldLocal('search_preference')
  if (!can) { lock('검색특징', '일반/라이트회원은 "전체"만 사용 가능'); showSearchPreference.value = false; return }
  const preference = typeof payload === 'string' ? payload : payload?.preference ?? ''
  if (user.value) user.value.search_preference = preference
  try {
    await axios.patch('/api/search/preference', { preference }, { withCredentials: true })
    const t = await toastController.create({ message: '검색 특징이 적용되었습니다.', duration: 1500, color: 'success' }); await t.present()
  } catch (err) {
    const t = await toastController.create({ message: '저장 실패: ' + (err?.response?.data?.error || err.message), duration: 2000, color: 'danger' }); await t.present()
  } finally { showSearchPreference.value = false }
}

/* 결혼(본인) */
async function handleMarriageUpdated(value){
  if (user.value) user.value.marriage = value
  const t = await toastController.create({ message: '결혼유무가 변경되었습니다.', duration: 1300, color: 'success' })
  await t.present()
  showMarriageModal.value = false
}

/* 결혼(검색조건) */
async function handleSearchMarriageUpdated(value){
  if (!canEditFieldLocal('search_marriage')) {
    lock('검색결혼', '일반/라이트회원은 "전체"만 사용 가능')
    showSearchMarriage.value = false
    return
  }
  if (user.value) user.value.search_marriage = value
  const t = await toastController.create({ message: '검색 결혼유무가 변경되었습니다.', duration: 1300, color: 'success' })
  await t.present()
  showSearchMarriage.value = false
}

/* 기타 필드 업데이트 */
async function handleNicknameUpdate(payload){
  const v = typeof payload==='string' ? payload : payload?.nickname ?? ''
  if(user.value && v) user.value.nickname=v
  ;(await toastController.create({message:'닉네임이 변경되었습니다.',duration:1400,color:'success'})).present()
  showModal4.value=false
}
async function handleRegionUpdate(payload){
  let r1='',r2=''
  if(Array.isArray(payload)){[r1='',r2='']=payload}
  else if(payload&&typeof payload==='object'){r1=payload.region1??payload.r1??''; r2=payload.region2??payload.r2??''}
  else if(typeof payload==='string'){const p=payload.split(/[,\s]+/).map(s=>s.trim()).filter(Boolean); [r1='',r2='']=p}
  if(user.value){user.value.region1=r1; user.value.region2=r2}
  ;(await toastController.create({message:'지역이 변경되었습니다.',duration:1400,color:'success'})).present()
  showModal1.value=false
}
const preferenceRestricted = computed(() => isRestrictedLocal('preference', 'hetero-only'))
async function handlePreferenceUpdate(payload){
  let pref = typeof payload === 'string' ? payload : payload?.preference ?? ''
  if (!isPremiumComputed.value && preferenceRestricted.value) {
    if (!String(pref).startsWith('이성친구')) {
      pref = '이성친구 - 전체'
      ;(await toastController.create({
        message: '일반/라이트회원은 "이성친구"만 선택할 수 있습니다. 기본값으로 적용합니다.',
        duration: 1600,
        color: 'warning'
      })).present()
    }
  }
  if (user.value) {
    user.value.preference = pref
    if (pref.startsWith('이성친구')) {
      user.value.search_preference = '이성친구 - 전체'
    } else if (pref.startsWith('동성친구')) {
      user.value.search_preference = '동성친구 - 전체'
    }
  }
  ;(await toastController.create({ message: '성향이 변경되었습니다.', duration: 1400, color: 'success' })).present()
  showModal2.value = false
}
async function handleIntroUpdate(payload){
  const intro = typeof payload==='string' ? payload : payload?.selfintro ?? ''
  if(user.value) user.value.selfintro=intro
  ;(await toastController.create({message:'소개이 변경되었습니다.',duration:1400,color:'success'})).present()
  showModal3.value=false
}

/* 스위치들 */
const disconnectLocalContacts = ref(false)
const allowFriendRequests    = ref(false)
const allowNotifications     = ref(false)
const onlyWithPhoto          = ref(false)
const matchPremiumOnly       = ref(false)

const onOffToBool = (v) => String(v || '').toUpperCase() === 'ON'
const boolToOnOff = (b) => (b ? 'ON' : 'OFF')

/** ✅ 스위치 저장 디바운스 (연타/중복 요청 방지) */
let _saveTimer = null
function saveSwitchesDebounced(delay = 250) {
  if (_saveTimer) clearTimeout(_saveTimer)
  _saveTimer = setTimeout(async () => {
    try { await saveSwitchesToDB() }
    finally { _saveTimer = null }
  }, delay)
}

async function saveSwitchesToDB() {
  if (!user.value) return
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

/* 연락처/토글 로직 */
async function toggleDisconnectLocalContacts(){
  const platform = Capacitor.getPlatform ? Capacitor.getPlatform() : 'web'
  const nextState = !disconnectLocalContacts.value

  // ✅ 1) 웹: 연락처/폰은 건드리지 않고, 스위치 + DB만 업데이트 (디바운스 저장)
  if (platform === 'web') {
    disconnectLocalContacts.value = nextState

    try {
      // 즉시 저장 대신 디바운스
      saveSwitchesDebounced(200)

      if (nextState) {
        const msg =
          '웹에서는 휴대폰 연락처를 불러올 수 없습니다.\n' +
          '이미 앱에서 저장된 전화번호/연락처 기준으로만 필터가 적용됩니다.'
        ;(await toastController.create({
          message: msg,
          duration: 2600,
          color: 'medium'
        })).present()
      } else {
        ;(await toastController.create({
          message: '휴대폰 연락처 기반 필터가 해제되었습니다.',
          duration: 1800,
          color: 'medium'
        })).present()
      }
    } catch (err) {
      console.error('웹 스위치 저장 실패:', err)
      disconnectLocalContacts.value = !nextState
      ;(await toastController.create({
        message: '설정 저장에 실패했습니다. 잠시 후 다시 시도해 주세요.',
        duration: 2000,
        color: 'danger'
      })).present()
    }

    return
  }

  // ✅ 2) 앱(안드로이드/iOS): 연락처 해시 업로드/삭제 + 스위치/DB 동기화
  if (nextState) {
    // OFF → ON : 연락처 읽어서 해시 업로드
    const ok = await confirmDialog('휴대폰 내 번호(연락처)를 업데이트 하겠습니까?')
    if (!ok) return

    try {
      const hashes = await collectLocalContactHashes()
      await axios.post('/api/contacts/hashes', { hashes }, { withCredentials: true })
      disconnectLocalContacts.value = true

      // 업로드 성공 후 저장은 즉시(정합성 중요)
      await saveSwitchesToDB()

      ;(await toastController.create({
        message: `연락처 ${hashes.length}건이 저장되었습니다.`,
        duration: 1500,
        color: 'success'
      })).present()
    } catch (err) {
      console.error('연락처 저장 실패:', err)

      const raw =
        err?.response?.data?.error ||
        err?.message ||
        String(err || '')

      console.log('[contacts] raw error:', raw)

      let msg = '연락처 저장에 실패했습니다.'

      if (/not implemented on web/i.test(raw)) {
        msg = '이 기능은 앱(안드로이드/iOS)에서만 사용할 수 있습니다.'
      } else if (/(READ_CONTACTS|WRITE_CONTACTS)/i.test(raw)) {
        msg = '연락처 권한이 부족합니다. 앱 설정에서 연락처 권한을 허용해 주세요.'
      } else if (/연락처에서 전화번호를 찾지 못했습니다/.test(raw)) {
        msg = '연락처에서 전화번호를 찾지 못했습니다. 휴대폰에 저장된 연락처를 한번 확인해 주세요.'
      } else if (/plugin[_\s-]?not[_\s-]?installed|not implemented on (android|ios)/i.test(raw)) {
        msg = '앱에 연락처 기능이 아직 올바르게 설치되지 않았습니다. 앱을 최신 버전으로 다시 설치하거나, 개발 중이라면 npx cap sync를 확인해 주세요.'
      } else if (/subtle.*digest/i.test(raw)) {
        msg = '단말기에서 보안 해시 기능을 사용할 수 없습니다. 단말기/앱을 최신 버전으로 업데이트한 뒤 다시 시도해 주세요.'
      } else if (err?.response?.data?.error) {
        msg = err.response.data.error
      }

      ;(await toastController.create({
        message: msg,
        duration: 3000,
        color: 'danger'
      })).present()

      disconnectLocalContacts.value = false
    }
  } else {
    // ON → OFF : 서버에 저장된 연락처 해시 삭제 + 필터 해제
    const ok = await confirmDialog('저장된 전화번호를 삭제하고, 연락처 기반 필터를 해제하겠습니다.')
    if (!ok) return

    try {
      await axios.delete('/api/contacts/hashes', { withCredentials: true })
      disconnectLocalContacts.value = false
      await saveSwitchesToDB()
      ;(await toastController.create({
        message: '저장된 연락처가 삭제되었습니다.',
        duration: 1400,
        color: 'success'
      })).present()
    } catch (err) {
      console.error('연락처 삭제 실패:', err)
      ;(await toastController.create({
        message: '연락처 삭제에 실패했습니다.',
        duration: 1600,
        color: 'danger'
      })).present()
      disconnectLocalContacts.value = true
    }
  }
}

/* 다른 스위치들 (저장은 디바운스 + 사용자 체감 즉시) */
async function toggleAllowFriendRequests() {
  allowFriendRequests.value = !allowFriendRequests.value
  saveSwitchesDebounced(250)
  feedbackOK('설정이 적용되었습니다.')
}

async function toggleAllowNotifications() {
  allowNotifications.value = !allowNotifications.value
  saveSwitchesDebounced(250)
  await setNotificationsOptOut(allowNotifications.value)
  feedbackOK('설정이 적용되었습니다.')
}

async function onToggleOnlyWithPhoto(){
  if (!canEditFieldLocal('onlyWithPhoto')) {
    if (onlyWithPhoto.value) {
      onlyWithPhoto.value = false
      saveSwitchesDebounced(250)
    }
    return lock('사진 있는 사람만', '이 기능은 프리미엄회원만 사용할 수 있습니다.')
  }
  onlyWithPhoto.value = !onlyWithPhoto.value
  saveSwitchesDebounced(250)
  feedbackOK('설정이 적용되었습니다.')
}

async function onToggleMatchPremiumOnly(){
  if (!canEditFieldLocal('matchPremiumOnly')) {
    if (matchPremiumOnly.value) {
      matchPremiumOnly.value = false
      saveSwitchesDebounced(250)
    }
    return lock('Premium 만 연결하기', '이 기능은 프리미엄회원에서만 사용할 수 있습니다.')
  }
  matchPremiumOnly.value = !matchPremiumOnly.value
  saveSwitchesDebounced(250)
  feedbackOK('설정이 적용되었습니다.')
}

/* 공통 유틸 */
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

async function lock(title = '제한됨', message = '현재 등급에서 변경할 수 없습니다.') {
  const t = await toastController.create({
    message: `${title}: ${message}`,
    duration: 1500,
    color: 'medium'
  })
  t.present()
}

/* 전화번호 마스킹 */
const maskedPhone = computed(() => {
  const raw =
    user.value?.phone ||
    user.value?.phoneFormatted ||
    user.value?.phoneMasked ||
    ''
  if (!raw) return ''
  return maskPhoneToXX00(raw)
})

function normalizePhoneForDisplay(raw = '') {
  if (!raw) return ''
  const onlyDigits = String(raw).replace(/\D/g, '')
  if (!onlyDigits) return ''
  let digits = onlyDigits
  if (digits.startsWith('82')) {
    digits = '0' + digits.slice(2)
  }
  if (digits.length < 10) return digits
  return digits
}
function maskPhoneToXX00(raw = '') {
  const digits = normalizePhoneForDisplay(raw)
  if (!digits || digits.length < 7) return raw
  const head = digits.slice(0, 3)
  const midBlock = digits.slice(3, 7)
  const tailBlock = digits.slice(7)
  const midLast2  = midBlock.slice(-2)
  const tailLast2 = tailBlock.slice(-2)
  const midMasked  = `xx${midLast2}`
  const tailMasked = `xx${tailLast2}`
  return `${head} ${midMasked} ${tailMasked}`
}

/* 연락처 수집 → 정규화 → 해시 */
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

async function getLocalContactPhoneNumbers() {
  const platform = Capacitor.getPlatform ? Capacitor.getPlatform() : 'web'
  if (platform === 'web') {
    throw new Error('웹에서는 휴대폰 연락처를 읽을 수 없습니다.')
  }

  // ✅ Contacts는 "필요할 때만" 동적 import (페이지 진입 딜레이 감소)
  const { Contacts } = await import('@capacitor-community/contacts')

  // 권한 요청
  try {
    if (typeof Contacts.getPermissions === 'function') {
      const perm = await Contacts.getPermissions()
      if (!perm?.granted) {
        throw new Error('연락처 권한이 부족합니다. 앱 설정에서 연락처 권한을 허용해 주세요.')
      }
    } else if (typeof Contacts.requestPermissions === 'function') {
      await Contacts.requestPermissions()
    }
  } catch (e) {
    console.warn('[contacts] permission error:', e)
  }

  const res = await Contacts.getContacts({
    projection: {
      phones: true,
      name: false,
      organization: false,
      postalAddresses: false,
    },
  })

  const list = Array.isArray(res?.contacts) ? res.contacts : []
  const numbers = []
  for (const c of list) {
    const phones = c?.phones || c?.phoneNumbers || []
    for (const p of phones) {
      const v = typeof p === 'string' ? p : (p?.number || p?.value || '')
      if (v) numbers.push(v)
    }
  }

  if (!numbers.length) {
    throw new Error('연락처에서 전화번호를 찾지 못했습니다.')
  }
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

    disconnectLocalContacts.value = onOffToBool(user.value?.search_disconnectLocalContacts)
    allowFriendRequests.value     = !onOffToBool(user.value?.search_allowFriendRequests)
    allowNotifications.value      = !onOffToBool(user.value?.search_allowNotifications)
    onlyWithPhoto.value           = onOffToBool(user.value?.search_onlyWithPhoto)
    matchPremiumOnly.value        = onOffToBool(user.value?.search_matchPremiumOnly)

    if (!canEditFieldLocal('onlyWithPhoto'))      { onlyWithPhoto.value = false }
    if (!canEditFieldLocal('matchPremiumOnly'))   { matchPremiumOnly.value = false }
  } catch (err) {
    console.error('유저 정보 로딩 실패:', err)
  }
})

const formatDate = (s) => (!s ? '없음' : new Date(s).toLocaleString())
const logout = async () => { try { await axios.post('/api/logout', {}, { withCredentials: true }); router.push('/login') } catch (e) { console.error('로그아웃 실패:', e) } }
</script>

<style scoped>
/* (기존 스타일 그대로) */
:root{--bg:#0b0b0e;--panel:#111215;--panel-2:#15161a;--gold:#d4af37;--gold-2:#b8901e;--gold-3:#8c6f12;--text:#eaeaea;--text-dim:#bdbdbd;--text-muted:#9aa0a6;--divider:rgba(212,175,55,.18);--shadow:rgba(0,0,0,.35)}
.page-wrapper{background:radial-gradient(1200px 800px at 20% -10%, rgba(212,175,55,.08), transparent 55%), radial-gradient(900px 700px at 110% -20%, rgba(184,144,30,.06), transparent 60%), var(--bg); color:var(--text); min-height:100%}
.container{padding:2px}
.card{border:1px solid var(--divider); border-radius:12px; padding:12px; background:linear-gradient(180deg, rgba(255,255,255,.02), rgba(255,255,255,0)), var(--panel); color:var(--text); box-shadow:0 8px 24px var(--shadow); backdrop-filter:blur(2px); position:relative}
.card-title{display:flex; align-items:center; gap:8px; margin:0 0 5px 0; margin-bottom:10px; font-size:clamp(15px,4.2vw,18px); font-weight:800; color:var(--text); position:relative}
.card-title::after{content:""; height:2px; width:44px; background:linear-gradient(90deg, var(--gold), transparent); position:absolute; left:0; bottom:-6px}
.title-icon{font-size:18px; color:var(--gold)}
.pf-photo{display:flex; justify-content:center; padding:0 0 15px}
.pf-photo :deep(.avatar){max-width:130px}
.title-action-btn{position:absolute; top:10px; right:10px; display:inline-flex; align-items:center; gap:6px; padding:6px 10px; border-radius:10px; border:1px solid var(--divider); background:rgba(0,0,0,.25); color:#fff; font-weight:700; font-size:13px; cursor:pointer; transition:transform .08s ease, background .2s ease, border-color .2s ease}
.title-action-btn:hover,.title-action-btn:focus{background:rgba(212,175,55,.12); border-color:var(--gold); outline:none}
.title-action-btn:active{transform:translateY(1px)}
.action-icon{font-size:16px; color:var(--gold)}
.info-table{width:100%; border-collapse:collapse; table-layout:fixed; font-size:clamp(12px,3.6vw,14px)}
.info-table tr{border-bottom:1px dashed var(--divider); padding:6px 0}
.info-table tr:last-child{border-bottom:0}
.pf-col-th{width:42%}.pf-col-td{width:58%}
.pf-col-tha{width:42%}.pf-col-tda{width:58%}
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
.pf-fullrow__label{
  flex:1 1 auto;
  white-space:normal!important;
  overflow:visible!important;
  text-overflow:unset!important;
  color: var(--text) !important;
  font-size: clamp(12.5px, 3.6vw, 14px) !important;
  font-weight: 700;
  line-height: 1.28;
}
.pf-scope .pf-fullrow .label{
  color: var(--text) !important;
  font-size: clamp(12.5px, 3.6vw, 14px) !important;
  font-weight: 700;
  line-height: 1.28;
}
.editable-row.disabled{cursor:not-allowed}
.pf-scope .editable-row.disabled .pf-th,
.pf-scope .editable-row.disabled .pf-th .label{
  color: var(--text) !important;
  opacity: 1 !important;
  font-size: clamp(12.5px, 3.6vw, 14px) !important;
  font-weight: 700 !important;
  line-height: 1.28 !important;
}
.pf-scope .editable-row.disabled .row-icon{
  color: var(--gold) !important;
  opacity: 1 !important;
}
.pf-scope .editable-row.disabled .pf-td{
  color: var(--text-dim) !important;
}
.pf-lock{margin-left:6px; color:var(--text-muted); font-size:.9em}
.pf-hint{margin-left:8px; color:var(--text-muted); font-size:.85em}
.pf-switch.disabled{opacity:.5; cursor:not-allowed}
.pf-lock-inline{margin-left:6px; opacity:.8; font-size:.95em}
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
  font-size: 1.0rem;
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
  .pf-col-tha{width:100%; padding-top:12px; padding-bottom:0px}
  .pf-col-tda{width:100%}
  .pf-scope .pf-th,.pf-scope .pf-td{padding:6px 6px}
  .pf-scope .pf-tha,.pf-scope .pf-tda{padding:6px 6px}
  .pf-scope .row-icon{font-size:13px!important}
}
</style>
