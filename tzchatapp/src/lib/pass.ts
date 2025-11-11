// src/lib/pass.ts
import { Capacitor } from '@capacitor/core'

/**
 * API 베이스 URL (VITE_API_BASE_URL 우선)
 */
export function getApiBase() {
  const base =
    import.meta.env.VITE_API_BASE_URL ||
    `${location.protocol}//${location.host}`
  return base.replace(/\/+$/, '')
}

/**
 * 현재 환경 판별 헬퍼
 */
export function isNative() {
  return Capacitor.isNativePlatform()
}
export function isLocalHost() {
  return !isNative() && ['localhost', '127.0.0.1'].includes(location.hostname)
}

/**
 * 로컬 개발환경(웹)에서는 수동 PASS(Manual)를 사용
 * - 앱(네이티브)에선 항상 외부 브라우저 + status 폴링 방식(방법 A)
 */
export function shouldUseManual() {
  return isLocalHost()
}

/**
 * (레거시 호환) PASS 시작 URL을 구성합니다.
 * - 웹 팝업/새창 방식에서 사용되던 형태로, 서버가 HTML 폼을 바로 내보내게 합니다(mode=html).
 * - 로컬 웹 환경에선 passmanual 엔드포인트를, 그 외엔 정상 pass 엔드포인트를 가리킵니다.
 *
 * ⚠️ 앱(네이티브)에서는 이 URL을 직접 여는 방식이 아니라,
 *    `startPass()`를 호출하여 `{ startUrl }`을 받아 외부 브라우저로 여는 방식을 쓰세요.
 */
export function resolvePassStartUrl(intent = 'unified') {
  const API_BASE = getApiBase()
  const base = shouldUseManual()
    ? `${API_BASE}/api/auth/passmanual/start`
    : `${API_BASE}/api/auth/pass/start`
  const query = `mode=html&intent=${encodeURIComponent(intent)}`
  return `${base}?${query}`
}

/**
 * 신규 권장 API — PASS 시작 요청
 * - 앱(네이티브/하이브리드): 서버에 preferUrl=1 로 POST → { txId, startUrl } 수신
 *   받은 startUrl을 Capacitor Browser로 열고, 클라이언트는 /status 폴링
 * - 로컬 웹(개발): 수동 PASS 화면으로 라우팅하도록 manual 플래그를 반환
 *
 * 사용 예:
 *   const { txId, startUrl, manual, manualPath } = await startPass('unified');
 *   if (manual) router.replace({ name: 'PassManual' }); else Browser.open({ url: startUrl });
 */
export async function startPass(
  intent: string = 'unified',
  opts?: {
    preferUrl?: boolean  // 기본: 네이티브면 true, 웹은 false(=레거시도 허용)
    signal?: AbortSignal
    // 향후 확장을 위한 옵션 자리
  }
): Promise<{
  ok: boolean
  txId: string | null
  startUrl?: string          // 앱/외부브라우저에서 열 URL
  formHtml?: string          // (레거시) 웹 팝업 주입용
  manual?: boolean           // 로컬 수동 PASS 사용 여부
  manualPath?: string        // 수동 PASS로 보낼 라우트 힌트
  code?: string
  message?: string
}> {
  const API_BASE = getApiBase()

  // 로컬 웹 개발환경은 수동 PASS로 안내
  if (shouldUseManual()) {
    return {
      ok: true,
      txId: null,
      manual: true,
      manualPath: '/pass/manual',
    }
  }

  // 네이티브(또는 의도적으로 preferUrl 지정) → URL 캐싱 방식으로 요청
  const preferUrl =
    typeof opts?.preferUrl === 'boolean'
      ? opts.preferUrl
      : isNative() // 기본값: 네이티브면 true
  try {
    const resp = await fetch(`${API_BASE}/api/auth/pass/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      signal: opts?.signal,
      body: JSON.stringify({ intent, preferUrl }),
    })
    const text = await resp.text()
    let json: any
    try {
      json = JSON.parse(text)
    } catch {
      return { ok: false, txId: null, code: 'START_NON_JSON', message: text.slice(0, 200) }
    }

    if (!resp.ok || !json?.ok) {
      return {
        ok: false,
        txId: null,
        code: json?.code || 'START_ERROR',
        message: json?.message || 'pass start failed',
      }
    }

    // 서버는 preferUrl=true일 때 { txId, startUrl }을, 아니면 { txId, formHtml }도 줄 수 있음
    return {
      ok: true,
      txId: json.txId || null,
      startUrl: json.startUrl,
      formHtml: json.formHtml, // 레거시 팝업 방식 대비
    }
  } catch (e: any) {
    return { ok: false, txId: null, code: 'START_FETCH_ERROR', message: String(e?.message || e) }
  }
}
