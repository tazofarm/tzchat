<!-- src/views/ProfilePhotoPage.vue -->
<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>프로필 사진</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <!-- 상단 대표 -->
      <div class="wrap">
        <div class="row">
          <img
            class="avatar"
            :src="mainDisplayUrl"
            :alt="`기본 프로필 이미지 (${gender || 'unknown'})`"
            loading="lazy"
            @click="openSelector"
          />
        </div>
      </div>

      <!-- 🔲 4칸 선택/업로드 팝업 -->
      <div
        v-if="selectorOpen"
        class="selector"
        role="dialog"
        aria-modal="true"
        aria-label="사진 선택/추가"
        @click.self="closeSelector"
      >
        <div class="selector-card">
          <div class="selector-head">
            <strong>사진 관리</strong>
            <button class="selector-close" @click="closeSelector" aria-label="닫기">×</button>
          </div>

          <div class="slot-grid">
            <div v-for="(slot, idx) in 4" :key="idx" class="slot">
              <!-- 상단: 이미지 있으면 썸네일 + (x) 삭제버튼 / 없으면 큰 + -->
              <div class="slot-box" v-if="slotImage(idx)">
                <img
                  class="slot-img"
                  :src="slotImage(idx)!.urls.thumb"
                  :alt="`사진 ${idx+1}`"
                  @click="openViewerAt(idx)"
                />
                <!-- 대표 배지 -->
                <span class="badge-main" v-if="isMain(slotImage(idx)!)">대표</span>
                <button class="slot-del" @click.stop="askDelete(slotImage(idx)!)" aria-label="사진 삭제">×</button>
              </div>
              <div class="slot-empty" v-else @click="chooseFile(idx)" role="button" aria-label="사진 추가">+</div>

              <!-- 하단: (+) — 위 사각형과 동일 크기/스타일 -->
              <button class="slot-add" @click="chooseFile(idx)" aria-label="사진 추가/교체">+</button>
            </div>
          </div>

          <!-- 숨김 파일 입력 (1장 업로드) -->
          <input
            ref="fileInput"
            type="file"
            accept="image/*"
            style="display:none"
            @change="onFileChange"
          />

          <p v-if="errorMsg" class="error">{{ errorMsg }}</p>
          <p v-if="successMsg" class="success">{{ successMsg }}</p>
        </div>
      </div>

      <!-- ❗️삭제 확인 모달 -->
      <div v-if="confirmOpen" class="confirm" role="dialog" aria-modal="true" aria-label="사진 삭제 확인" @click.self="closeConfirm">
        <div class="confirm-card">
          <p class="confirm-title">이 사진을 삭제하시겠어요?</p>
          <div class="confirm-actions">
            <button class="btn danger" @click="doDelete">삭제</button>
            <button class="btn" @click="closeConfirm">취소</button>
          </div>
        </div>
      </div>

      <!-- 🔍 풀스크린 뷰어(스와이프 가능) -->
      <div
        v-if="viewerOpen"
        class="lightbox"
        role="dialog"
        aria-modal="true"
        aria-label="사진 확대 보기"
        @click.self="closeViewer"
      >
        <button class="viewer-close" aria-label="닫기" @click="closeViewer">×</button>

        <!-- 좌우 네비 버튼 -->
        <button class="nav prev" aria-label="이전" @click.stop="prev">‹</button>
        <button class="nav next" aria-label="다음" @click.stop="next">›</button>

        <!-- 캐러셀 트랙 -->
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

        <!-- 하단 중앙: 페이지 표시 -->
        <div class="pager">{{ viewerIndex + 1 }} / {{ viewerImages.length }}</div>

        <!-- 하단 왼쪽: 대표설정/대표사진 -->
        <button
          class="set-main left"
          :disabled="isCurrentViewerMain || settingMain"
          @click.stop="setAsMain"
        >
          {{ isCurrentViewerMain ? '대표사진' : (settingMain ? '변경중...' : '대표설정') }}
        </button>

        <!-- 하단 오른쪽: 뒤로가기 -->
        <button class="viewer-back" @click.stop="closeViewer" aria-label="뒤로가기">뒤로가기</button>

        <!-- 간단 토스트 -->
        <div v-if="viewerNotice" class="toast">{{ viewerNotice }}</div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent
} from '@ionic/vue'
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import api from '@/lib/api'

const DEFAULT_MAN = '/img/man.jpg'
const DEFAULT_WOMAN = '/img/woman.jpg'

type ProfileImage = {
  id: string
  kind: 'avatar' | 'gallery'
  aspect: number
  urls: { thumb: string; medium: string; full: string }
  createdAt?: string
}
type GetListResponse = {
  profileMain: string
  profileImages: ProfileImage[]
}

const gender = ref<string>('')

function isFemale(g: string) {
  const s = (g || '').toLowerCase()
  return s.includes('여') || s.includes('woman') || s.includes('female') || s === 'f'
}

const images = ref<ProfileImage[]>([])
const profileMain = ref<string>('')

// 상단 표시 이미지: 대표(또는 첫 장) → 없으면 성별 기본
const mainDisplayUrl = computed(() => {
  if (images.value.length) {
    const byId = images.value.find(i => i.id === profileMain.value)
    return (byId?.urls.medium || images.value[0].urls.medium)
  }
  return isFemale(gender.value) ? DEFAULT_WOMAN : DEFAULT_MAN
})

const mainId = computed(() => profileMain.value || images.value[0]?.id || '')
function isMain(img: ProfileImage) { return img && img.id === mainId.value }

async function loadImages() {
  try {
    const { data } = await api.get<GetListResponse>('/api/profile/images')
    const list = (data.profileImages || []).slice().sort((a, b) => {
      const ta = +new Date(a.createdAt || 0)
      const tb = +new Date(b.createdAt || 0)
      return ta - tb
    })
    images.value = list
    profileMain.value = data.profileMain || ''
  } catch {
    images.value = []
    profileMain.value = ''
  }
}
function slotImage(idx: number) { return images.value[idx] || null }

// 팝업
const selectorOpen = ref(false)
function openSelector() { selectorOpen.value = true; loadImages() }
function closeSelector() { selectorOpen.value = false; uploadSlotIdx.value = -1 }

// 업로드 (첫 업로드는 avatar로 → 대표 자동 지정)
const fileInput = ref<HTMLInputElement | null>(null)
const uploadSlotIdx = ref<number>(-1)
const errorMsg = ref(''); const successMsg = ref('')

function chooseFile(idx: number) { uploadSlotIdx.value = idx; fileInput.value?.click() }

async function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  errorMsg.value = ''; successMsg.value = ''

  try {
    const hadZeroBefore = images.value.length === 0
    const fd = new FormData()
    fd.append('kind', hadZeroBefore ? 'avatar' : 'gallery')
    fd.append('images', file)
    const { data } = await api.post('/api/profile/images', fd, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    if (hadZeroBefore) {
      const firstCreatedId = data?.created?.[0]?.id
      if (firstCreatedId) { try { await api.put('/api/profile/main', { imageId: firstCreatedId }) } catch {} }
    }
    successMsg.value = '업로드 완료'
    await loadImages()
  } catch (err: any) {
    errorMsg.value = err?.response?.data?.message || err?.message || '업로드 실패'
  } finally {
    uploadSlotIdx.value = -1
  }
}

// 삭제 확인 모달
const confirmOpen = ref(false)
const confirmTarget = ref<ProfileImage | null>(null)
function askDelete(img: ProfileImage) { confirmTarget.value = img; confirmOpen.value = true }
function closeConfirm() { confirmOpen.value = false; confirmTarget.value = null }
async function doDelete() {
  if (!confirmTarget.value) return
  try {
    await api.delete(`/api/profile/images/${confirmTarget.value.id}`)
    closeConfirm()
    await loadImages()
  } catch (err: any) {
    errorMsg.value = err?.response?.data?.message || err?.message || '삭제 실패'
  }
}

/* =========================
 * 🔍 뷰어(스와이프 캐러셀)
 * ========================= */
const viewerOpen = ref(false)
const viewerIndex = ref(0)
const viewerImages = computed(() => images.value.map(i => i.urls.full))
const viewerIds = computed(() => images.value.map(i => i.id)) // ← 대표설정용 ID 매핑

function openViewerAt(idx: number) {
  if (!images.value.length) return
  viewerIndex.value = Math.max(0, Math.min(idx, viewerImages.value.length - 1))
  viewerOpen.value = true
}
function closeViewer() { viewerOpen.value = false }

function prev() { viewerIndex.value = Math.max(0, viewerIndex.value - 1) }
function next() { viewerIndex.value = Math.min(viewerImages.value.length - 1, viewerIndex.value + 1) }

function onKey(e: KeyboardEvent) {
  if (!viewerOpen.value) return
  if (e.key === 'Escape') closeViewer()
  if (e.key === 'ArrowLeft') prev()
  if (e.key === 'ArrowRight') next()
}

// 대표설정 버튼 관련
const settingMain = ref(false)
const viewerNotice = ref('')
const isCurrentViewerMain = computed(() => {
  const id = viewerIds.value[viewerIndex.value]
  return !!id && id === mainId.value
})
async function setAsMain() {
  const id = viewerIds.value[viewerIndex.value]
  if (!id || settingMain.value) return
  settingMain.value = true
  try {
    await api.put('/api/profile/main', { imageId: id })
    profileMain.value = id
    viewerNotice.value = '대표 사진이 변경되었습니다.'
    setTimeout(() => (viewerNotice.value = ''), 1500)
  } catch (e: any) {
    viewerNotice.value = e?.response?.data?.message || '대표 설정 실패'
    setTimeout(() => (viewerNotice.value = ''), 1800)
  } finally {
    settingMain.value = false
  }
}

onMounted(async () => {
  // 성별 로드
  const candidates = ['/api/users/me', '/api/me', '/api/auth/me']
  for (const url of candidates) {
    try {
      const { data } = await api.get(url)
      if (data && (data.gender || data?.user?.gender)) {
        gender.value = String(data.gender || data.user.gender || '')
        break
      }
    } catch { /* ignore */ }
  }
  await loadImages()
  window.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

// 터치 스와이프
const dragging = ref(false)
const startX = ref(0)
const deltaX = ref(0)
function onTouchStart(ev: TouchEvent) {
  dragging.value = true
  startX.value = ev.touches[0].clientX
  deltaX.value = 0
}
function onTouchMove(ev: TouchEvent) {
  if (!dragging.value) return
  deltaX.value = ev.touches[0].clientX - startX.value
}
function onTouchEnd() {
  if (!dragging.value) return
  const threshold = Math.min(60, window.innerWidth * 0.15)
  if (deltaX.value > threshold) prev()
  else if (deltaX.value < -threshold) next()
  dragging.value = false
  deltaX.value = 0
}
const trackStyle = computed(() => {
  const vwShift = (-viewerIndex.value * 100) + (dragging.value ? (deltaX.value / Math.max(1, window.innerWidth)) * 100 : 0)
  return {
    transform: `translateX(${vwShift}vw)`,
    transition: dragging.value ? 'none' : 'transform 300ms ease'
  }
})
</script>

<style scoped>
/* 상단 중앙 정렬 */
.wrap { max-width: 520px; margin: 12px auto 0; }
.row  { display: flex; align-items: center; justify-content: center; }
.avatar {
  display: block; width: 100%; max-width: 180px; aspect-ratio: 1/1;
  object-fit: cover; border-radius: 16px; background: #111; margin: 0 auto; cursor: pointer;
}

/* 팝업(선택/업로드) */
.selector {
  position: fixed; inset: 0; background: rgba(0,0,0,0.45); z-index: 1200;
  display: flex; align-items: center; justify-content: center; padding: 14px;
}
.selector-card {
  width: min(92vw, 560px); background: #fff; color: #000;
  border-radius: 14px; box-shadow: 0 10px 30px rgba(0,0,0,0.18); padding: 12px;
}
.selector-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.selector-close {
  width: 34px; height: 34px; border-radius: 999px; border: 0;
  background: #bcbcbc; color: #fff; font-size: 20px; cursor: pointer;
}

/* 4칸 × 2행 레이아웃 */
.slot-grid {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px 8px; padding: 6px 2px;
}
.slot { display: flex; flex-direction: column; gap: 6px; }

/* 공통 사각형 */
.slot-img, .slot-empty, .slot-add {
  width: 100%; aspect-ratio: 1/1; border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
  background: #f7f7f7; border: 1px dashed #ddd; color: #888;
}
.slot-box { position: relative; }
.slot-img { object-fit: cover; display: block; cursor: zoom-in; }
/* 대표 배지 */
.badge-main{
  position: absolute; left: 6px; top: 6px;
  padding: 2px 6px; border-radius: 999px;
  background: #111; color: #fff; font-size: 12px; font-weight: 800;
  box-shadow: 0 2px 6px rgba(0,0,0,0.25);
}
.slot-del {
  position: absolute; right: 6px; top: 6px; width: 26px; height: 26px;
  border-radius: 999px; border: 0; background: rgba(0,0,0,0.55);
  color: #fff; font-size: 18px; line-height: 26px; cursor: pointer;
}
.slot-empty { font-size: 28px; cursor: pointer; }
.slot-add   { font-size: 24px; font-weight: 700; cursor: pointer; }

/* 삭제 확인 모달 */
.confirm {
  position: fixed; inset: 0; background: rgba(0,0,0,0.45); z-index: 1300;
  display: flex; align-items: center; justify-content: center; padding: 14px;
}
.confirm-card {
  width: min(90vw, 360px); background: #fff; color: #000;
  border-radius: 14px; box-shadow: 0 10px 30px rgba(0,0,0,0.18); padding: 16px;
}
.confirm-title { margin: 0 0 12px; font-weight: 800; }
.confirm-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.btn { height: 44px; border-radius: 12px; border: 0; background: #eaeaea; color: #000; font-weight: 700; cursor: pointer; }
.btn.danger { background: #ffb4ab; color: #000; }

/* 🔍 라이트박스 */
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

/* 좌우 네비게이션 버튼 */
.nav {
  position: fixed; top: 50%; transform: translateY(-50%);
  width: 44px; height: 44px; border-radius: 999px; border: 0;
  background: rgba(255,255,255,0.18); color: #fff; font-size: 28px; cursor: pointer;
}
.nav.prev { left: 12px; }
.nav.next { right: 12px; }

/* 하단 중앙 페이지 표시 */
.pager {
  position: fixed; bottom: 12px; left: 50%; transform: translateX(-50%);
  color: #fff; background: rgba(0,0,0,0.35); padding: 4px 10px; border-radius: 999px; font-weight: 700;
}

/* 하단 왼쪽: 대표설정 버튼 */
.set-main {
  position: fixed; left: 12px; bottom: 12px;
  height: 40px; padding: 0 14px; border: 0; border-radius: 12px;
  font-weight: 800; cursor: pointer;
  background: #ffd166; color: #000;
}
.set-main:disabled { opacity: 0.7; cursor: default; }

/* 하단 오른쪽: 뒤로가기 버튼 */
.viewer-back {
  position: fixed; right: 12px; bottom: 12px;
  height: 40px; padding: 0 14px; border: 0; border-radius: 12px;
  font-weight: 800; cursor: pointer;
  background: rgba(255,255,255,0.2); color: #fff;
}

/* 라이트박스 토스트 */
.toast {
  position: fixed; bottom: 62px; left: 50%; transform: translateX(-50%);
  background: rgba(0,0,0,0.7); color: #fff; padding: 6px 12px; border-radius: 999px; font-weight: 700;
}
</style>
