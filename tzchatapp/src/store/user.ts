import { defineStore } from 'pinia'
import api from '@/lib/api'

export type UserLevel = '베타회원' | '일반회원' | '라이트회원' | '프리미엄회원'
export type UserRole = 'user' | 'master'
export type Gender = 'male' | 'female' | '남성' | '여성' | '' | null | undefined

export interface MeUser {
  _id: string
  username?: string
  nickname: string
  role: UserRole
  gender?: Gender
  user_level: UserLevel
  suspended?: boolean
  [key: string]: any
}

type MeResponse =
  | { ok: true; user: MeUser }
  | { success: true; data: { user: MeUser } }
  | { user: MeUser }
  | any

function extractUser(payload: MeResponse): MeUser | null {
  const user =
    payload?.user ??
    payload?.data?.user ??
    (payload && typeof payload === 'object' && ('_id' in payload || 'user' in payload) ? payload.user ?? payload : null)
  return user ?? null
}

export const useUserStore = defineStore('user', {
  state: () => ({
    user: null as MeUser | null,
    loading: false as boolean,
    error: '' as string,
  }),

  getters: {
    isAuthed: (s) => !!s.user?._id,
    isMaster: (s) => String(s.user?.role || '').toLowerCase() === 'master',
    levelLabel: (s) => s.user?.user_level ?? '베타회원',
    genderSimple: (s): 'male' | 'female' => {
      const g = String(s.user?.gender || '').toLowerCase()
      if (g.includes('여') || g === 'female') return 'female'
      return 'male'
    },
  },

  actions: {
    setUser(u: MeUser | null) {
      this.user = u
    },
    clear() {
      this.user = null
      this.error = ''
      this.loading = false
    },

    /** /api/me 호출로 최신 사용자 정보 동기화 */
    async fetchMe() {
      try {
        this.loading = true
        this.error = ''
        const res = await api.get('/api/me', { withCredentials: true })
        const u = extractUser(res?.data)
        if (!u?._id) throw new Error('NO_USER')
        this.user = u
        return u
      } catch (e: any) {
        this.error = e?.response?.data?.error || e?.message || 'ME_ERROR'
        this.user = null
        return null
      } finally {
        this.loading = false
      }
    },

    /** 임시 결제 성공 직후 등급만 빠르게 반영(낙관적 업데이트) */
    applyLevel(level: UserLevel) {
      if (!this.user) return
      this.user = { ...this.user, user_level: level }
    },

    /** 결제 후 보수적 재동기화(백엔드 반영 상태 확인) */
    async refreshAfterPurchase() {
      return await this.fetchMe()
    },
  },
})
