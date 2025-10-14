<template>
  <div class="viewer-host">
    <!-- 대표 썸네일 -->
    <img
      class="avatar"
      :style="avatarStyle"
      :src="mainDisplayUrl"
      alt="상대방 프로필 대표 이미지"
      loading="lazy"
      @click="openViewerAt(0)"
      @error="onMainError"
      referrerpolicy="no-referrer"
    />

    <!-- 풀스크린 라이트박스 -->
    <div
      v-if="viewerOpen"
      class="lightbox"
      role="dialog"
      aria-modal="true"
      aria-label="사진 확대 보기"
      @click.self="closeViewer"
    >
      <button class="viewer-close" aria-label="닫기" @click="closeViewer">×</button>

      <button class="nav prev" aria-label="이전" @click.stop="prev">‹</button>
      <button class="nav next" aria-label="다음" @click.stop="next">›</button>

      <div
        class="carousel"
        @touchstart.passive="onTouchStart"
        @touchmove.prevent="onTouchMove"
        @touchend="onTouchEnd"
      >
        <div class="track" :style="trackStyle">
          <div class="slide" v-for="(u, i) in viewerImages" :key="i">
            <img class="slide-img" :src="u" :alt="`확대 이미지 ${i+1}`" @error="onViewerImgError(i)" />
          </div>
        </div>
      </div>

      <div class="pager">{{ viewerIndex + 1 }} / {{ viewerImages.length }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import api from '@/lib/api'

const props = defineProps<{
  userId: string
  gender?: string
  size?: number
}>()

const size = computed(() => props.size ?? 170)
const DEFAULT_MAN = '/img/man.jpg'
const DEFAULT_WOMAN = '/img/woman.jpg'
const isFemale = (g?: string) =>
  (g || '').toLowerCase().includes('여') || /(woman|female|^f$)/i.test(g || '')

/* ----------------------------------------------------------
   ✅ API BASE 처리: http/https 혼합 차단 + 절대경로 보정
---------------------------------------------------------- */
function getApiOrigin(): URL {
  const envBase = (import.meta.env.VITE_API_FILE_BASE || import.meta.env.VITE_API_BASE_URL || '').toString().trim()
  const candidate = envBase || (api as any)?.defaults?.baseURL || window.location.origin
  let u: URL
  try { u = new URL(candidate, window.location.origin) } catch { u = new URL(window.location.origin) }

  if (window.location.protocol === 'https:' && u.protocol === 'http:') {
    try {
      const httpsTry = new URL(u.toString())
      httpsTry.protocol = 'https:'
      u = httpsTry
    } catch {}
  }
  return u
}
const API_ORIGIN = getApiOrigin()

function toAbsolute(u?: string): string {
  if (!u) return ''
  if (/^(https?:|data:|blob:)/i.test(u)) {
    if (window.location.protocol === 'https:' && u.startsWith('http://')) {
      try {
        const parsed = new URL(u)
        if (parsed.hostname === API_ORIGIN.hostname) {
          parsed.protocol = 'https:'
          return parsed.toString()
        }
      } catch {}
    }
    return u
  }
  if (u.startsWith('//')) return `${API_ORIGIN.protocol}${u}`
  if (u.startsWith('/')) return `${API_ORIGIN.origin}${u}`
  return `${API_ORIGIN.origin}/${u}`
}

/* ----------------------------------------------------------
   🔹 이미지 리스트 로딩
---------------------------------------------------------- */
type ImgItem = { id?: string; thumb?: string; medium?: string; full?: string }
const list = ref<ImgItem[]>([])
const mainId = ref<string>('')

function normalizeList(data: any): { items: ImgItem[]; main?: string } {
  const mapObj = (i: any): ImgItem => ({
    id: i?.id || i?._id,
    thumb: toAbsolute(i?.urls?.thumb || i?.thumb || i?.url),
    medium: toAbsolute(i?.urls?.medium || i?.medium || i?.url),
    full: toAbsolute(i?.urls?.full || i?.full || i?.url),
  })

  const A = data?.profileImages
  if (Array.isArray(A) && A.length) {
    return { items: A.map(mapObj), main: data?.profileMain }
  }
  const B = data?.images
  if (Array.isArray(B) && B.length && typeof B[0] === 'string') {
    return { items: B.map((u: string) => ({ full: toAbsolute(u), medium: toAbsolute(u), thumb: toAbsolute(u) })) }
  }
  if (Array.isArray(data) && data.length) {
    if (typeof data[0] === 'string') {
      return { items: data.map((u: string) => ({ full: toAbsolute(u), medium: toAbsolute(u), thumb: toAbsolute(u) })) }
    }
    if (typeof data[0] === 'object') {
      return { items: data.map(mapObj) }
    }
  }
  return { items: [] }
}

async function loadImagesOfUser(uid: string) {
  if (!uid) return
  const candidates = [
    `/api/users/${uid}/profile/images`,
    `/api/users/${uid}/images`,
    `/api/users/${uid}/profile-images`,
    `/api/user/${uid}/images`,
    `/api/users/${uid}/photos`,
  ]

  for (const url of candidates) {
    try {
      const { data } = await api.get(url, { withCredentials: true })
      const norm = normalizeList(data)
      if (norm.items.length) {
        list.value = norm.items
        mainId.value = norm.main || ''
        if (mainId.value) {
          list.value.sort((a, b) => (a.id === mainId.value ? -1 : b.id === mainId.value ? 1 : 0))
        }
        return
      }
    } catch {}
  }

  console.warn('[ProfilePhotoViewer] 상대방 이미지 데이터를 받지 못했습니다.')
  list.value = []
  mainId.value = ''
}

watch(() => props.userId, (uid) => loadImagesOfUser(uid), { immediate: true })

/* ----------------------------------------------------------
   🔹 대표 썸네일
---------------------------------------------------------- */
const mainDisplayUrl = computed(() => {
  const first = list.value[0]
  if (first?.medium || first?.full || first?.thumb)
    return first.medium || first.full || first.thumb!
  return isFemale(props.gender) ? DEFAULT_WOMAN : DEFAULT_MAN
})

function onMainError(e: Event) {
  const el = e.target as HTMLImageElement
  const fallback = isFemale(props.gender) ? toAbsolute(DEFAULT_WOMAN) : toAbsolute(DEFAULT_MAN)
  if (el && el.src !== fallback) el.src = fallback
}

/* ----------------------------------------------------------
   🔹 라이트박스 보기 기능
---------------------------------------------------------- */
const viewerOpen = ref(false)
const viewerIndex = ref(0)
const viewerImages = computed(() =>
  list.value.map(i => i.full || i.medium || i.thumb!).map(toAbsolute).filter(Boolean)
)

function onViewerImgError(i: number) {
  const target = viewerImages.value[i]
  if (!target) return
  const idxInList = list.value.findIndex(li =>
    (li.full || li.medium || li.thumb) && toAbsolute(li.full || li.medium || li.thumb) === target
  )
  if (idxInList >= 0) list.value.splice(idxInList, 1)
  if (viewerIndex.value >= viewerImages.value.length - 1) {
    viewerIndex.value = Math.max(0, viewerImages.value.length - 2)
  }
}

function openViewerAt(idx = 0) {
  if (!viewerImages.value.length) return
  viewerIndex.value = Math.max(0, Math.min(idx, viewerImages.value.length - 1))
  viewerOpen.value = true
}
function closeViewer() { viewerOpen.value = false }
function prev() { viewerIndex.value = Math.max(0, viewerIndex.value - 1) }
function next() { viewerIndex.value = Math.min(viewerImages.value.length - 1, viewerIndex.value + 1) }

/* ----------------------------------------------------------
   🔹 터치 스와이프 제스처
---------------------------------------------------------- */
const dragging = ref(false)
const startX = ref(0)
const deltaX = ref(0)
function onTouchStart(e: TouchEvent) { dragging.value = true; startX.value = e.touches[0].clientX; deltaX.value = 0 }
function onTouchMove(e: TouchEvent) { if (dragging.value) deltaX.value = e.touches[0].clientX - startX.value }
function onTouchEnd() {
  if (!dragging.value) return
  const th = Math.min(60, window.innerWidth * 0.15)
  if (deltaX.value > th) prev()
  else if (deltaX.value < -th) next()
  dragging.value = false
  deltaX.value = 0
}
const trackStyle = computed(() => {
  const shift = (-viewerIndex.value * 100) + (dragging.value ? (deltaX.value / Math.max(1, window.innerWidth)) * 100 : 0)
  return { transform: `translateX(${shift}vw)`, transition: dragging.value ? 'none' : 'transform 300ms ease' }
})

/* ----------------------------------------------------------
   🔹 썸네일 스타일
---------------------------------------------------------- */
const avatarStyle = computed(() => ({
  width: `${size.value}px`,
  height: `${size.value}px`
}))
</script>

<style scoped>
.viewer-host { display: flex; flex-direction: column; align-items: center; }
.avatar {
  display: block; object-fit: cover; aspect-ratio: 1/1;
  border-radius: 14px; background: #111; cursor: pointer;
  box-shadow: 0 6px 20px rgba(0,0,0,.35);
}
.lightbox {
  position: fixed; inset: 0; background: rgba(0,0,0,0.88); z-index: 1400;
  display: flex; align-items: center; justify-content: center; flex-direction: column;
}
.viewer-close {
  position: fixed; top: 10px; right: 12px;
  width: 40px; height: 40px; border-radius: 999px; border: 0;
  background: rgba(255,255,255,0.18); color: #fff; font-size: 26px; cursor: pointer;
}
.carousel { position: relative; width: 100vw; height: 86vh; overflow: hidden; }
.track { height: 100%; display: flex; }
.slide { flex: 0 0 100vw; height: 100%; display: flex; align-items: center; justify-content: center; }
.slide-img {
  max-width: 92vw; max-height: 86vh; object-fit: contain;
  border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.4);
}
.nav {
  position: fixed; top: 50%; transform: translateY(-50%);
  width: 44px; height: 44px; border-radius: 999px; border: 0;
  background: rgba(255,255,255,0.18); color: #fff; font-size: 28px; cursor: pointer;
}
.nav.prev { left: 12px; }
.nav.next { right: 12px; }
.pager {
  position: fixed; bottom: 12px; left: 50%; transform: translateX(-50%);
  color: #fff; background: rgba(0,0,0,0.35); padding: 4px 10px; border-radius: 999px; font-weight: 700;
}
</style>
