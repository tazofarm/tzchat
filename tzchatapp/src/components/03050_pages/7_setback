<template>
  <!-- 🔹 최상단 인사 + (관리자 페이지) + 로그아웃 -->
  <div class="top-bar">
    <!-- 왼쪽: 인사말 -->
    <div class="top-left">
      <ion-icon :icon="icons.happyOutline" class="icon-left" aria-hidden="true" />
      <span class="welcome-text">{{ nickname }}님 반갑습니다.</span>
    </div>

    <!-- 가운데: (관리자 페이지) 버튼 - master 전용 -->
    <div class="top-center">
      <ion-button
        v-if="meRole === 'master'"
        size="small"
        class="btn-outline admin-btn"
        @click="goAdmin"
      >
        <ion-icon :icon="icons.settingsOutline" slot="start" />
        관
      </ion-button>
    </div>

    <!-- 오른쪽: 로그아웃 -->
    <div class="top-right">
      <ion-button size="small" class="btn-danger" @click="logout">
        <ion-icon :icon="icons.logOutOutline" slot="start" />
        로그아웃
      </ion-button>
    </div>
  </div>

  <!-- ✅ 컴팩트 모드 래퍼: 내부의 모든 Ion 컴포넌트 크기·간격 축소 적용 -->
  <div class="settings-compact">
    <!-- 섹션이 하나라도 있으면 렌더 -->
    <template v-if="sectionsInOrder.length">
      <component
        v-for="(Comp, idx) in sectionsInOrder"
        :key="idx"
        :is="Comp"
      />
    </template>

    <!-- 안전망: 섹션이 0개면 원인 추적 메시지 노출 -->
    <div v-else class="empty-hint">
      섹션 모듈을 찾지 못했습니다. 경로/파일명을 확인해 주세요.
      <div class="hint-small">기대 경로: /src/components/04710_Page7_setting/section/*.vue</div>
    </div>
  </div>
</template>

<script setup lang="ts">
/* ------------------------------------------------------
   SettingsSections.vue (auto import & order by filename)
   - 구조/기능 유지, UI를 블랙+골드 테마 변수로 정비
   - 로그/주석 강화 (운영 디버깅 용이)
   ------------------------------------------------------ */
import type { Component } from 'vue'
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import axios from '@/lib/axiosInstance'

import { IonButton, IonIcon } from '@ionic/vue'
import {
  happyOutline,
  settingsOutline,
  logOutOutline
} from 'ionicons/icons'

/* 공통 CSS (섹션 카드/아이템 컴팩트 스타일) - 기존 유지 */
import '@/components/04710_Page7_setting/styles/setting-section.css'

/* (유지) 섹션 자동 로드 */
const modules = import.meta.glob(
  '/src/components/04710_Page7_setting/section/*.vue',
  { eager: true }
) as Record<string, { default: Component }>

console.group('[SettingsSections] auto-load sections')
Object.keys(modules).sort().forEach((k) => console.log(' - found:', k))
console.groupEnd()

const sectionsInOrder: Component[] = Object
  .entries(modules)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([key, mod]) => {
    const comp = mod?.default
    if (!comp) console.warn('[SettingsSections] missing default export:', key)
    else console.log('[SettingsSections] register component:', key)
    return comp
  })
  .filter(Boolean) as Component[]

console.info('[SettingsSections] total sections:', sectionsInOrder.length)

/* 상단 인사/관리자/로그아웃 바 */
const router = useRouter()
const nickname = ref<string>('')
const meRole = ref<string>('')

const icons = { happyOutline, settingsOutline, logOutOutline }

onMounted(async () => {
  try {
    console.time('[SettingsSections] /api/me fetch')
    const meRes = await axios.get('/api/me', { withCredentials: true })
    console.timeEnd('[SettingsSections] /api/me fetch')

    nickname.value = meRes.data?.user?.nickname || ''
    meRole.value = meRes.data?.user?.role || ''
    console.log('[SettingsSections] me:', { nickname: nickname.value, role: meRole.value })
  } catch (err) {
    console.error('❌ [SettingsSections] /api/me 실패:', err)
  }
})

const goAdmin = () => {
  console.log('[SettingsSections] goAdmin → /home/admin')
  router.push('/home/admin')
}

const logout = async () => {
  try {
    console.time('[SettingsSections] /api/logout')
    await axios.post('/api/logout', {}, { withCredentials: true })
    console.timeEnd('[SettingsSections] /api/logout')
    console.info('[SettingsSections] 로그아웃 성공 → /login')
    router.push('/login')
  } catch (err) {
    console.error('❌ [SettingsSections] 로그아웃 실패:', err)
  }
}
</script>

<style scoped>
/* =========================================================
   GOLD THEME 대응
   - 라이트 하드코딩 제거(#fff/#000 등) → 테마 토큰으로 변경
   - 상단 바/리스트/아이템/라벨/설명 전부 다크 톤으로 일치
   ========================================================= */

/* 전역 텍스트 톤: 상위에서 상속, 필요시만 지정 */
:host, .settings-compact, .top-bar, .empty-hint {
  color: var(--text);
}

/* ─────────────────────────────────────────────────────
   상단 헤더 바
   - 다크 배경: panel-2
   - 하단 라인: panel-border
   - 텍스트/아이콘: 밝은 톤
────────────────────────────────────────────────────── */
.top-bar {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background-color: var(--panel-2);
  border-bottom: 1px solid var(--panel-border);
}

.top-left { justify-self: start; display: flex; align-items: center; }
.top-center { justify-self: center; display: flex; align-items: center; }
.top-right { justify-self: end; display: flex; align-items: center; }

.icon-left {
  font-size: 18px;
  color: var(--text-dim);
  margin-right: 6px;
}

.welcome-text {
  font-weight: 600;
  font-size: 15px;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.8;
}

/* 버튼 공통(크기/라운드) */
.top-bar ion-button {
  --border-radius: 10px;
  --padding-start: 10px;
  --padding-end: 10px;
  min-height: 28px;
  font-size: 14px;
  font-weight: 600;
}

/* 관리자 버튼(아웃라인은 테마 클래스 사용) */
.admin-btn {
  /* btn-outline에서 이미 색/테두리 골드 지정 */
}

/* ─────────────────────────────────────────────────────
   ✅ 컴팩트 모드: 설정 섹션 전반의 톤/간격
────────────────────────────────────────────────────── */
.settings-compact {
  padding: 8px 0 16px;
}

/* 리스트(카드) 톤: 패널 배경 + 보더 */
.settings-compact ion-list[inset] {
  --ion-item-background: var(--panel);
  background: var(--panel);
  color: var(--text);
  margin: 8px 0;
  border-radius: 10px;
  border: 1px solid var(--panel-border);
  box-shadow: 0 1px 2px rgba(0,0,0,0.15); /* 다크 톤에 맞게 살짝만 */
}

/* 리스트 헤더(섹션 타이틀) */
.settings-compact ion-list-header {
  min-height: 36px;
  padding: 6px 10px 4px 12px;
  border-bottom: 1px solid var(--panel-border);
}
.settings-compact ion-list-header ion-label {
  font-size: 15px;
  font-weight: 700;
  letter-spacing: -0.2px;
  color: var(--text);
}

/* 각 행(ion-item) */
.settings-compact ion-item {
  --background: var(--panel);
  --color: var(--text);
  --inner-border-width: 0 0 1px 0;
  --inner-border-color: var(--panel-border);
  --min-height: 38px;
  --padding-start: 10px;
  --inner-padding-end: 10px;
  --inner-padding-top: 6px;
  --inner-padding-bottom: 6px;
  --detail-icon-opacity: 0.5;
  --detail-icon-font-size: 16px;
}

/* 행 텍스트 톤 */
.settings-compact ion-item::part(native) {
  font-size: 14px;
  color: var(--text);
}

/* 라벨 직접 사용 대비 */
.settings-compact ion-label {
  font-size: 14px;
  line-height: 1.35;
  color: var(--text);
}

/* 설명(보조 텍스트) */
.settings-compact .desc {
  font-size: 12px;
  color: var(--text-dim);
}

/* 토글 크기/여백 축소 */
.settings-compact ion-toggle {
  --handle-height: 16px;
  --handle-width: 16px;
  --track-height: 18px;
  --track-width: 36px;
  margin-right: 2px;
}

/* Range 슬라이더 */
.settings-compact ion-range {
  --bar-height: 4px;
  --knob-size: 16px;
  padding-top: 4px;
  padding-bottom: 2px;
  min-height: 34px;
}

/* (준비) 배지 등 소형 텍스트 공통 */
.settings-compact .badge,
.settings-compact .chip,
.settings-compact .status-pill {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 10px;
}

/* 빈 힌트 */
.empty-hint {
  padding: 12px;
  font-size: 14px;
  opacity: 0.9;
  color: var(--text);
}
.hint-small {
  margin-top: 6px;
  font-size: 12px;
  color: var(--text-dim);
}

/* 초소형 화면 보정 */
@media (max-width: 360px) {
  .top-bar { padding: 6px 10px; gap: 8px; }
  .settings-compact ion-item {
    --padding-start: 8px;
    --inner-padding-end: 8px;
  }
}
</style>
