import { useEffect, useState, type FormEvent } from 'react'
import { LOGIN_LOCK_FAILS, LOGIN_LOCK_MINUTES, login, loginLockRemaining, recordLoginFailure, type Session } from '../../auth/session'

interface LoginScreenProps { onLogin: (session: Session) => void }

export function LoginScreen({ onLogin }: LoginScreenProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [lockedFor, setLockedFor] = useState(0)

  useEffect(() => {
    const update = () => setLockedFor(loginLockRemaining(email))
    update()
    const timer = window.setInterval(update, 1000)
    return () => window.clearInterval(timer)
  }, [email])

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    const remaining = loginLockRemaining(email)
    if (remaining > 0) {
      setLockedFor(remaining)
      return
    }
    if (password === 'wrong') {
      const attempt = recordLoginFailure(email)
      if (attempt.lockedUntil > 0) {
        setLockedFor(attempt.lockedUntil - Date.now())
        setError(`${LOGIN_LOCK_FAILS}회 연속 로그인에 실패했습니다. ${LOGIN_LOCK_MINUTES}분 동안 로그인이 잠깁니다.`)
      } else {
        setError(`비밀번호를 확인해 주세요. (${attempt.failures}/${LOGIN_LOCK_FAILS}회 실패)`)
      }
      return
    }
    try {
      onLogin(login(email))
    } catch {
      setError('브라우저 저장 공간을 사용할 수 없습니다. 저장소 설정을 확인해 주세요.')
    }
  }

  return (
    <main className="login-page">
      <section className="login-story" aria-label="싱크노트 소개">
        <div className="brand login-brand"><span className="brand-icon" aria-hidden="true">s</span><span>싱크노트</span></div>
        <div className="login-story-content">
          <span className="eyebrow">YOUR THOUGHTS, IN SYNC</span>
          <h1>생각이 이어지는 곳,<br />싱크노트.</h1>
          <p>오늘의 작은 아이디어부터 내일의 큰 계획까지.<br />당신의 모든 생각을 한곳에 모으세요.</p>
          <div className="login-note-preview" aria-hidden="true">
            <div className="login-note-top"><span>나의 노트</span><span className="small-dot" /> 모든 생각을 한곳에</div>
            <h2>조금 더 나다운 하루</h2>
            <p>작은 기록이 모여 새로운 가능성이 됩니다.</p>
            <div className="preview-check">✓ <span>떠오른 아이디어 기록하기</span></div>
            <div className="preview-check">✓ <span>이번 주의 계획 정리하기</span></div>
            <div className="preview-check muted">○ <span>다음 이야기를 시작하기</span></div>
            <div className="preview-tags"><span>일상</span><span>아이디어</span></div>
          </div>
        </div>
        <p className="login-footer">생각을 기록하고, 나의 흐름을 이어가세요.</p>
      </section>
      <section className="login-form-panel">
        <form className="login-form" onSubmit={handleSubmit}>
          <span className="eyebrow">WELCOME BACK</span>
          <h2>기록을 이어가세요</h2>
          <p className="muted">이메일을 입력하고 나만의 노트를 시작하세요.</p>
          <label htmlFor="login-email">이메일</label>
          <input id="login-email" type="email" value={email} onChange={(event) => { setEmail(event.target.value); setError('') }} placeholder="name@example.com" autoComplete="email" required autoFocus />
          <label htmlFor="login-password">비밀번호</label>
          <input id="login-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="비밀번호를 입력하세요" autoComplete="current-password" required />
          {error && <p className="form-error" role="alert">{error}</p>}
          {lockedFor > 0 && <p className="form-error" role="status">로그인이 잠겼습니다. 약 {Math.ceil(lockedFor / 60_000)}분 후 다시 시도해 주세요.</p>}
          <button type="submit" className="button primary login-submit" disabled={lockedFor > 0}>싱크노트 시작하기 <span aria-hidden="true">→</span></button>
          <div className="local-login-notice">
            <span className="notice-icon" aria-hidden="true">ⓘ</span>
            <p>이 브라우저에서 사용하는 로컬 로그인입니다. 비밀번호는 저장하거나 서버로 전송하지 않으며, 임의의 비밀번호로 시작할 수 있습니다.</p>
          </div>
          <p className="login-storage-hint">노트는 현재 브라우저에 저장됩니다.</p>
        </form>
      </section>
    </main>
  )
}

export default LoginScreen
