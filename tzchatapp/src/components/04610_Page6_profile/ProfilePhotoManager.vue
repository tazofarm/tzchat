<!-- src/components/ProfilePhotoManager.vue -->
<template>
  <div class="photo-manager">
    <!-- 상단 대표 이미지 -->
    <div class="wrap">
      <div class="row">
        <img
          class="avatar"
          :src="mainDisplayUrl"
          :alt="`프로필 이미지 (${gender || 'unknown'})`"
          loading="lazy"
          @click="onAvatarClick"
        />
      </div>
    </div>

    <!-- 🔲 선택/업로드 팝업 -->
    <teleport to="body">
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

          <!-- ✅ 빈칸 없이: 이미지 수 + 1개의 추가 버튼(최대 MAX_SLOTS) -->
          <div class="slot-grid">
            <div v-for="n in visibleSlotCount" :key="n" class="slot">
              <!-- 이미지 타일 -->
              <template v-if="n - 1 < images.length">
                <div class="slot-box">
                  <img
                    class="slot-img"
                    :src="images[n-1].urls.thumb"
                    :alt="`사진 ${n}`"
                    @click="openViewerAt(n - 1)"
                  />
                  <span class="badge-main" v-if="isMain(images[n-1])">대표</span>
                  <button class="slot-del" @click.stop="askDelete(images[n-1])" aria-label="사진 삭제">×</button>
                </div>
              </template>
              <!-- 추가 버튼 -->
              <template v-else>
                <div class="slot-empty" @click="chooseFile(n - 1)" role="button" aria-label="사진 추가">+</div>
              </template>
            </div>
          </div>

          <!-- 파일 입력 -->
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
    </teleport>

    <!-- ❗ 삭제 확인 -->
    <teleport to="body">
      <div
        v-if="confirmOpen"
        class="confirm"
        role="dialog"
        aria-modal="true"
        aria-label="사진 삭제 확인"
        @click.self="closeConfirm"
      >
        <div class="confirm-card">
          <p class="confirm-title">이 사진을 삭제하시겠어요?</p>
          <div class="confirm-actions">
            <button class="btn danger" @click="doDelete">삭제</button>
            <button class="btn" @click="closeConfirm">취소</button>
          </div>
        </div>
      </div>
    </teleport>

    <!-- 🔍 풀스크린 뷰어 -->
    <teleport to="body">
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

        <button
          v-if="!readonly"
          class="set-main left"
          :disabled="isCurrentViewerMain || settingMain"
          @click.stop="setAsMain"
        >
          {{ isCurrentViewerMain ? '대표사진' : (settingMain ? '변경중...' : '대표설정') }}
        </button>

        <button class="viewer-back" @click.stop="closeViewer" aria-label="뒤로가기">뒤로가기</button>
        <div v-if="viewerNotice" class="toast">{{ viewerNotice }}</div>
      </div>
    </teleport>

    <!-- 🧩 크롭 모달 -->
    <teleport to="body">
      <div
        v-if="cropOpen"
        class="cropper"
        role="dialog"
        aria-modal="true"
        aria-label="사진 크롭"
        @click.self="closeCrop"
      >
        <div class="crop-card">
          <div class="crop-head">
            <strong>사진 자르기</strong>
            <button class="crop-close" @click="closeCrop" aria-label="닫기">×</button>
          </div>

          <div
            ref="cropBoxEl"
            class="crop-box"
            @mousedown="dragStart"
            @touchstart.passive="dragStart"
            @wheel.prevent="onWheel"
          >
            <img
              ref="cropImgEl"
              :src="cropSrc"
              class="crop-img"
              :style="cropImgStyle"
              @load="onCropImageLoad"
              alt="편집 이미지"
            />
            <div class="mask"></div>
          </div>

          <div class="crop-controls">
            <label>확대/축소</label>
            <input
              type="range"
              :min="cropMinScale"
              :max="cropMaxScale"
              step="0.001"
              v-model.number="cropScale"
              @input="clampTranslate"
            />

            <!-- 3버튼 한 줄 고정 -->
            <div class="ctrl-row">
              <button class="btn ghost" @click="closeCrop">취소</button>
              <div class="right-group">
                <button class="btn reset" @click="resetCrop">초기화</button>
                <button class="btn primary" :disabled="cropping" @click="confirmCrop">
                  {{ cropping ? '처리중...' : '업로드' }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import api from '@/lib/api'

/** ===== 설정 ===== */
const MAX_SLOTS = 8
const OUT = 1024  // 저장 해상도(정사각)

/** ===== Props & Emits ===== */
const props = defineProps<{
  gender?: string
  readonly?: boolean
  userId?: string
}>()
const emit = defineEmits<{
  (e: 'updated'): void
  (e: 'main-changed', imageId: string): void
}>()

/** ===== 타입 ===== */
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

/** ===== 상수 ===== */
const DEFAULT_MAN = '/img/man.jpg'
const DEFAULT_WOMAN = '/img/woman.jpg'

/** ===== 상태 ===== */
const gender = computed(() => props.gender || '')
const readonly = computed(() => !!props.readonly)
const images = ref<ProfileImage[]>([])
const profileMain = ref<string>('')

function isFemale(g: string) {
  const s = (g || '').toLowerCase()
  return s.includes('여') || s.includes('woman') || s.includes('female') || s === 'f'
}

/** ===== 로딩 ===== */
async function loadImages() {
  try {
    const url = props.userId ? `/api/profile/images?userId=${encodeURIComponent(props.userId)}` : '/api/profile/images'
    const { data } = await api.get<GetListResponse>(url)
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
watch(() => props.userId, loadImages)

/** ===== 표시용 ===== */
const mainDisplayUrl = computed(() => {
  if (images.value.length) {
    const byId = images.value.find(i => i.id === profileMain.value)
    return (byId?.urls.medium || images.value[0].urls.medium)
  }
  return isFemale(gender.value) ? DEFAULT_WOMAN : DEFAULT_MAN
})
const mainId = computed(() => profileMain.value || images.value[0]?.id || '')
function isMain(img: ProfileImage) { return img && img.id === mainId.value }

/** ✅ 보이는 슬롯(이미지 수 + 1 추가 버튼) */
const visibleSlotCount = computed(() => {
  const canAddMore = images.value.length < MAX_SLOTS
  return Math.min(MAX_SLOTS, images.value.length + (canAddMore ? 1 : 0))
})

/** ===== 선택기 ===== */
const selectorOpen = ref(false)
function openSelector() { if (readonly.value) return; selectorOpen.value = true; loadImages() }
function closeSelector() { selectorOpen.value = false; uploadSlotIdx.value = -1 }
function onAvatarClick() {
  if (readonly.value) {
    openViewerAt(images.value.findIndex(i => i.id === mainId.value))
  } else {
    openSelector()
  }
}

/** ===== 업로드 & 크롭 ===== */
const fileInput = ref<HTMLInputElement | null>(null)
const uploadSlotIdx = ref<number>(-1)
const errorMsg = ref(''); const successMsg = ref('')

function chooseFile(idx: number) { if (readonly.value) return; uploadSlotIdx.value = idx; fileInput.value?.click() }
function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  openCropWithFile(file)
}

/* --- 크롭 모달 --- */
const cropOpen = ref(false)
const cropSrc = ref('')

const cropImgEl = ref<HTMLImageElement | null>(null)
const cropBoxEl = ref<HTMLDivElement | null>(null)

const cropScale = ref(1)
const cropMinScale = ref(1)
const cropMaxScale = ref(1)
const cropTx = ref(0)
const cropTy = ref(0)

const naturalW = ref(1)
const naturalH = ref(1)
const boxSize = ref(300)
const cropping = ref(false)

const cropImgStyle = computed(() => ({
  transform: `translate(-50%, -50%) translate3d(${cropTx.value}px, ${cropTy.value}px, 0) scale(${cropScale.value})`
}))
function openCropWithFile(file: File) {
  if (readonly.value) return
  const reader = new FileReader()
  reader.onload = () => { cropSrc.value = String(reader.result || ''); cropOpen.value = true }
  reader.readAsDataURL(file)
}
function closeCrop() { cropOpen.value = false; cropSrc.value = ''; resetCrop() }
function onCropImageLoad() {
  const el = cropImgEl.value, box = cropBoxEl.value
  if (!el || !box) return
  naturalW.value = el.naturalWidth || 1
  naturalH.value = el.naturalHeight || 1
  const rect = box.getBoundingClientRect()
  boxSize.value = Math.min(rect.width, rect.height)
  const sFit = Math.max(boxSize.value / naturalW.value, boxSize.value / naturalH.value)
  cropMinScale.value = sFit
  cropMaxScale.value = sFit * 5
  cropScale.value = sFit
  cropTx.value = 0; cropTy.value = 0
  clampTranslate()
}
function clampTranslate() {
  const dispW = naturalW.value * cropScale.value
  const dispH = naturalH.value * cropScale.value
  const maxX = Math.max(0, (dispW - boxSize.value) / 2)
  const maxY = Math.max(0, (dispH - boxSize.value) / 2)
  cropTx.value = Math.min(maxX, Math.max(-maxX, cropTx.value))
  cropTy.value = Math.min(maxY, Math.max(-maxY, cropTy.value))
}
function resetCrop() { cropScale.value = cropMinScale.value; cropTx.value = 0; cropTy.value = 0 }

/* drag & pinch */
let dragging = false, startX = 0, startY = 0, pinchStartDist = 0, pinchStartScale = 1
function distance(t1: Touch, t2: Touch) { const dx = t1.clientX - t2.clientX, dy = t1.clientY - t2.clientY; return Math.hypot(dx, dy) }
function dragStart(ev: MouseEvent | TouchEvent) {
  if (ev instanceof TouchEvent && ev.touches.length === 2) {
    pinchStartDist = distance(ev.touches[0], ev.touches[1]); pinchStartScale = cropScale.value
    window.addEventListener('touchmove', pinchMove, { passive: false })
    window.addEventListener('touchend', dragEnd, { passive: false }); return
  }
  dragging = true
  if (ev instanceof MouseEvent) {
    startX = ev.clientX; startY = ev.clientY
    window.addEventListener('mousemove', dragMove); window.addEventListener('mouseup', dragEnd)
  } else {
    startX = ev.touches[0].clientX; startY = ev.touches[0].clientY
    window.addEventListener('touchmove', dragMoveTouch, { passive: false }); window.addEventListener('touchend', dragEnd, { passive: false })
  }
}
function dragMove(ev: MouseEvent) { if (!dragging) return; cropTx.value += ev.clientX - startX; cropTy.value += ev.clientY - startY; startX = ev.clientX; startY = ev.clientY; clampTranslate() }
function dragMoveTouch(ev: TouchEvent) { if (!dragging) return; const p = ev.touches[0]; cropTx.value += p.clientX - startX; cropTy.value += p.clientY - startY; startX = p.clientX; startY = p.clientY; clampTranslate() }
function pinchMove(ev: TouchEvent) {
  if (ev.touches.length !== 2) return; ev.preventDefault()
  const d = distance(ev.touches[0], ev.touches[1]); const ratio = d / Math.max(1, pinchStartDist)
  cropScale.value = Math.min(cropMaxScale.value, Math.max(cropMinScale.value, pinchStartScale * ratio)); clampTranslate()
}
function dragEnd() { dragging = false; window.removeEventListener('mousemove', dragMove); window.removeEventListener('mouseup', dragEnd); window.removeEventListener('touchmove', dragMoveTouch); window.removeEventListener('touchmove', pinchMove as any); window.removeEventListener('touchend', dragEnd) }
function onWheel(ev: WheelEvent) { const delta = -ev.deltaY * 0.001; cropScale.value = Math.min(cropMaxScale.value, Math.max(cropMinScale.value, cropScale.value * (1 + delta))); clampTranslate() }

/** ✅ DOMRect 기반: 미리보기와 동일 영역으로 자르기 */
async function confirmCrop() {
  if (!cropImgEl.value || !cropBoxEl.value || cropping.value) return
  cropping.value = true
  try {
    const img = cropImgEl.value
    const box = cropBoxEl.value

    const imgRect = img.getBoundingClientRect()
    const boxRect = box.getBoundingClientRect()

    const scaleX = imgRect.width  / naturalW.value
    const scaleY = imgRect.height / naturalH.value

    let sx = (boxRect.left - imgRect.left) / scaleX
    let sy = (boxRect.top  - imgRect.top ) / scaleY
    let sw = boxRect.width  / scaleX
    let sh = boxRect.height / scaleY

    sx = Math.max(0, Math.min(naturalW.value - sw, sx))
    sy = Math.max(0, Math.min(naturalH.value - sh, sy))

    const canvas = document.createElement('canvas')
    canvas.width = OUT
    canvas.height = OUT
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, OUT, OUT)

    const blob: Blob = await new Promise((resolve) =>
      canvas.toBlob(b => resolve(b as Blob), 'image/jpeg', 0.9)!
    )

    const fd = new FormData()
    const hadZeroBefore = images.value.length === 0
    fd.append('kind', hadZeroBefore ? 'avatar' : 'gallery')
    fd.append('images', new File([blob], 'crop.jpg', { type: 'image/jpeg' }))

    const url = props.userId
      ? `/api/profile/images?userId=${encodeURIComponent(props.userId)}`
      : '/api/profile/images'

    const { data } = await api.post(url, fd, { headers: { 'Content-Type': 'multipart/form-data' } })

    if (hadZeroBefore) {
      const firstCreatedId = data?.created?.[0]?.id
      if (firstCreatedId) { try { await api.put('/api/profile/main', { imageId: firstCreatedId }) } catch {} }
    }

    successMsg.value = '업로드 완료'
    cropOpen.value = false
    await loadImages()
    emit('updated')
  } catch (e: any) {
    errorMsg.value = e?.response?.data?.message || e?.message || '크롭/업로드 실패'
  } finally {
    cropping.value = false
  }
}

/** ===== 뷰어 ===== */
const viewerOpen = ref(false)
const viewerIndex = ref(0)
const viewerImages = computed(() => images.value.map(i => i.urls.full))
const viewerIds = computed(() => images.value.map(i => i.id))

function openViewerAt(idx: number) {
  if (!images.value.length) return
  viewerIndex.value = Math.max(0, Math.min(idx < 0 ? 0 : idx, viewerImages.value.length - 1))
  viewerOpen.value = true
}
function closeViewer() { viewerOpen.value = false }
function prev() { viewerIndex.value = Math.max(0, viewerIndex.value - 1) }
function next() { viewerIndex.value = Math.min(viewerImages.value.length - 1, viewerIndex.value + 1) }

const draggingView = ref(false), startXView = ref(0), deltaXView = ref(0)
function onTouchStart(ev: TouchEvent) { draggingView.value = true; startXView.value = ev.touches[0].clientX; deltaXView.value = 0 }
function onTouchMove(ev: TouchEvent) { if (!draggingView.value) return; deltaXView.value = ev.touches[0].clientX - startXView.value }
function onTouchEnd() {
  if (!draggingView.value) return
  const threshold = Math.min(60, window.innerWidth * 0.15)
  if (deltaXView.value > threshold) prev()
  else if (deltaXView.value < -threshold) next()
  draggingView.value = false; deltaXView.value = 0
}
const trackStyle = computed(() => {
  const vwShift = (-viewerIndex.value * 100) + (draggingView.value ? (deltaXView.value / Math.max(1, window.innerWidth)) * 100 : 0)
  return { transform: `translateX(${vwShift}vw)`, transition: draggingView.value ? 'none' : 'transform 300ms ease' }
})

/* 대표 설정 */
const settingMain = ref(false)
const viewerNotice = ref('')
const isCurrentViewerMain = computed(() => viewerIds.value[viewerIndex.value] === mainId.value)
async function setAsMain() {
  const id = viewerIds.value[viewerIndex.value]
  if (!id || settingMain.value) return
  settingMain.value = true
  try {
    await api.put('/api/profile/main', { imageId: id })
    profileMain.value = id
    viewerNotice.value = '대표 사진이 변경되었습니다.'
    setTimeout(() => (viewerNotice.value = ''), 1500)
    emit('main-changed', id)
  } catch (e: any) {
    viewerNotice.value = e?.response?.data?.message || '대표 설정 실패'
    setTimeout(() => (viewerNotice.value = ''), 1800)
  } finally {
    settingMain.value = false
  }
}

/** ===== 삭제 모달 ===== */
const confirmOpen = ref(false)
const confirmTarget = ref<ProfileImage | null>(null)
function askDelete(img: ProfileImage) { confirmTarget.value = img; confirmOpen.value = true }
function closeConfirm() { confirmOpen.value = false; confirmTarget.value = null }
async function doDelete() {
  if (!confirmTarget.value) return
  try {
    const url = props.userId
      ? `/api/profile/images/${confirmTarget.value.id}?userId=${encodeURIComponent(props.userId)}`
      : `/api/profile/images/${confirmTarget.value.id}`
    await api.delete(url)
    await loadImages()
    emit('updated')
  } catch (err: any) {
    errorMsg.value = err?.response?.data?.message || err?.message || '삭제 실패'
  } finally {
    closeConfirm()
  }
}

/** ===== 오버레이 열림 감지 → 배경 스크롤 잠금 ===== */
const anyOverlayOpen = computed(
  () => selectorOpen.value || confirmOpen.value || viewerOpen.value || cropOpen.value
)
watch(anyOverlayOpen, (on) => {
  if (on) {
    document.documentElement.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'
    document.body.style.touchAction = 'none'
    document.body.style.overscrollBehavior = 'contain'
  } else {
    document.documentElement.style.overflow = ''
    document.body.style.overflow = ''
    document.body.style.touchAction = ''
    document.body.style.overscrollBehavior = ''
  }
})

/** ===== 키보드 ===== */
function onKey(e: KeyboardEvent) {
  if (cropOpen.value) { if (e.key === 'Escape') closeCrop(); return }
  if (!viewerOpen.value) return
  if (e.key === 'Escape') closeViewer()
  if (e.key === 'ArrowLeft') prev()
  if (e.key === 'ArrowRight') next()
}
onMounted(async () => {
  await loadImages()
  window.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<style scoped>
.photo-manager { width: 100%; }

/* 상단 대표 */
.wrap { max-width: 520px; margin: 12px auto 0; }
.row  { display: flex; align-items: center; justify-content: center; }
.avatar {
  display: block; width: 100%; max-width: 180px; aspect-ratio: 1/1;
  object-fit: cover; border-radius: 16px; background: #111; margin: 0 auto; cursor: pointer;
}

/* ── 오버레이: 최상단, 화면 꽉 채우기, 내부 스크롤 ────────────── */
.selector,
.confirm,
.lightbox,
.cropper {
  position: fixed;
  inset: 0;
  z-index: 2147483647; /* 어떤 상단/하단 패널보다 위 */
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: auto;
  padding: calc(env(safe-area-inset-top) + 10px) 14px calc(env(safe-area-inset-bottom) + 14px);
  background: rgba(0,0,0,0.45);
}
.lightbox { background: rgba(0,0,0,0.88); }

/* 카드(팝업 내용)는 뷰포트 안으로 제한 */
.selector-card,
.confirm-card,
.crop-card {
  width: min(96vw, 620px);
  max-height: calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 20px);
  overflow: auto;

  background: #fff; color: #000;
  border-radius: 14px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.18);
  padding: 12px;
}

/* 선택 팝업 */
.selector-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.selector-close { width: 34px; height: 34px; border-radius: 999px; border: 0; background: #bcbcbc; color: #fff; font-size: 20px; cursor: pointer; }

/* ✅ 4열 그리드(보이는 슬롯만) */
.slot-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px 8px; padding: 6px 2px; }
.slot { display: flex; flex-direction: column; gap: 6px; }
.slot-img, .slot-empty {
  width: 100%; aspect-ratio: 1/1; border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
  background: #f7f7f7; border: 1px dashed #ddd; color: #888;
}
.slot-box { position: relative; }
.slot-img { object-fit: cover; display: block; cursor: zoom-in; }
.badge-main{ position: absolute; left: 6px; top: 6px; padding: 2px 6px; border-radius: 999px; background: #111; color: #fff; font-size: 12px; font-weight: 800; box-shadow: 0 2px 6px rgba(0,0,0,0.25); }
.slot-del { position: absolute; right: 6px; top: 6px; width: 26px; height: 26px; border-radius: 999px; border: 0; background: rgba(0,0,0,0.55); color: #fff; font-size: 18px; line-height: 26px; cursor: pointer; }
.slot-empty { font-size: 28px; cursor: pointer; }

/* 삭제 모달 */
.confirm-title { margin: 0 0 12px; font-weight: 800; }
.confirm-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.btn { height: 44px; border-radius: 12px; border: 0; background: #eaeaea; color: #000; font-weight: 700; cursor: pointer; }
.btn.danger { background: #ffb4ab; color: #000; }
.btn.ghost { background: #f3f3f3; color: #333; }
.btn.primary { background: #ffd166; color: #000; }

/* 라이트박스 */
.viewer-close { position: fixed; top: 10px; right: 12px; width: 40px; height: 40px; border-radius: 999px; border: 0; background: rgba(255,255,255,0.18); color: #fff; font-size: 26px; cursor: pointer; }
.carousel { position: relative; width: 100vw; height: 86vh; overflow: hidden; }
.track { height: 100%; display: flex; }
.slide { flex: 0 0 100vw; height: 100%; display: flex; align-items: center; justify-content: center; }
.slide-img { max-width: 92vw; max-height: 86vh; object-fit: contain; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.4); }
.nav { position: fixed; top: 50%; transform: translateY(-50%); width: 44px; height: 44px; border-radius: 999px; border: 0; background: rgba(255,255,255,0.18); color: #fff; font-size: 28px; cursor: pointer; }
.nav.prev { left: 12px; } .nav.next { right: 12px; }
.pager { position: fixed; bottom: 12px; left: 50%; transform: translateX(-50%); color: #fff; background: rgba(0,0,0,0.35); padding: 4px 10px; border-radius: 999px; font-weight: 700; }
.set-main { position: fixed; left: 12px; bottom: 12px; height: 40px; padding: 0 14px; border: 0; border-radius: 12px; font-weight: 800; cursor: pointer; background: #ffd166; color: #000; }
.set-main:disabled { opacity: 0.7; cursor: default; }
.viewer-back { position: fixed; right: 12px; bottom: 12px; height: 40px; padding: 0 14px; border: 0; border-radius: 12px; font-weight: 800; cursor: pointer; background: rgba(255,255,255,0.2); color: #fff; }
.toast { position: fixed; bottom: 62px; left: 50%; transform: translateX(-50%); background: rgba(0,0,0,0.7); color: #fff; padding: 6px 12px; border-radius: 999px; font-weight: 700; }

/* 크롭 모달 */
.crop-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.crop-close { width: 34px; height: 34px; border-radius: 999px; border: 0; background: #bcbcbc; color: #fff; font-size: 20px; cursor: pointer; }

/* 크롭 박스: 화면 높이에 맞춘 정사각(툴바/버튼 영역 여유 포함) */
.crop-box {
  --square-by-width: min(92vw, 300px);
  --square-by-height: calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 320px);
  width: min(var(--square-by-width), var(--square-by-height));
  height: min(var(--square-by-width), var(--square-by-height));
  margin: 0 auto;

  position: relative;
  overflow: hidden;
  background: #000;
  border-radius: 14px;

  touch-action: none;
  overscroll-behavior: contain;
}
.crop-img { position: absolute; left: 50%; top: 50%; transform-origin: center center; will-change: transform; user-select: none; -webkit-user-drag: none; }
.mask { position: absolute; inset: 0; pointer-events: none; box-shadow: inset 0 0 0 2px rgba(255,255,255,0.9); border-radius: 14px; }

/* 컨트롤 */
.crop-controls { margin-top: 12px; display: grid; gap: 10px; }
.crop-controls label { font-size: 14px; color: #333; }
.crop-controls input[type="range"] { width: 100%; }

/* 하단 버튼을 한 줄(3열)로 고정 */
.crop-controls .ctrl-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr); /* 세 개 버튼을 같은 비율 */
  gap: 10px;
  align-items: center;
}
.crop-controls .btn { white-space: nowrap; }
.crop-controls .right-group { display: contents; } /* 두 버튼을 각 칸에 배치 */

/* 초기화 버튼 (구분용) */
.btn.reset {
  background: #e0f0ff;   /* 파스텔 블루 */
  color: #0057a3;
}
.btn.reset:hover {
  background: #cce5ff;
}

</style>
