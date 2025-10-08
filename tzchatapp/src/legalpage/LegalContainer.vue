<!-- src/legalpage/LegalContainer.vue -->
<template>
  <!-- ⚠ 스크롤 안전 래퍼 -->
  <div class="fix-scroll">
    <main class="container">
      <!-- 상단 헤더 -->
      <div class="page-head">
        <h1>{{ displayTitle }}</h1>
        <div class="head-actions">
          <button v-if="isMaster" class="btn-back" @click="goUpdate">업데이트</button>
          <button class="btn-back" @click="goBack">뒤로가기</button>
        </div>
      </div>

      <!-- 1) 로딩 -->
      <section v-if="state.loading" class="section">
        <p class="muted">문서를 불러오는 중…</p>
      </section>

      <!-- 2) 에러 -->
      <section v-else-if="state.error" class="section">
        <h2>문서를 불러올 수 없습니다</h2>
        <p class="muted">{{ state.error }}</p>
      </section>

      <!-- 3) 정상 -->
      <section v-else class="section">
        <!-- 최신본 메타 -->
        <h2 class="section-title">
          {{ current?.title || getLabel(slug) }}
          <small v-if="current?.version"> (v{{ current.version }})</small>
          <small v-if="currentDate"> · {{ currentDate }}</small>
        </h2>

        <!-- 본문 -->
        <div v-if="current?.body" class="doc-wrapper">
          <article class="doc-body" v-html="current.body"></article>
        </div>
        <p v-else class="muted">본문이 비어 있습니다.</p>

        <!-- (선택) 동의 버튼: 로그인 상태에서만 노출 -->
        <div v-if="isConsent && isAuthed" class="consent-actions">
          <button
            class="btn-primary"
            :disabled="isAgreed || agreeing"
            @click="onAgreeClick"
          >
            {{ isAgreed ? '동의 완료' : (agreeing ? '처리 중…' : '이 문서에 동의합니다') }}
          </button>

          <button
            v-if="isOptional && isAgreed"
            class="btn-outline"
            :disabled="revoking"
            @click="onRevokeClick"
          >
            {{ revoking ? '처리 중…' : '동의 취소' }}
          </button>
        </div>

        <!-- 이전 버전 (기본: 접힘) -->
        <div class="section" style="margin-top:20px">
          <h3 class="section-title">이전 버전</h3>

          <ul v-if="older.length" class="list">
            <li
              v-for="(item, idx) in older"
              :key="`ver-${item.version}-${idx}`"
              class="list-item"
            >
              <!-- 제목 행: 클릭하면 토글 -->
              <button
                class="row acc-head"
                :aria-expanded="openIdx === idx"
                @click="toggleOlder(idx)"
              >
                <strong class="acc-title">{{ item.title || getLabel(slug) }}</strong>
                <span class="meta">v{{ item.version }} · {{ formatDate(item.publishedAt) || '날짜없음' }}</span>
                <span class="chev" :class="{ open: openIdx === idx }">▾</span>
              </button>

              <!-- 본문: 선택된 항목만 보임 -->
              <div v-show="openIdx === idx" class="doc-wrapper acc-panel">
                <article class="doc-body" v-html="item.body"></article>
              </div>
            </li>
          </ul>

          <p v-else class="muted">이전 버전이 없습니다.</p>
        </div>
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, reactive, watch, computed, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
// ✅ axios 인스턴스는 제거하고, 공개 문서 API만 유지
import { getActiveTermBySlug, getTermVersions } from '@/lib/api'
import { getLabel } from '@/legalpage/constants/legals'

type Doc = {
  slug: string
  title: string
  body: string
  version: string
  kind?: 'page' | 'consent'
  defaultRequired?: boolean
  publishedAt?: string | null
}

const props = defineProps<{ slug?: string }>()
const route = useRoute()
const router = useRouter()

const slug = computed(() => {
  const fromProps = (props.slug ?? '').toString().trim()
  const fromRoute = (route.params.slug ?? '').toString().trim()
  const val = fromProps || fromRoute
  try { return decodeURIComponent(val) } catch { return val }
})

const state = reactive({ loading: true, error: '' as string })
const current = ref<Doc | null>(null)
const historyList = ref<Doc[]>([])
const older = computed(() => {
  const v0 = current.value?.version
  return (historyList.value || []).filter(d => d.version !== v0)
})
const isMaster = ref(false)
const isAuthed = ref(false)              // ✅ 로그인 여부 (fetch로만 판별)
const openIdx = ref<number | null>(null) // ✅ 기본 접힘

const displayTitle = computed(() => current.value?.title || getLabel(slug.value))

const formatDate = (iso?: string | null) => {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
const currentDate = computed(() => formatDate(current.value?.publishedAt || null))

const listPath = computed(() => {
  const p = (route.path || '/').replace(/\/+$/, '')
  const i = p.lastIndexOf('/')
  return i > 0 ? p.slice(0, i) : '/'
})

const goBack = () => {
  const canGoBack = typeof window !== 'undefined' && window.history.length > 1
  if (canGoBack) router.back()
  else router.replace(listPath.value)
}
const goUpdate = () => {
  const inHome = route.path.startsWith('/home')
  const base = inHome ? '/home/admin/terms' : '/admin/terms'
  router.push({ path: `${base}/${slug.value}`, query: { title: displayTitle.value || '' } })
}

function extractDoc(row: any): Doc | null {
  if (!row || typeof row !== 'object') return null
  const body =
    row.body ?? row.content ?? row.html ?? row.contentHtml ?? ''
  return {
    slug: String(row.slug || ''),
    title: String(row.title || getLabel(slug.value)),
    body: String(body || ''),
    version: String(row.version || ''),
    kind: row.kind as any,
    defaultRequired: Boolean(row.defaultRequired),
    publishedAt: row.publishedAt ?? row.createdAt ?? null,
  }
}
function compareVersionDesc(a: string, b: string) {
  if (a === b) return 0
  return a < b ? 1 : -1
}

/* 동의 상태 */
const agreeInfo = reactive({ hasRecord:false, sameVersion:false, optedIn: null as null|boolean })
const isConsent = computed(() => !!(current.value && (current.value.kind === 'consent' || current.value.defaultRequired)))
const isOptional = computed(() => !!(current.value && current.value.kind === 'consent' && !current.value.defaultRequired))
const isAgreed = computed(() => isConsent.value && agreeInfo.sameVersion && agreeInfo.optedIn === true)

/* ✅ axios 인터셉터를 피하기 위해 fetch만 사용 */
async function safeFetchJSON(url: string, init?: RequestInit) {
  const res = await fetch(url, { credentials: 'include', ...init })
  if (!res.ok) {
    const err: any = new Error(`HTTP ${res.status}`)
    ;(err.status = res.status)
    throw err
  }
  return await res.json()
}

async function tryGetMe() {
  try {
    const data = await safeFetchJSON('/api/me')
    const user = data?.user ?? data?.data?.user
    isAuthed.value = !!user
    isMaster.value = String(user?.role || '').toLowerCase() === 'master'
  } catch (e:any) {
    // 401 등은 공개 페이지에서 무시
    isAuthed.value = false
    isMaster.value = false
  }
}

async function tryGetAgreementStatus(slug: string) {
  if (!isAuthed.value) return
  try {
    const st = await safeFetchJSON('/api/terms/agreements/list')
    const items: any[] = st?.data?.items ?? st?.items ?? []
    const it = items.find(r => r?.slug === slug)
    if (it) {
      agreeInfo.hasRecord = !!it.hasRecord
      agreeInfo.sameVersion = !!it.sameVersion
      agreeInfo.optedIn = typeof it.optedIn === 'boolean' ? it.optedIn : null
    }
  } catch {
    // 공개 페이지에서는 실패해도 무시
  }
}

async function syncConsentCheckbox() {
  await nextTick()
  const root = document.querySelector('.doc-body') as HTMLElement | null
  if (!root) return
  const boxes = Array.from(root.querySelectorAll('input[type="checkbox"]')) as HTMLInputElement[]
  boxes.forEach(box => { box.checked = !!isAgreed.value; box.disabled = true })
}

const load = async () => {
  const s = slug.value
  if (!s) { await router.replace({ path: listPath.value }); return }

  state.loading = true
  state.error = ''
  current.value = null
  historyList.value = []
  agreeInfo.hasRecord = false
  agreeInfo.sameVersion = false
  agreeInfo.optedIn = null
  openIdx.value = null

  try {
    // 1) 로그인/권한 확인 (fetch로만 → 인터셉터 미작동)
    await tryGetMe()

    // 2) 최신 활성본 (공개 API - axios 사용 함수지만 200이면 인터셉터 개입 없음)
    const { data } = await getActiveTermBySlug(s)
    const rawActive = (data?.data ?? data) || null
    const active = extractDoc(rawActive)
    if (!active) state.error = '문서를 불러올 수 없습니다.'
    else current.value = active

    // 3) 동의 상태 (로그인 사용자에 한해)
    await tryGetAgreementStatus(s)
  } catch (e:any) {
    const status = e?.status ?? e?.response?.status
    state.error = status === 404 ? '요청한 문서를 찾을 수 없습니다.' : `로드 중 오류 (HTTP ${status ?? 'ERR'})`
  } finally {
    state.loading = false
    await syncConsentCheckbox()
  }

  // 4) 전체 버전 목록
  try {
    const res = await getTermVersions(s)
    const rows = (res?.data?.data ?? res?.data ?? []) as any[]
    const mapped = rows.map(extractDoc).filter(Boolean) as Doc[]
    const byVerDesc = [...mapped].sort((a,b)=>compareVersionDesc(a.version ?? '', b.version ?? ''))
    historyList.value = current.value && !byVerDesc.find(d=>d.version===current.value!.version)
      ? [current.value, ...byVerDesc] : byVerDesc
  } catch {
    // 버전 목록 실패는 치명적 아님
  }
}

const toggleOlder = (idx: number) => {
  openIdx.value = openIdx.value === idx ? null : idx
}

const agreeing = ref(false)
const revoking = ref(false)
const onAgreeClick = async () => {
  if (!isAuthed.value) { alert('로그인 후 동의할 수 있습니다.'); return }
  if (!current.value || isAgreed.value || agreeing.value) return
  try {
    agreeing.value = true
    await safeFetchJSON('/api/terms/consents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: current.value.slug, version: current.value.version, optedIn: true })
    })
    agreeInfo.hasRecord = agreeInfo.sameVersion = true; agreeInfo.optedIn = true
    await syncConsentCheckbox()
    alert('동의가 저장되었습니다.')
  } catch (e:any) {
    alert(`동의 저장 실패 (HTTP ${e?.status ?? 'ERR'})`)
  } finally { agreeing.value = false }
}
const onRevokeClick = async () => {
  if (!isAuthed.value) { alert('로그인 후 취소할 수 있습니다.'); return }
  if (!current.value || !isOptional.value || revoking.value) return
  try {
    revoking.value = true
    await safeFetchJSON('/api/terms/consents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: current.value.slug, version: current.value.version, optedIn: false })
    })
    agreeInfo.hasRecord = agreeInfo.sameVersion = true; agreeInfo.optedIn = false
    await syncConsentCheckbox()
    alert('동의가 취소되었습니다.')
  } catch (e:any) {
    alert(`동의 취소 실패 (HTTP ${e?.status ?? 'ERR'})`)
  } finally { revoking.value = false }
}

watch(() => slug.value, () => load())
onMounted(load)
</script>

<style scoped>
/* ✅ 스크롤 안전: 상위가 overflow:hidden이어도 이 래퍼에서 스크롤 */
.fix-scroll {
  min-height: 100vh;
  max-height: 100vh;
  overflow: auto;
  -webkit-overflow-scrolling: touch;
}

/* LegalDocs.vue와 동일한 단순 톤 */
.container { padding: 16px; }

/* 헤더 */
.page-head {
  display: flex; align-items: center; justify-content: space-between;
  gap: 12px; margin-bottom: 8px;
}
.page-head h1 { margin: 0; }
.head-actions { display:flex; gap:6px; }

/* 버튼 */
.btn-back {
  border: 1px solid rgba(255,255,255,.25);
  background: rgba(255,255,255,.9);
  color: #111;
  font-weight: 700;
  padding: 7px 5px;
  font-size: 0.8rem;
  border-radius: 12px;
  cursor: pointer;
}
.btn-back:active { transform: translateY(1px); }
.btn-primary, .btn-outline { margin-top: 12px; }
.btn-primary {
  background:#ffd60a; color:#111; border:0; padding:10px 14px; border-radius:10px; font-weight:800; cursor:pointer;
}
.btn-outline {
  background:transparent; color:#ddd; border:1px solid rgba(255,255,255,.3);
  padding:10px 14px; border-radius:10px; cursor:pointer;
}

/* 섹션 & 타이틀 */
.section { margin-bottom: 28px; }
.section-title { font-size: 1.125rem; margin: 0 0 12px 0; font-weight: 700; }

/* 본문 최소 타이포 */
.doc-wrapper { width: 100%; }
.doc-body {
  color: #f5f5f5;
  line-height: 1.7;
  font-size: 1rem;
  word-break: keep-all;
}
.doc-body :deep(h1), .doc-body :deep(h2), .doc-body :deep(h3) { margin: 1.2em 0 .6em; font-weight: 700; }
.doc-body :deep(p) { margin: 0 0 1em; }
.doc-body :deep(ul), .doc-body :deep(ol) { padding-left: 1.2em; margin: .6em 0; }
.doc-body :deep(a) { color: #ffd60a; text-decoration: underline; }

.muted { color: rgba(255,255,255,.7); }

/* 이전 버전 아코디언 */
.list { list-style: none; padding: 0; margin: 12px 0 0; display: grid; gap: 12px; }
.list-item {
  border: 1px solid rgba(255,255,255,.12);
  border-radius: 12px;
  padding: 0; /* 헤더/패널이 따로 padding 가짐 */
  background: rgba(255,255,255,.04);
}
.row { display:flex; gap:8px; align-items:center; justify-content:space-between; }
.meta { color: rgba(255,255,255,.7); font-size:.9rem; }

.acc-head {
  width: 100%;
  text-align: left;
  background: transparent;
  border: 0;
  padding: 14px;
  cursor: pointer;
  border-radius: 12px;
  color: inherit;
  display: grid;
  grid-template-columns: 1fr auto auto;
  gap: 8px;
}
.acc-head:hover { background: rgba(255,255,255,.04); }
.acc-title { font-weight: 700; }
.chev { transition: transform .15s ease; }
.chev.open { transform: rotate(180deg); }

.acc-panel { padding: 0 14px 14px; border-top: 1px dashed rgba(255,255,255,.12); }

/* ✅ 전역에서 body가 막혀 있어도 이 페이지 진입 시 풀기 */
:global(html), :global(body) { overflow: auto !important; }
</style>
