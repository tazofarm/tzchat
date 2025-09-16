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
            <img class="slide-img" :src="u" :alt="`확대 이미지 ${i+1}`" />
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
  userId: string              // ← 반드시 상대방의 ID
  gender?: string
  size?: number               // 썸네일 한 변(px)
}>()

const size = computed(() => props.size ?? 170)
const DEFAULT_MAN = '/img/man.jpg'
const DEFAULT_WOMAN = '/img/woman.jpg'
const isFemale = (g?: string) => (g || '').toLowerCase().includes('여') || /(woman|female|^f$)/i.test(g || '')

type ImgItem = { id?: string; thumb?: string; medium?: string; full?: string }
const list = ref<ImgItem[]>([])
const mainId = ref<string>('')

function normalizeList(data: any): { items: ImgItem[]; main?: string } {
  const A = data?.profileImages
  if (Array.isArray(A) && A.length) {
    return {
      items: A.map((i: any) => ({
        id: i.id || i._id,
        thumb: i.urls?.thumb || i.thumb || i.url,
        medium: i.urls?.medium || i.medium || i.url,
        full: i.urls?.full || i.full || i.url
      })),
      main: data?.profileMain
    }
  }
  const B = data?.images
  if (Array.isArray(B) && B.length && typeof B[0] === 'string') {
    return { items: B.map((u: string) => ({ full: u, medium: u, thumb: u })) }
  }
  if (Array.isArray(data) && data.length) {
    if (typeof data[0] === 'string') {
      return { items: data.map((u: string) => ({ full: u, medium: u, thumb: u })) }
    }
    if (typeof data[0] === 'object') {
      return {
        items: data.map((i: any) => ({
          id: i.id || i._id,
          thumb: i.urls?.thumb || i.thumb || i.url,
          medium: i.urls?.medium || i.medium || i.url,
          full: i.urls?.full || i.full || i.url
        }))
      }
    }
  }
  return { items: [] }
}

/** 🔒 상대방만 보는 전용: ‘내 사진’ 엔드포인트는 절대 호출하지 않음 */
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
      const { data } = await api.get(url)
      const norm = normalizeList(data)
      if (norm.items.length) {
        list.value = norm.items
        mainId.value = norm.main || ''
        if (mainId.value) {
          list.value.sort((a, b) => (a.id === mainId.value ? -1 : b.id === mainId.value ? 1 : 0))
        }
        return
      }
    } catch {
      /* 다음 후보 시도 */
    }
  }

  // 이 경우는 서버에 상대방용 엔드포인트가 아직 없는 상태
  console.warn('[ProfilePhotoViewer] 상대방 이미지 엔드포인트에서 데이터를 받지 못했습니다. 기본이미지로 대체.')
  list.value = []
  mainId.value = ''
}

/* props.userId가 나중에 준비될 수 있으므로 watch + immediate */
watch(
  () => props.userId,
  (uid) => loadImagesOfUser(uid),
  { immediate: true }
)

/* 대표 썸네일 URL */
const mainDisplayUrl = computed(() => {
  const first = list.value[0]
  if (first?.medium || first?.full || first?.thumb) {
    return first.medium || first.full || first.thumb!
  }
  return isFemale(props.gender) ? DEFAULT_WOMAN : DEFAULT_MAN
})

/* ====== 라이트박스(보기 전용) ====== */
const viewerOpen = ref(false)
const viewerIndex = ref(0)
const viewerImages = computed(() =>
  list.value.map(i => i.full || i.medium || i.thumb!).filter(Boolean)
)

function openViewerAt(idx = 0) {
  if (!viewerImages.value.length) return
  viewerIndex.value = Math.max(0, Math.min(idx, viewerImages.value.length - 1))
  viewerOpen.value = true
}
function closeViewer() { viewerOpen.value = false }
function prev() { viewerIndex.value = Math.max(0, viewerIndex.value - 1) }
function next() { viewerIndex.value = Math.min(viewerImages.value.length - 1, viewerIndex.value + 1) }

/* 스와이프 */
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

/* 썸네일 크기 */
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

/* 라이트박스 */
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
