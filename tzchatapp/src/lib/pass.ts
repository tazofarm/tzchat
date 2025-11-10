// src/lib/pass.ts
import { Capacitor } from '@capacitor/core'

export function resolvePassStartUrl(intent = 'unified') {
  const API_BASE =
    import.meta.env.VITE_API_BASE_URL ||
    `${location.protocol}//${location.host}`

  const isNative = Capacitor.isNativePlatform()
  const isLocalHost = !isNative && ['localhost', '127.0.0.1'].includes(location.hostname)
  const useManual = !isNative && isLocalHost

  const base = useManual
    ? `${API_BASE}/api/auth/passmanual/start`
    : `${API_BASE}/api/auth/pass/start`

  // 다날 스타트는 HTML 폼을 즉시 내보내도록 mode=html 권장
  const query = `mode=html&intent=${encodeURIComponent(intent)}`
  return `${base}?${query}`
}
