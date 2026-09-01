const KEY = 'syncnote.session'
const ATTEMPTS_KEY = 'syncnote.loginAttempts'
export const SESSION_MAX_DAYS = 30
export const LOGIN_LOCK_FAILS = 5
export const LOGIN_LOCK_MINUTES = 30

export interface Session {
  email: string
  plan: 'free' | 'pro' | 'team'
  issuedAt: number
  lastActiveAt?: number
  passwordChangedAt?: number
}

export class SessionError extends Error {
  code = 'E-401' as const
  constructor() {
    super('세션이 만료되었습니다. 다시 로그인해 주세요.')
  }
}

export function getSession(): Session | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const session: unknown = JSON.parse(raw)
    if (!session || typeof session !== 'object') return null
    const value = session as Partial<Session>
    if (typeof value.email !== 'string' || !value.email.trim()) return null
    if (!['free', 'pro', 'team'].includes(value.plan ?? '')) return null
    if (typeof value.issuedAt !== 'number' || !Number.isFinite(value.issuedAt)) return null
    if (value.lastActiveAt !== undefined && (typeof value.lastActiveAt !== 'number' || !Number.isFinite(value.lastActiveAt))) return null
    if (value.passwordChangedAt !== undefined && (typeof value.passwordChangedAt !== 'number' || !Number.isFinite(value.passwordChangedAt))) return null
    return value as Session
  } catch {
    return null
  }
}

export function login(email: string, plan: Session['plan'] = 'free'): Session {
  const now = Date.now()
  const session: Session = { email: email.trim().toLowerCase(), plan, issuedAt: now, lastActiveAt: now }
  localStorage.setItem(KEY, JSON.stringify(session))
  clearLoginFailures(session.email)
  return session
}

export function logout(): void {
  localStorage.removeItem(KEY)
}

export function setPlan(plan: Session['plan']): void {
  const session = getSession()
  if (session) localStorage.setItem(KEY, JSON.stringify({ ...session, plan }))
}

export function changePasswordElsewhere(): void {
  const session = getSession()
  if (session) {
    localStorage.setItem(KEY, JSON.stringify({
      ...session,
      passwordChangedAt: Math.max(Date.now(), session.issuedAt + 1),
    }))
  }
}

// 30일 이상 미접속, 다른 기기에서 비밀번호 변경 시 만료. QA용: ?fault=e401
export function assertSession(): Session {
  const session = getSession()
  if (!session) throw new SessionError()
  const forced = new URLSearchParams(window.location.search).get('fault') === 'e401'
    || localStorage.getItem('syncnote.fault') === 'e401'
  const now = Date.now()
  const expired = now - (session.lastActiveAt ?? session.issuedAt) >= SESSION_MAX_DAYS * 86_400_000
  const passwordChanged = session.passwordChangedAt !== undefined && session.passwordChangedAt > session.issuedAt
  if (forced || expired || passwordChanged) throw new SessionError()
  const activeSession = { ...session, lastActiveAt: now }
  localStorage.setItem(KEY, JSON.stringify(activeSession))
  return activeSession
}

interface LoginAttempt { failures: number; lockedUntil: number }

function readAttempts(): Record<string, LoginAttempt> {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(ATTEMPTS_KEY) ?? '{}')
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
    return Object.fromEntries(Object.entries(value).filter(([, entry]: [string, unknown]) => {
      if (!entry || typeof entry !== 'object') return false
      const candidate = entry as Partial<LoginAttempt>
      return typeof candidate.failures === 'number' && Number.isFinite(candidate.failures)
        && typeof candidate.lockedUntil === 'number' && Number.isFinite(candidate.lockedUntil)
    })) as Record<string, LoginAttempt>
  } catch {
    return {}
  }
}

export function loginLockRemaining(email: string): number {
  const attempts = readAttempts()
  const key = email.trim().toLowerCase()
  const attempt = attempts[key]
  if (!attempt) return 0
  if (attempt.lockedUntil > 0 && attempt.lockedUntil <= Date.now()) {
    delete attempts[key]
    localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(attempts))
    return 0
  }
  return Math.max(0, attempt.lockedUntil - Date.now())
}

export function recordLoginFailure(email: string): LoginAttempt {
  const key = email.trim().toLowerCase()
  loginLockRemaining(key)
  const attempts = readAttempts()
  const previous = attempts[key] ?? { failures: 0, lockedUntil: 0 }
  if (previous.lockedUntil > Date.now()) return previous
  const failures = previous.failures + 1
  const attempt = {
    failures,
    lockedUntil: failures >= LOGIN_LOCK_FAILS ? Date.now() + LOGIN_LOCK_MINUTES * 60_000 : 0,
  }
  attempts[key] = attempt
  localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(attempts))
  return attempt
}

function clearLoginFailures(email: string): void {
  const attempts = readAttempts()
  delete attempts[email.trim().toLowerCase()]
  localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(attempts))
}
