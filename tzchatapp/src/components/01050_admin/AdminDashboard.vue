<template>
  <!-- 🔹 최상단 인사 + (현재 페이지 표시) + 로그아웃 -->
  <div class="top-bar" role="banner" aria-label="관리자 상단바">
    <!-- 왼쪽: 인사말 -->
    <div class="top-left">
      <ion-icon :icon="icons.personCircleOutline" aria-hidden="true" class="top-icon" />
      <span class="welcome-text" :title="nickname + '님 반갑습니다.'">
        {{ nickname }}님 반갑습니다.
      </span>
    </div>

    <!-- 가운데: 현재 위치 표시 -->
    <div class="top-center" aria-label="현재 페이지">
      <span class="page-tag">
        <ion-icon :icon="icons.shieldCheckmarkOutline" aria-hidden="true" class="tag-icon" />
        관리자 페이지
      </span>
    </div>

    <!-- 오른쪽: 로그아웃 -->
    <div class="top-right">
      <button class="logout-btn" @click="logout" aria-label="로그아웃">
        <ion-icon :icon="icons.powerOutline" aria-hidden="true" class="logout-icon" />
        로그아웃
      </button>
    </div>
  </div>

  <!-- 섹션이 하나라도 있으면 렌더 -->
  <!-- 00100_HeartbeatCard, 00300_UserSearchBar, 00400_UserTable, 00500_UserActionsPanel 이벤트/props 호환 -->
  <!-- 00200_ServerStatusCard, 00400_UserTable, 00500_UserActionsPanel, 00600_LogViewer props 호환 -->
  <template v-if="sectionsInOrder.length">
    <component
      v-for="(Comp, idx) in sectionsInOrder"
      :key="idx"
      :is="Comp"
      @latency="onLatency"         
      @search="onSearch"          
      @selected="onSelected"      
      @acted="onActed"             
      :last-latency="lastLatency"  
      :filters="userFilters"       
      :selected-user="selectedUser"
      :logs="clientLogs"           
    />
  </template>

  <!-- 안전망: 섹션이 0개면 원인 추적 메시지 노출 -->
  <div v-else class="empty-hint" role="note">
    섹션 모듈을 찾지 못했습니다. 경로/파일명을 확인해 주세요.
    <div class="hint-small">기대 경로: /src/components/04910_Page9_Admin/*.vue (예: 00100_HeartbeatCard.vue)</div>
  </div>
</template>

<script setup lang="ts">
// ------------------------------------------------------
// AdminDashboard.vue (auto import & order by filename)
// - 절대경로 glob, 파일명 사전순으로 섹션 렌더 순서 고정
// - 상단바 UI 정리(아이콘 추가, 간격 컴팩트)
// - 이벤트/props를 부모에서 중계
// ------------------------------------------------------
import type { Component } from 'vue'
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'

import { IonIcon } from '@ionic/vue'
import {
  personCircleOutline,
  shieldCheckmarkOutline,
  powerOutline
} from 'ionicons/icons'

// 아이콘 바인딩(템플릿에서 접근 편의)
const icons = {
  personCircleOutline,
  shieldCheckmarkOutline,
  powerOutline,
}

// ✅ 절대경로 glob (eager: true → 즉시 import)
const modules = import.meta.glob(
  '/src/components/04910_Page9_Admin/*.vue',
  { eager: true }
) as Record<string, { default: Component }>

// 🔎 로드된 모듈 로그
console.group('[AdminDashboard] auto-load sections')
Object.keys(modules).sort().forEach((k) => console.log(' - found:', k))
console.groupEnd()

// ✅ 사전순 정렬 후 default export만 추출
const sectionsInOrder: Component[] = Object
  .entries(modules)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([key, mod]) => {
    const comp = mod?.default
    if (!comp) console.warn('[AdminDashboard] missing default export:', key)
    else console.log('[AdminDashboard] register component:', key)
    return comp
  })
  .filter(Boolean) as Component[]

// 📌 개수 로그
console.info('[AdminDashboard] total sections:', sectionsInOrder.length)

// ============================
// 상단 인사/로그아웃 바 관련
// ============================
const router = useRouter()
const nickname = ref<string>('')
const meRole = ref<string>('') // (확장 대비)

onMounted(async () => {
  try {
    console.time('[AdminDashboard] GET /api/me')
    const r = await fetch('/api/me', { credentials: 'include' })
    console.timeEnd('[AdminDashboard] GET /api/me')
    if (!r.ok) {
      console.warn('[AdminDashboard] /api/me not ok', r.status)
      return
    }
    const data = await r.json()
    nickname.value = data?.user?.nickname || ''
    meRole.value = data?.user?.role || ''
    console.log('[AdminDashboard] me:', { nickname: nickname.value, role: meRole.value })
  } catch (err) {
    console.error('❌ [AdminDashboard] /api/me 실패:', err)
  }
})

// 로그아웃
const logout = async () => {
  try {
    console.time('[AdminDashboard] POST /api/logout')
    const r = await fetch('/api/logout', { method: 'POST', credentials: 'include' })
    console.timeEnd('[AdminDashboard] POST /api/logout')
    if (!r.ok) {
      console.warn('[AdminDashboard] logout not ok', r.status)
      return
    }
    console.info('[AdminDashboard] 로그아웃 성공 → /login 이동')
    router.push('/login')
  } catch (err) {
    console.error('❌ [AdminDashboard] 로그아웃 실패:', err)
  }
}

// ============================
// 섹션 간 상태 중계
// ============================
const lastLatency = ref<number|null>(null)
const userFilters = ref<{ q: string }>({ q: '' })
const selectedUser = ref<any>(null)
const clientLogs = ref<{ at: string; level: string; msg: string }[]>([])

function pushLog(level: 'INFO'|'WARN'|'ERROR', msg: string) {
  clientLogs.value.unshift({ at: new Date().toISOString(), level, msg })
  if (clientLogs.value.length > 200) clientLogs.value.pop()
}

function onLatency(ms: number) {
  lastLatency.value = ms
  pushLog('INFO', `[DASH] heartbeat latency: ${ms}ms`)
  console.log('[AdminDashboard] onLatency', ms)
}

function onSearch(filters: { q: string }) {
  userFilters.value = { ...filters }
  pushLog('INFO', `[DASH] search filters: ${JSON.stringify(filters)}`)
  console.log('[AdminDashboard] onSearch', filters)
}

function onSelected(user: any) {
  selectedUser.value = user
  pushLog('INFO', `[DASH] selected user: ${user?.username || '(none)'}`)
  console.log('[AdminDashboard] onSelected', user)
}

function onActed(payload: any) {
  pushLog('INFO', `[DASH] action: ${JSON.stringify(payload)}`)
  console.log('[AdminDashboard] onActed', payload)
}
</script>

<style scoped>
/* ── AdminDashboard.vue: 상단바 깔끔 정리 ──
   - 전체 글자색 검정(#000) 유지(가독성)
   - 3분할 레이아웃: 좌(인사) / 중(페이지 태그) / 우(로그아웃)
   - 아이콘은 텍스트 옆에 소형으로 배치, 간격 최소화
*/

/* 스크롤바 유무로 인한 가로폭 흔들림 방지(선택) */
:global(html, body) { scrollbar-gutter: stable both-edges; }

/* 상단 헤더 바 */
.top-bar {
  display: grid;
  grid-template-columns: 1fr auto 1fr;  /* 좌 | 중앙 | 우 */
  align-items: center;
  gap: 10px;

  height: 50px;                         /* 고정 높이 */
  padding: 0 12px;
  background-color: #f6f6f6;
  border-bottom: 1px solid #e5e5e5;
  color: #000;
}

/* 그리드 내 정렬 */
.top-left { justify-self: start; display: inline-flex; align-items: center; gap: 8px; }
.top-center { justify-self: center; }
.top-right { justify-self: end; }

/* 왼쪽 아이콘 + 인사말 */
.top-icon { font-size: 18px; color: #111; }
.welcome-text {
  font-weight: 700;
  font-size: clamp(15px, 2.6vw, 16px);
  color: #000;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 현재 페이지 태그(배지) */
.page-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  border: 1px solid #333;
  border-radius: 999px;
  background: #fff;
  color: #000;
  font-size: clamp(12px, 2.2vw, 13px);
  line-height: 1;
  white-space: nowrap;
}
.tag-icon { font-size: 14px; color: #111; }

/* 로그아웃 버튼 */
.logout-btn {
  appearance: none;
  background: #e11d48;                   /* danger 톤 */
  color: #fff;
  border: none;
  border-radius: 12px;
  min-height: 40px;                      /* 터치 타깃 */
  padding: 0 12px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  transition: background .15s, transform .08s ease-out, opacity .2s;
}
.logout-icon { font-size: 16px; }
.logout-btn:hover { background: #be123c; }
.logout-btn:active { transform: translateY(1px); }
.logout-btn:disabled { opacity: .6; cursor: not-allowed; }
.logout-btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(225,17,72,.35);
}

/* 섹션 비어있을 때 힌트 */
.empty-hint {
  color: #000;
  padding: 16px;
  font-size: clamp(14px, 2.4vw, 15px);
  opacity: .9;
}
.hint-small {
  margin-top: 6px;
  font-size: 12px;
  color: #444;
}

/* 초소형 화면 보정 */
@media (max-width: 360px) {
  .top-bar { padding: 0 10px; gap: 8px; }
  .page-tag { padding: 4px 8px; }
}
</style>
