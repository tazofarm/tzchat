<!-- src/components/03050_pages/1_alluser.vue -->
<template>
  <ion-page>
    <ion-content>
      <!-- 에러 -->
      <ion-text v-if="errorMessage" color="danger">
        <p class="ion-text-center">{{ errorMessage }}</p>
      </ion-text>

      <!-- 스와이프 리스트 (공용 컴포넌트) -->
      <SwapeList
        v-else
        :users="users"
        :is-loading="loading"
        :viewer-level="viewerLevel"
        :is-premium="isPremium"
        @userClick="onCardTapById"
      />
    </ion-content>
  </ion-page>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '@/lib/api'
import { IonPage, IonContent, IonText } from '@ionic/vue'

/** ✅ 공용 스와이프 리스트 컴포넌트 */
import SwapeList from '@/components/02010_minipage/mini_list/swapeList.vue'

const router = useRouter()

const users = ref([])
const nickname = ref('')
const viewerLevel = ref('')   // '일반회원' | '여성회원' | '프리미엄' 등
const isPremium = ref(false)   // 명시적으로 전달
const loading = ref(true)
const errorMessage = ref('')

/* ===================== 혼합콘텐츠/로컬호스트 URL 보정 ===================== */
/** 프론트·백 양쪽 어디에서 오든 안전한 퍼블릭 원점 계산 */
function getApiOrigin () {
  const envBase =
    (import.meta.env.VITE_API_FILE_BASE || import.meta.env.VITE_API_BASE_URL || '').toString().trim()
  const candidate = envBase || (api?.defaults?.baseURL) || window.location.origin
  let u
  try { u = new URL(candidate, window.location.origin) } catch { u = new URL(window.location.origin) }
  // https 페이지에서 http면 우선 https로 승격
  if (window.location.protocol === 'https:' && u.protocol === 'http:') {
    try { u = new URL(`https://${u.host}`) } catch {}
  }
  return u
}
const API_ORIGIN = getApiOrigin()

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1'])
function isLikelyLocalHost (h) {
  if (!h) return false
  if (LOCAL_HOSTNAMES.has(h)) return true
  if (h.endsWith('.local')) return true
  return false
}

/** 절대/상대/프로토콜상대 URL → 혼합콘텐츠 없는 절대 URL */
function toAbsolute (u) {
  if (!u) return ''
  // 절대/데이터/블롭
  if (/^(https?:|data:|blob:)/i.test(u)) {
    try {
      const p = new URL(u)
      // 로컬/내부 개발 호스트면 API_ORIGIN으로 치환 (경로 유지)
      if (isLikelyLocalHost(p.hostname)) {
        return `${API_ORIGIN.origin}${p.pathname}${p.search}${p.hash}`
      }
      // https 페이지에서 http면 가능한 승격 또는 원점 치환
      if (window.location.protocol === 'https:' && p.protocol === 'http:') {
        if (p.hostname === API_ORIGIN.hostname) {
          p.protocol = 'https:'
          return p.toString()
        }
        return `${API_ORIGIN.origin}${p.pathname}${p.search}${p.hash}`
      }
      return p.toString()
    } catch {
      // 파싱 실패 시 아래 상대경로 처리
    }
  }
  // //host/path
  if (u.startsWith('//')) return `${API_ORIGIN.protocol}${u}`
  // /path
  if (u.startsWith('/')) return `${API_ORIGIN.origin}${u}`
  // path
  return `${API_ORIGIN.origin}/${u}`
}

/** 다양한 백엔드 응답 스키마에서 대표 이미지 1개를 뽑아 displayImage로 세팅 */
function pickDisplayImage (user) {
  // 1) profileImages [{urls:{thumb/medium/full}}]
  const A = user?.profileImages
  if (Array.isArray(A) && A.length) {
    const first = A[0]
    const src = first?.urls?.medium || first?.urls?.full || first?.urls?.thumb || first?.url
    if (src) return toAbsolute(src)
  }
  // 2) images: ['...'] or [{url,thumb,full}]
  const B = user?.images
  if (Array.isArray(B) && B.length) {
    const x = B[0]
    if (typeof x === 'string') return toAbsolute(x)
    if (typeof x === 'object') {
      const src = x.medium || x.full || x.thumb || x.url
      if (src) return toAbsolute(src)
    }
  }
  // 3) profileImage / mainImage / avatar / photo
  const keys = ['profileImage', 'mainImage', 'avatar', 'photo', 'thumb', 'image']
  for (const k of keys) {
    if (user?.[k]) return toAbsolute(user[k])
  }
  // 4) nested: user.profile?.image 등
  const nested = user?.profile?.image || user?.profile?.avatar || user?.profile?.photo
  if (nested) return toAbsolute(nested)
  // 5) 없음
  return ''
}

/** 리스트 내 모든 이미지 필드들을 절대경로로 보정 */
function normalizeUser (u) {
  const copy = { ...u }
  // 대표 이미지
  copy.displayImage = pickDisplayImage(u)

  // 흔한 필드들 정규화
  if (copy.profileImage) copy.profileImage = toAbsolute(copy.profileImage)
  if (copy.mainImage) copy.mainImage = toAbsolute(copy.mainImage)
  if (copy.avatar) copy.avatar = toAbsolute(copy.avatar)
  if (copy.photo) copy.photo = toAbsolute(copy.photo)

  // 배열 필드
  if (Array.isArray(copy.images)) {
    copy.images = copy.images.map(x => {
      if (typeof x === 'string') return toAbsolute(x)
      if (x && typeof x === 'object') {
        return {
          ...x,
          url: toAbsolute(x.url),
          thumb: toAbsolute(x.thumb),
          medium: toAbsolute(x.medium),
          full: toAbsolute(x.full),
        }
      }
      return x
    })
  }
  if (Array.isArray(copy.profileImages)) {
    copy.profileImages = copy.profileImages.map(img => ({
      ...img,
      url: toAbsolute(img?.url),
      thumb: toAbsolute(img?.thumb || img?.urls?.thumb),
      medium: toAbsolute(img?.medium || img?.urls?.medium),
      full: toAbsolute(img?.full || img?.urls?.full),
      urls: {
        ...img?.urls,
        thumb: toAbsolute(img?.urls?.thumb),
        medium: toAbsolute(img?.urls?.medium),
        full: toAbsolute(img?.urls?.full),
      }
    }))
  }

  return copy
}
/* =================== /혼합콘텐츠/로컬호스트 URL 보정 =================== */

onMounted(async () => {
  try {
    // 1) 내 정보 조회
    const resMe = await api.get('/api/me')
    const me = resMe.data?.user || {}
    nickname.value = me?.nickname || ''

    // 등급/프리미엄 여부 설정 (백엔드 필드 다양성 대응)
    const levelFromApi =
      me?.level ||
      me?.user_level ||
      me?.membership ||
      ''

    viewerLevel.value = String(levelFromApi || '').trim()

    const premiumBool =
      me?.isPremium ??
      me?.premium ??
      (String(levelFromApi || '').trim() === '프리미엄')

    isPremium.value = Boolean(premiumBool)

    // 2) 타겟 검색 라우터 사용 (target과 동일한 기준)
    const regions = Array.isArray(me?.search_regions) ? me.search_regions : []
    const resUsers = await api.post('/api/search/users', { regions })

    // 응답 형태: [] 또는 { users: [] } 모두 대응
    const list = Array.isArray(resUsers.data)
      ? resUsers.data
      : Array.isArray(resUsers.data?.users)
        ? resUsers.data.users
        : []

    // ✅ 여기서 URL 보정 수행 후 리스트 적용
    users.value = list.map(normalizeUser)
  } catch (e) {
    console.error('❌ 유저 목록 로딩 실패:', e)
    errorMessage.value = '유저 목록을 불러오지 못했습니다.'
  } finally {
    loading.value = false
  }
})

const onCardTapById = (userId) => {
  if (!userId) return
  router.push(`/home/user/${userId}`)
}
</script>

<style scoped>
/* 페이지 공통 배경 */
ion-content{
  --background:#000;
  --padding-top: 0;
  --padding-bottom: 0;
  color:#fff;
  padding:0;
  overscroll-behavior:none;
}
</style>
