import { isErrorCode } from './errors'

export interface SupportEnvironment {
  os: string
  app_version: string
  error_code: string | null
}

export function getEnv(): SupportEnvironment {
  const userAgent = navigator.userAgent
  const browsers: [string, RegExp][] = [
    ['Edge', /(?:Edg|EdgA|EdgiOS)\/(\d+)/],
    ['Firefox', /(?:Firefox|FxiOS)\/(\d+)/],
    ['Chrome', /(?:Chrome|CriOS)\/(\d+)/],
    ['Safari', /Version\/(\d+).*Safari\//],
  ]
  let os = 'Web'
  for (const [name, pattern] of browsers) {
    const match = userAgent.match(pattern)
    if (match) { os = `Web (${name} ${match[1]})`; break }
  }
  let error_code: string | null = null
  try {
    const raw = localStorage.getItem('syncnote.lastError')
    const recent: unknown = raw ? JSON.parse(raw) : null
    if (recent && typeof recent === 'object' && 'code' in recent && 'at' in recent) {
      const age = typeof recent.at === 'number' ? Date.now() - recent.at : -1
      if (typeof recent.code === 'string' && isErrorCode(recent.code) && age >= 0 && age <= 30 * 60_000) {
        error_code = recent.code
      }
    }
  } catch {
    // 이전 오류 정보가 손상되면 환경 정보만 보낸다.
  }
  return { os, app_version: 'web', error_code }
}
