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

/** ✅ /api/me 단일 진행 + TTL 캐시(여러 컴포넌트에서 동시에 호출해도 1번만 나가게) */
const _meCache = {
  checkedAt: 0,
  user: null as MeUser | null,
  inflight: null as Promise<MeUser | null> | null,
}
const ME_CACHE_TTL_MS = 30_000

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
      const nu = withWalletDefaults(u)
      this.user = nu
      // ✅ 캐시도 함께 최신화
      _meCache.user = nu
      _meCache.checkedAt = Date.now()
    },

    clear() {
      this.user = null
      this.error = ''
      this.loading = false
      this._socketBound = false

      // ✅ 캐시 초기화
      _meCache.checkedAt = 0
      _meCache.user = null
      _meCache.inflight = null

      if (_walletRefreshTimer) {
        clearTimeout(_walletRefreshTimer)
        _walletRefreshTimer = null
      }
    },

    /**
     * ✅ /api/me 호출로 최신 사용자 정보 동기화
     * - 여러 곳에서 동시에 호출되어도 inflight 공유로 1번만 요청
     * - TTL 내면 캐시 반환
     * - 실패해도 "기존 user를 null로 지우지 않음" (401일 때만 clear 성격)
     */
    async fetchMe(opts?: { force?: boolean; silent?: boolean }): Promise<MeUser | null> {
      const force = !!opts?.force
      const silent = !!opts?.silent

      const now = Date.now()
      if (!force && _meCache.checkedAt && now - _meCache.checkedAt < ME_CACHE_TTL_MS) {
        // 캐시가 있으면 즉시 반환
        if (_meCache.user) {
          // 스토어에도 반영(혹시 다른 곳에서 setUser 안된 경우)
          if (!this.user || this.user._id !== _meCache.user._id) {
            this.user = _meCache.user
          }
        }
        return _meCache.user
      }

      // 이미 진행중이면 그 promise를 공유
      if (_meCache.inflight) {
        try {
          const u = await _meCache.inflight
          return u
        } catch {
          return _meCache.user ?? this.user
        }
      }

      _meCache.inflight = (async () => {
        try {
          if (!silent) {
            this.loading = true
            this.error = ''
          }

          const res = await api.get('/api/me', { withCredentials: true })
          const u = withWalletDefaults(extractUser(res?.data))
          if (!u?._id) throw new Error('NO_USER')

          // 성공: user & cache 갱신
          this.setUser(u)
          return u
        } catch (e: any) {
          const status = e?.response?.status
          const msg = e?.response?.data?.error || e?.message || 'ME_ERROR'

          // ✅ 401(인증 만료)일 때만 user 제거 성격
          if (status === 401) {
            this.error = msg
            this.user = null
            _meCache.user = null
            _meCache.checkedAt = Date.now()
            return null
          }

          // ✅ 그 외 네트워크/서버 오류는 user 유지 (UX: 깜빡임 방지)
          this.error = msg

          // 캐시 시간만 갱신해 “짧은 시간 연속 호출 폭주” 방지
          _meCache.checkedAt = Date.now()

          // 현재 user(혹은 캐시) 유지
          return this.user ?? _meCache.user
        } finally {
          if (!silent) this.loading = false
          _meCache.inflight = null
        }
      })()

      return await _meCache.inflight
    },

    /** 임시 결제 성공 직후 등급만 빠르게 반영(낙관적 업데이트) */
    applyLevel(level: UserLevel) {
      if (!this.user) return
      this.user = { ...this.user, user_level: level }
      // 캐시도 동기화
      _meCache.user = this.user
      _meCache.checkedAt = Date.now()
    },

    /** 결제 후 보수적 재동기화(백엔드 반영 상태 확인) */
    async refreshAfterPurchase() {
      // 결제 직후는 최신이 중요하니 force
      return await this.fetchMe({ force: true })
    },

    /** ✅ 하트/별/루비 부분 갱신용 (반응형 보장) */
    updateWallet(partial: Partial<Wallet>) {
      if (!this.user) return
      const current = this.user.wallet ?? { heart: 0, star: 0, ruby: 0 }
      const updated = { ...current, ...partial }
      this.user = { ...this.user, wallet: updated }

      // 캐시도 동기화
      _meCache.user = this.user
      _meCache.checkedAt = Date.now()
    },

    /** 내부 사용: 현재 wallet을 기본값 포함해 가져오고 반응형 객체로 유지 */
    ensureWallet(): Wallet | null {
      if (!this.user) return null
      const base = { heart: 0, star: 0, ruby: 0 }
      const w = { ...base, ...(this.user.wallet ?? {}) }
      this.user = { ...this.user, wallet: w }
      _meCache.user = this.user
      _meCache.checkedAt = Date.now()
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
          // force는 과할 수 있으니 silent로 백그라운드
          await this.fetchMe({ silent: true })
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
        else await this.fetchMe({ silent: true })
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
        else await this.fetchMe({ silent: true })
      } catch (e) {
        this.updateWallet({ ruby: prev })
        throw e
      } finally {
        this.refreshWalletSoon(500)
      }
    },

    /** 서버에서 지갑만 빠르게 재동기화 하고 싶을 때 */
    async refreshWallet() {
      const u = await this.fetchMe({ silent: true })
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
     * - connect에서 fetchMe를 await로 막지 않게 + TTL/캐시로 부담 감소
     */
    bindSocket(io: any) {
      if (this._socketBound || !io) return
      this._socketBound = true

      const applyWalletFromPayload = (payload: any) => {
        if (!payload) return
        if (payload.wallet) {
          this.updateWallet(payload.wallet)
        } else if (
          typeof payload.heart === 'number' ||
          typeof payload.star === 'number' ||
          typeof payload.ruby === 'number'
        ) {
          this.updateWallet(payload as Partial<Wallet>)
        }
      }

      io.on('connect', () => {
        // ✅ 재연결 직후 정합성은 "백그라운드(silent)"로만
        // (TTL 캐시가 있어 폭주 방지)
        try { this.fetchMe({ silent: true }) } catch {}
      })

      io.on('wallet:update', (data: any) => {
        applyWalletFromPayload(data)
      })

      io.on('me:update', (data: any) => {
        const u = withWalletDefaults(extractUser(data))
        if (u) {
          this.setUser(u)
        } else {
          applyWalletFromPayload(data)
        }
      })

      io.on('purchase:confirmed', (data: any) => {
        const u = withWalletDefaults(extractUser(data))
        if (u?.user_level) this.applyLevel(u.user_level)
        applyWalletFromPayload(u ?? data)

        // 결제 확정은 최신이 중요 → force(하지만 silent로 UX 막지 않음)
        try { this.fetchMe({ force: true, silent: true }) } catch {}
      })
    },
  },
})
