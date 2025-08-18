<template>
  <!-- ⚫️ 다크 배경 + 다크 카드(블랙+골드) -->
  <div class="settings-wrapper">
    <ion-list inset class="settings-section">
      <!-- 섹션 헤더 (접기/펼치기 토글) -->
      <ion-list-header
        class="settings-header toggleable"
        role="button"
        tabindex="0"
        :aria-expanded="!collapsed"
        aria-controls="settings-panel"
        @click="toggleSection()"
        @keydown="onHeaderKeydown"
      >
        <ion-icon
          :icon="collapsed ? icons.chevronForwardOutline : icons.chevronDownOutline"
          class="chevron-icon"
          aria-hidden="true"
        />
        <ion-label class="header-label">계정</ion-label>
      </ion-list-header>

      <!-- 접힘 패널: 기본 접힘, v-show로 전환(애니메이션 포함) -->
      <div
        id="settings-panel"
        class="collapse-wrapper"
        :class="{ collapsed }"
        :aria-hidden="collapsed ? 'true' : 'false'"
      >
        <!-- 비밀번호 변경 -->
        <ion-item
          button
          detail
          @click="openPasswordModal"
          class="settings-item"
          aria-label="비밀번호 변경"
        >
          <ion-icon :icon="icons.keyOutline" slot="start" class="settings-icon" />
          <ion-label class="settings-label">비밀번호 변경</ion-label>
        </ion-item>

        <!-- 친구 신청 허용 (두 줄) -->
        <ion-item class="settings-item" lines="none" aria-label="친구 신청 허용">
          <ion-icon :icon="icons.personAddOutline" slot="start" class="settings-icon" />

          <ion-label class="settings-label">
            <!-- 1줄: 제목 + 스위치 -->
            <div class="row-top">
              <span class="title">친구 신청 허용</span>
              <ion-toggle
                slot="end"
                :checked="allowFriendRequest"
                @ionChange="onToggleFriendRequest($event)"
                aria-label="친구 신청 허용 스위치"
              />
            </div>

            <!-- 2줄: 설명 -->
            <div class="row-desc">
              다른 사용자가 나에게 친구 신청을 보낼 수 있도록 허용
            </div>
          </ion-label>
        </ion-item>
      </div>
    </ion-list>
  </div>

  <!-- 비밀번호 변경 모달 -->
  <PasswordChangeModal :is-open="isPasswordOpen" @close="closePasswordModal" />

  <!-- 스위치 안내 팝업 -->
  <ion-alert
    :is-open="isOnAlertOpen"
    header="알림"
    message="검색에 포함 됩니다."
    :buttons="['확인']"
    @didDismiss="isOnAlertOpen = false"
  />
  <ion-alert
    :is-open="isOffAlertOpen"
    header="알림"
    message="검색에서 제외 됩니다."
    :buttons="['확인']"
    @didDismiss="isOffAlertOpen = false"
  />
</template>

<script setup lang="ts">
/**
 * ✅ 변경 핵심
 * - 섹션 헤더를 클릭/키보드로 토글(접기/펼치기). 기본값: 접힘(true)
 * - 헤더 아이콘(▶ / ▼)으로 상태 표시, aria-expanded/aria-controls로 접근성 준수
 * - 리스트/아이템 다크(블랙)+골드 테마 유지
 * - 기존 로직/스토리지/구조 100% 유지 + 로그 강화
 */
import { ref, onMounted } from 'vue'
import {
  IonList, IonListHeader, IonLabel, IonItem, IonIcon,
  IonToggle, IonAlert
} from '@ionic/vue'
import {
  keyOutline, personAddOutline,
  chevronForwardOutline, chevronDownOutline
} from 'ionicons/icons'
import PasswordChangeModal from '../section_modals/00200_PasswordChangeModal.vue'

const icons = { keyOutline, personAddOutline, chevronForwardOutline, chevronDownOutline }
const LS_KEY_ALLOW_FRIEND_REQUEST = 'tzchat_allowFriendRequest' as const

// ▶ 기본 접힘
const collapsed = ref(true)
function toggleSection () {
  collapsed.value = !collapsed.value
  console.log('[Settings] 섹션 토글 →', collapsed.value ? '접힘' : '펼침')
}
function onHeaderKeydown (e: KeyboardEvent) {
  // Enter / Space 지원
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    toggleSection()
  }
}

// 비밀번호 변경 모달
const isPasswordOpen = ref(false)
const openPasswordModal = () => {
  console.log('[Settings] PasswordChangeModal open')
  isPasswordOpen.value = true
}
const closePasswordModal = () => {
  console.log('[Settings] PasswordChangeModal close')
  isPasswordOpen.value = false
}

// 친구 신청 허용 스위치 + 알림
const allowFriendRequest = ref(true)
const isOnAlertOpen  = ref(false)
const isOffAlertOpen = ref(false)

onMounted(() => {
  try {
    const raw = localStorage.getItem(LS_KEY_ALLOW_FRIEND_REQUEST)
    if (raw === null) {
      localStorage.setItem(LS_KEY_ALLOW_FRIEND_REQUEST, JSON.stringify(true))
      allowFriendRequest.value = true
      console.info('[Settings] allowFriendRequest 초기값 없음 → true 저장')
    } else {
      allowFriendRequest.value = JSON.parse(raw)
      console.info('[Settings] allowFriendRequest 로드:', allowFriendRequest.value)
    }
  } catch (err) {
    console.error('[Settings] allowFriendRequest 로드 에러:', err)
    allowFriendRequest.value = true
    localStorage.setItem(LS_KEY_ALLOW_FRIEND_REQUEST, JSON.stringify(true))
  }
})

function onToggleFriendRequest (ev: CustomEvent) {
  const nextVal = Boolean((ev as any).detail?.checked)
  console.log('[Settings] 친구신청허용 토글:', nextVal)
  allowFriendRequest.value = nextVal

  try {
    localStorage.setItem(LS_KEY_ALLOW_FRIEND_REQUEST, JSON.stringify(nextVal))
    console.info('[Settings] allowFriendRequest 저장 완료:', nextVal)
  } catch (err) {
    console.error('[Settings] allowFriendRequest 저장 실패:', err)
  }

  if (nextVal) {
    isOnAlertOpen.value = true
    console.log('[Settings] ON 알림 표시')
  } else {
    isOffAlertOpen.value = true
    console.log('[Settings] OFF 알림 표시')
  }
}
</script>

<style scoped>
/* ================================
   🎨 Dark Gold Theme Tokens
==================================*/
:root,
:host {
  --tg-bg-black: #0B0B0C;            /* 페이지 배경 */
  --tg-surface: #141416;             /* 카드/아이템 배경 */
  --tg-surface-2: #1B1C1E;           /* 호버/프레싱 배경 */
  --tg-text-strong: #F2F2F2;         /* 헤더/강조 텍스트 */
  --tg-text: #E6E6E6;                /* 본문 텍스트 */
  --tg-text-sub: #B3B3B3;            /* 보조 텍스트 */
  --tg-gold: #E6C45A;                /* 포인트 골드 */
  --tg-gold-strong: #D9B33F;         /* 포커스/호버 골드 */
  --tg-sep: #2A2A2A;                 /* 구분선 */
  --tg-shadow: rgba(0,0,0,0.45);     /* 카드 그림자 */
}

/* ⚫️ 전체 배경 */
.settings-wrapper {
  background: var(--tg-bg-black);
  padding: 12px 10px 20px;
  min-height: 100%;
  box-sizing: border-box;
}

/* 🧩 inset 리스트의 배경 강제 덮기 */
.settings-section {
  --ion-background-color: var(--tg-surface);
  --ion-item-background: var(--tg-surface);
  --background: var(--tg-surface);
  background: var(--tg-surface) !important;

  color: var(--tg-text);
  border-radius: 16px;
  box-shadow: 0 8px 18px var(--tg-shadow);
  overflow: hidden;
  border: 1px solid rgba(230,196,90,0.18);
}

/* ── 헤더: 토글 가능한 버튼 스타일 */
.settings-header {
  --background: var(--tg-surface);
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--tg-sep);
  position: relative;
  user-select: none;
  cursor: pointer;
  outline: none;
}
.settings-header:focus-visible {
  box-shadow: inset 0 0 0 2px rgba(230,196,90,0.28);
  border-radius: 8px;
}
.settings-header::after {
  content: '';
  position: absolute;
  left: 0; right: 0; bottom: 0;
  height: 2px;
  background: linear-gradient(90deg, transparent 0%, var(--tg-gold) 20%, var(--tg-gold) 80%, transparent 100%);
}
.header-label {
  font-weight: 800;
  color: var(--tg-text-strong);
  letter-spacing: 0.2px;
  color: #d4af37;
}
/* ▶ / ▼ 아이콘 */
.chevron-icon {
  font-size: 18px;
  color: var(--tg-gold);
}

/* ── 접힘 패널 애니메이션 (height transition) */
.collapse-wrapper {
  overflow: hidden;
  transition: grid-template-rows 240ms ease, opacity 220ms ease;
  display: grid;
  grid-template-rows: 1fr;
  opacity: 1;
}
.collapse-wrapper.collapsed {
  grid-template-rows: 0fr;
  opacity: 0;
}
.collapse-wrapper > * {
  min-height: 0; /* grid transition 시 내용 잘림 방지 */
}

/* 아이템(행) */
.settings-item {
  --background: var(--tg-surface);
  --color: var(--tg-text);
  --min-height: 0px;
  padding: 12px 12px;
  border-bottom: 1px solid var(--tg-sep);
  transition: background 0.15s ease;
}
.settings-item:last-of-type { border-bottom: none; }

/* 행 인터랙션 */
.settings-item[button]:active,
.settings-item:hover {
  background: var(--tg-surface-2);
}

/* 아이콘: 골드 */
.settings-icon {
  font-size: 20px;
  color: var(--tg-gold);
  margin-right: 6px;
  
}

/* 라벨(본문) */
.settings-label { color: var(--tg-text); }

/* 1행: 제목 + 토글 */
.row-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  font-size: 14px;
  font-weight: 700;
  color: var(--tg-text);
}
.row-top .title { line-height: 1.2; }

/* 2행: 설명 */
.row-desc {
  font-size: 11.5px;
  color: var(--tg-text-sub);
  margin-top: 4px;
}

/* ── Toggle(토글) 다크+골드 커스텀 */
ion-toggle::part(track) {
  background: #2a2a2a;
  border: 1px solid rgba(230,196,90,0.35);
  transition: border-color 0.2s ease, background 0.2s ease;
}
ion-toggle::part(handle) { background: #CFCFCF; }
ion-toggle[aria-checked="true"]::part(track),
ion-toggle.toggle-checked::part(track) {
  background: rgba(230,196,90,0.35);
  border-color: var(--tg-gold-strong);
}
ion-toggle[aria-checked="true"]::part(handle),
ion-toggle.toggle-checked::part(handle) { background: var(--tg-gold); }
ion-toggle:focus-visible::part(track) {
  box-shadow: 0 0 0 2px rgba(230,196,90,0.28);
  border-color: var(--tg-gold-strong);
}

/* iOS 보강 */
:global(.ios) .settings-section { background: var(--tg-surface) !important; }

/* 작은 화면 여백 */
@media (max-width: 420px) {
  .settings-wrapper { padding: 10px 8px 16px; }
  .settings-item { padding: 12px 10px; }
}
</style>
