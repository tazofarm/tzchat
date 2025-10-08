<!-- src/legalpage/LegalDocs.vue -->
<template>
  <main class="container">
    <div class="page-head">
      <h1>법적 고지 문서</h1>
      <button class="btn-back" @click="goBack">뒤로가기</button>
    </div>

    <!-- 고지 문서 섹션 -->
    <section class="section">
      <h2 class="section-title">고지 문서</h2>

      <ul class="cards" v-if="PAGE_ITEMS.length">
        <li
          v-for="item in PAGE_ITEMS"
          :key="item.slug"
          class="card"
          role="button"
          tabindex="0"
          @click="go(item.slug)"
          @keydown.enter.prevent="go(item.slug)"
          @keydown.space.prevent="go(item.slug)"
          :aria-label="`${getLabel(item.slug, getDoc(item.slug)?.title)} 열기`"
        >
          <h3 class="card-title">
            {{ getLabel(item.slug, getDoc(item.slug)?.title) }}
          </h3>

          <!-- 활성본이 있을 때만 메타 표기 -->
          <p class="meta" v-if="getDoc(item.slug)">
            버전 v{{ getDoc(item.slug)!.version }} · 고지
          </p>
        </li>
      </ul>

      <p v-else class="muted">표시할 고지 문서가 없습니다.</p>
    </section>

    <!-- 동의 문서 섹션 -->
    <section class="section">
      <h2 class="section-title">동의 문서</h2>

      <ul class="cards" v-if="CONSENT_ITEMS.length">
        <li
          v-for="item in CONSENT_ITEMS"
          :key="item.slug"
          class="card"
          role="button"
          tabindex="0"
          @click="go(item.slug)"
          @keydown.enter.prevent="go(item.slug)"
          @keydown.space.prevent="go(item.slug)"
          :aria-label="`${getLabel(item.slug, getDoc(item.slug)?.title)} 열기`"
        >
          <h3 class="card-title">
            {{ getLabel(item.slug, getDoc(item.slug)?.title) }}
          </h3>

          <!-- 활성본이 있을 때만 메타 표기 -->
          <p class="meta" v-if="getDoc(item.slug)">
            버전 v{{ getDoc(item.slug)!.version }}
            ·
            {{ getDoc(item.slug)!.defaultRequired ? '필수 동의' : '선택 동의' }}
          </p>
        </li>
      </ul>

      <p v-else class="muted">표시할 동의 문서가 없습니다.</p>
    </section>
  </main>
</template>

<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { getActiveTerms } from '@/lib/api'
import { LEGAL_ITEMS, LEGAL_MAP } from '@/legalpage/constants/legals'

type ActiveDoc = {
  slug: string
  title?: string
  version: string
  kind?: 'page' | 'consent'
  defaultRequired?: boolean
}

const router = useRouter()
const route = useRoute()

// 1) 종류별 분리 (상수 기반)
const PAGE_ITEMS = LEGAL_ITEMS.filter(i => i.kind === 'page')
const CONSENT_ITEMS = LEGAL_ITEMS.filter(i => i.kind === 'consent')

// 2) 활성본 조회
const activeList = ref<ActiveDoc[]>([])
const activeMap = computed(() => new Map(activeList.value.map(d => [d.slug, d])))

function getDoc(slug: string) {
  return activeMap.value.get(slug) as ActiveDoc | undefined
}

// 라벨 우선순위: 활성 문서 title -> 상수 label -> slug
function getLabel(slug: string, docTitle?: string) {
  return docTitle || LEGAL_MAP.get(slug)?.label || slug
}

/**
 * ✅ 상세로 이동 (name 의존 X)
 * - 외부:   /legals/v2/:slug
 * - 내부:   /home/legals/v2/:slug
 * 현재 경로로 내부/외부 컨텍스트를 판별해 안전하게 이동합니다.
 */
const isInternal = computed(() => route.fullPath.startsWith('/home/'))
function go(slug: string) {
  const base = isInternal.value ? '/home/legals/v2' : '/legals/v2'
  router.push(`${base}/${encodeURIComponent(slug)}`)
}

// 뒤로가기 (히스토리 없으면 홈으로)
function goBack() {
  const canGoBack = typeof window !== 'undefined' && window.history.length > 1
  if (canGoBack) router.back()
  else router.replace('/home/6page') // 안전한 기본 진입점
}

onMounted(async () => {
  try {
    const { data } = await getActiveTerms()
    // 응답: { ok, data: rows }, rows: { slug, title, version, kind, defaultRequired, ... }
    activeList.value = data?.data || []
  } catch {
    activeList.value = []
  }
})
</script>

<style scoped>
.container { padding: 16px; }

/* 헤더 영역 */
.page-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}
h1 { margin: 0; }

/* 뒤로가기 버튼 */
.btn-back {
  border: 1px solid rgba(255,255,255,.25);
  background: rgba(255,255,255,.9);
  color: #111;
  font-weight: 700;
  padding: 8px 12px;
  border-radius: 10px;
  cursor: pointer;
}
.btn-back:active { transform: translateY(1px); }

/* 섹션/카드 스타일 기존 유지 */
.section { margin-bottom: 28px; }
.section-title {
  font-size: 1.125rem;
  margin: 0 0 12px 0;
  font-weight: 700;
}

.cards {
  list-style: none;
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  padding: 0;
  margin: 0;
}

.card {
  border: 1px solid rgba(255,255,255,.12);
  border-radius: 14px;
  padding: 20px;
  background: rgba(255,255,255,.05);
  cursor: pointer;
  outline: none;
  transition: box-shadow .15s ease, transform .05s ease, background .15s ease;
}
.card:hover { box-shadow: 0 6px 18px rgba(0,0,0,.25); background: rgba(255,255,255,.08); }
.card:active { transform: translateY(2px); }
.card:focus { box-shadow: 0 0 0 2px rgba(255,214,10,.6) inset; }

.card-title {
  font-size: 1rem;
  margin: 0;
  font-weight: 700;
  color: #fff;
}

.meta {
  color: rgba(255,255,255,.7);
  margin: 8px 0 0;
  font-size: 0.95rem;
}

.muted { color: rgba(255,255,255,.6); }
</style>
