<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>공지사항</ion-title>

        <!-- 오른쪽: 글쓰기 / 뒤로가기 -->
        <ion-buttons slot="end">
          <ion-button v-if="isMaster" @click="goWrite">글쓰기</ion-button>
          <ion-button @click="goBack">뒤로가기</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <!-- ✅ 리스트 화면 -->
    <ion-content class="ion-padding">
      <ion-refresher slot="fixed" @ionRefresh="onPullRefresh">
        <ion-refresher-content pulling-text="당겨서 새로고침" refreshing-text="불러오는 중..." />
      </ion-refresher>

      <ion-list>
        <ion-item
          v-for="n in notices"
          :key="n._id"
          button
          detail
          @click="openDetail(n)"
        >
          <ion-label>
            <h3 class="title">{{ n.title || '(제목 없음)' }}</h3>
            <p class="meta">{{ formatDate(n.publishedAt || n.createdAt) }}</p>
          </ion-label>
        </ion-item>
      </ion-list>

      <ion-infinite-scroll threshold="120px" :disabled="noMore" @ionInfinite="loadMore">
        <ion-infinite-scroll-content loading-text="더 불러오는 중..." />
      </ion-infinite-scroll>
    </ion-content>

    <!-- ✅ 모달은 ion-content 밖(ion-page 직속)으로 이동 -->
    <ion-modal
      :is-open="detailOpen"
      @didDismiss="closeDetail"
      :presenting-element="presentingEl"
      :backdrop-dismiss="true"
    >
      <ion-header>
        <ion-toolbar>
          <ion-title>공지 상세</ion-title>
          <ion-buttons slot="end">
            <ion-button v-if="isMaster && current" @click="goEdit(current._id)">수정</ion-button>
            <ion-button v-if="isMaster && current" color="danger" @click="remove(current._id)">삭제</ion-button>
            <ion-button @click="closeDetail">닫기</ion-button>
          </ion-buttons>
        </ion-toolbar>
      </ion-header>

      <!-- ✅ 본문 가독성과 오버플로우 제어 -->
      <ion-content class="ion-padding notice-detail">
        <h2 class="detail-title">{{ current?.title }}</h2>
        <p class="detail-meta">{{ formatDate(current?.publishedAt || current?.createdAt) }}</p>

        <div class="detail-body" v-if="current">
          <!-- 텍스트형 -->
          <pre v-if="!isHtml(current.content)" class="plain">{{ current.content }}</pre>
          <!-- HTML형 -->
          <div v-else class="html-body" v-html="current.content"></div>
        </div>
      </ion-content>
    </ion-modal>
  </ion-page>
</template>

<script setup lang="ts">
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonContent,
  IonRefresher, IonRefresherContent, IonList, IonItem, IonLabel,
  IonInfiniteScroll, IonInfiniteScrollContent, IonModal
} from '@ionic/vue'
import { ref, onMounted, onBeforeUnmount } from 'vue'
import api from '@/lib/api'
import { useRouter } from 'vue-router'

type Notice = {
  _id: string
  title: string
  content?: string
  publishedAt?: string
  createdAt?: string
}

const router = useRouter()

const isMaster = ref(false)
const notices = ref<Notice[]>([])
const limit = 20
const cursor = ref(0)
const noMore = ref(false)
const loading = ref(false)

const detailOpen = ref(false)
const current = ref<Notice | null>(null)

/** ✅ iOS 카드형 모달이 화면을 덮어쓰지 않도록 presenting element 지정 */
const presentingEl = ref<HTMLElement | null>(null)
function setPresenting() {
  // ion-router-outlet이 있으면 가장 안전
  const outlet = document.querySelector('ion-router-outlet') as HTMLElement | null
  presentingEl.value = outlet || (document.querySelector('ion-page') as HTMLElement | null)
}

function isHtml(s?: string) { return !!s && /<\/?[a-z][\s\S]*>/i.test(s) }
function formatDate(iso?: string) {
  if (!iso) return ''
  const d = new Date(iso)
  const yy = d.getFullYear()
  const mm = String(d.getMonth()+1).padStart(2,'0')
  const dd = String(d.getDate()).padStart(2,'0')
  const hh = String(d.getHours()).padStart(2,'0')
  const mi = String(d.getMinutes()).padStart(2,'0')
  return `${yy}.${mm}.${dd} ${hh}:${mi}`
}

async function fetchMeRole() {
  try {
    const r = await api.get('/api/me', { withCredentials: true })
    isMaster.value = (r.data?.user?.role === 'master')
  } catch { isMaster.value = false }
}

async function fetchList(initial=false) {
  if (loading.value || noMore.value) return
  loading.value = true
  try {
    const r = await api.get('/api/notices', { params: { skip: cursor.value, limit }, withCredentials: true })
    const list = (r.data?.items || []) as Notice[]
    if (initial) notices.value = []
    notices.value = notices.value.concat(list)
    if (list.length < limit) noMore.value = true
    cursor.value += list.length
  } finally { loading.value = false }
}

async function refresh() {
  cursor.value = 0
  noMore.value = false
  await fetchList(true)
}

async function onPullRefresh(ev: CustomEvent) {
  await refresh()
  ;(ev.target as any).complete?.()
}

async function loadMore(ev: CustomEvent) {
  await fetchList()
  ;(ev.target as any).complete?.()
}

async function openDetail(n: Notice) {
  try {
    const r = await api.get(`/api/notices/${n._id}`, { withCredentials: true })
    current.value = r.data?.notice || n
    detailOpen.value = true
  } catch {
    current.value = n
    detailOpen.value = true
  }
}
function closeDetail() { detailOpen.value = false }

function goWrite() { router.push('/home/setting/0002/write') }
function goEdit(id?: string) { if (id) router.push(`/home/setting/0002/edit/${id}`) }
function goBack() { router.back() }

async function remove(id?: string) {
  if (!id) return
  if (!confirm('이 공지를 삭제할까요?')) return
  await api.delete(`/api/notices/${id}`, { withCredentials: true })
  detailOpen.value = false
  await refresh()
}

onMounted(async () => {
  setPresenting()
  await fetchMeRole()
  await refresh()
  // 뷰포트 리사이즈 시에도 presentingElement 재확인(희귀 케이스 방지)
  window.addEventListener('resize', setPresenting)
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', setPresenting)
})
</script>

<style scoped>
.title { font-weight: 800; font-size: 15px; margin: 0 0 4px; }
.meta { color: var(--ion-color-medium); margin: 0; }
.detail-title { font-size: 18px; font-weight: 900; margin: 0 0 6px; }
.detail-meta { color: var(--ion-color-medium); margin: 0 0 14px; }
.plain { white-space: pre-wrap; margin: 0; }

/* 🔹 리스트 다크 스타일 */
ion-list { background: transparent !important; }
ion-item {
  --background: #1e1e1e;
  --color: #eaeaea;
  --border-color: #333;
  border-radius: 8px;
  margin-bottom: 8px;
  /* ✅ iOS에서 아이템 내부 그림자 여백으로 인한 가로 오버플로우 방지 */
  --inner-padding-end: 12px;
}
ion-item:hover { --background: #2a2a2a; }
ion-label .title { color: #fff; }
ion-label .meta { color: #aaa; }

/* 🔹 상세 본문을 확실히 밝게 (HTML 콘텐츠 포함) */
.notice-detail { color: #eaeaea; }

/* ✅ 본문 오버플로우 방지: 긴 단어/URL, 표, 코드, 이미지 */
.detail-body,
.html-body,
.plain {
  overflow-wrap: anywhere;       /* 긴 URL/단어 줄바꿈 */
  word-break: break-word;
}

.notice-detail :deep(img) {
  max-width: 100%;
  height: auto;
  display: block;
}

.notice-detail :deep(table) {
  display: block;
  width: max-content;            /* 넓은 표는 스크롤 */
  max-width: 100%;
  overflow-x: auto;
  border-collapse: collapse;
}

.notice-detail :deep(pre),
.notice-detail :deep(code),
.notice-detail :deep(kbd),
.notice-detail :deep(samp) {
  white-space: pre-wrap;         /* 코드 블록 줄바꿈 */
  word-break: break-word;
}

/* v-html로 삽입된 내부 요소 색상/링크 톤 */
.notice-detail :deep(*) { color: #eaeaea; }
.notice-detail :deep(a) { text-decoration: underline; }
</style>
