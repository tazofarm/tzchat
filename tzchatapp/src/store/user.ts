import { defineStore } from 'pinia'
import api from '@/lib/api'

export type UserLevel = '베타회원' | '일반회원' | '라이트회원' | '프리미엄회원'
export type UserRole = 'user' | 'master'
export type Gender = 'male' | 'female' | '남성' | '여성' | '' | null | undefined

export interface Wallet {
  heart: number
  star: number
  ruby: number
}

export interface MeUser {
  _id: string
  username?: string
  nickname: string
  role: UserRole
  gender?: Gender
  user_level: UserLevel
  suspended?: boolean
  wallet?: Wallet
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
    (payload && typeof payload === 'object' && ('_id' in payload || 'user' in payload)
      ? payload.user ?? payload
      : null)
  return user ?? null
}

function withWalletDefaults(u: MeUser | null): MeUser | null {
  if (!u) return u
  const base = { heart: 0, star: 0, ruby: 0 }
  const wallet = { ...base, ...(u.wallet ?? {}) }
  return { ...u, wallet }
}

/** 지연 재동기화를 위한 모듈 스코프 타이머 (중복 호출 디바운스) */
let _walletRefreshTimer: number | null = null

export const useUserStore = defineStore('user', {
  state: () => ({
    user: null as MeUser | null,
    loading: false as boolean,
    error: '' as string,

    // 소켓 바인딩 상태
    _socketBound: false as boolean,
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
      this.user = withWalletDefaults(u)
    },

    clear() {
      this.user = null
      this.error = ''
      this.loading = false
      this._socketBound = false
      if (_walletRefreshTimer) {
        clearTimeout(_walletRefreshTimer)
        _walletRefreshTimer = null
      }
    },

    /** /api/me 호출로 최신 사용자 정보 동기화 */
    async fetchMe() {
      try {
        this.loading = true
        this.error = ''
        const res = await api.get('/api/me', { withCredentials: true })
        const u = withWalletDefaults(extractUser(res?.data))
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

    /** ✅ 하트/별/루비 부분 갱신용 (반응형 보장) */
    updateWallet(partial: Partial<Wallet>) {
      if (!this.user) return
      const current = this.user.wallet ?? { heart: 0, star: 0, ruby: 0 }
      const updated = { ...current, ...partial }
      this.user = { ...this.user, wallet: updated }
    },

    /** 내부 사용: 현재 wallet을 기본값 포함해 가져오고 반응형 객체로 유지 */
    ensureWallet(): Wallet | null {
      if (!this.user) return null
      const base = { heart: 0, star: 0, ruby: 0 }
      const w = { ...base, ...(this.user.wallet ?? {}) }
      this.user = { ...this.user, wallet: w }
      return w
    },

    /** ✅ 하트 소진(낙관적 업데이트 + 실패시 롤백) */
    async spendHeart(count = 1) {
      if (!this.user) return
      const w = this.ensureWallet()!
      const prev = w.heart
      const next = Math.max(0, prev - count)

      // 1) 즉시 반영
      this.updateWallet({ heart: next })

      try {
        // 2) 서버 확정
        const res = await api.post(
          '/api/wallet/spend',
          { heart: count },
          { withCredentials: true }
        )

        // 3) 서버 응답 동기화
        const u = extractUser(res?.data)
        if (u?.wallet) {
          this.updateWallet(u.wallet)
        } else if (res?.data?.wallet) {
          this.updateWallet(res.data.wallet)
        } else {
          await this.fetchMe()
        }
      } catch (e) {
        // 4) 실패 시 롤백
        this.updateWallet({ heart: prev })
        throw e
      } finally {
        // 5) 네트워크 레이스 대비: 약간의 지연 후 재검증
        this.refreshWalletSoon(500)
      }
    },

    async spendStar(count = 1) {
      if (!this.user) return
      const w = this.ensureWallet()!
      const prev = w.star
      const next = Math.max(0, prev - count)
      this.updateWallet({ star: next })
      try {
        const res = await api.post('/api/wallet/spend', { star: count }, { withCredentials: true })
        const u = extractUser(res?.data)
        if (u?.wallet) this.updateWallet(u.wallet)
        else if (res?.data?.wallet) this.updateWallet(res.data.wallet)
        else await this.fetchMe()
      } catch (e) {
        this.updateWallet({ star: prev })
        throw e
      } finally {
        this.refreshWalletSoon(500)
      }
    },

    async spendRuby(count = 1) {
      if (!this.user) return
      const w = this.ensureWallet()!
      const prev = w.ruby
      const next = Math.max(0, prev - count)
      this.updateWallet({ ruby: next })
      try {
        const res = await api.post('/api/wallet/spend', { ruby: count }, { withCredentials: true })
        const u = extractUser(res?.data)
        if (u?.wallet) this.updateWallet(u.wallet)
        else if (res?.data?.wallet) this.updateWallet(res.data.wallet)
        else await this.fetchMe()
      } catch (e) {
        this.updateWallet({ ruby: prev })
        throw e
      } finally {
        this.refreshWalletSoon(500)
      }
    },

    /** 서버에서 지갑만 빠르게 재동기화 하고 싶을 때 */
    async refreshWallet() {
      const u = await this.fetchMe()
      if (u?.wallet) this.updateWallet(u.wallet)
      return u?.wallet ?? null
    },

    /** ✅ 지갑 재동기화를 지연 예약(중복 호출 디바운스) */
    refreshWalletSoon(delay = 500) {
      if (_walletRefreshTimer) {
        clearTimeout(_walletRefreshTimer)
        _walletRefreshTimer = null
      }
      _walletRefreshTimer = window.setTimeout(async () => {
        try { await this.refreshWallet() }
        finally {
          if (_walletRefreshTimer) {
            clearTimeout(_walletRefreshTimer)
            _walletRefreshTimer = null
          }
        }
      }, delay) as unknown as number
    },

    /** ✅ 하트 소비 직후 정합성 재검증을 예약 (별칭) */
    confirmWalletAfterSpend(delay = 500) {
      this.refreshWalletSoon(delay)
    },

    /**
     * ✅ 소켓 바인딩: 서버 푸시를 받아 즉시 반영
     * - io: Socket.IO client 인스턴스 (예: import io from '@/lib/socket')
     * - 이벤트 이름은 서버와 맞춰 변경하세요.
     */
    bindSocket(io: any) {
      if (this._socketBound || !io) return
      this._socketBound = true

      const applyWalletFromPayload = (payload: any) => {
        if (!payload) return
        if (payload.wallet) {
          // payload가 user 또는 {wallet} 형태
          this.updateWallet(payload.wallet)
        } else if (
          typeof payload.heart === 'number' ||
          typeof payload.star === 'number' ||
          typeof payload.ruby === 'number'
        ) {
          this.updateWallet(payload as Partial<Wallet>)
        }
      }

      // 연결/재연결 시 내 정보 최신화(옵션)
      io.on('connect', () => {
        // 재연결 후 서버 상태와 diff가 있으면 정합성 확보
        this.fetchMe()
      })

      // 서버가 지갑만 내려주는 경우
      io.on('wallet:update', (data: any) => {
        applyWalletFromPayload(data)
      })

      // 서버가 전체 사용자 변경을 내려주는 경우
      io.on('me:update', (data: any) => {
        const u = extractUser(data)
        if (u) {
          this.setUser(u)
        } else {
          applyWalletFromPayload(data)
        }
      })

      // 결제 확정 같은 별도 이벤트가 있는 경우
      io.on('purchase:confirmed', (data: any) => {
        const u = extractUser(data)
        if (u?.user_level) this.applyLevel(u.user_level)
        applyWalletFromPayload(u ?? data)
      })

      // 필요시 언바인드 함수도 제공 가능
      // io.on('disconnect', () => { ... })
    },
  },
})
