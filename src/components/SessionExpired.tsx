interface SessionExpiredProps { onLogin: () => void }

export function SessionExpired({ onLogin }: SessionExpiredProps) {
  return (
    <main className="session-expired-page">
      <section className="session-expired-card">
        <div className="brand"><span className="brand-icon" aria-hidden="true">s</span><span>싱크노트</span></div>
        <div className="session-icon" aria-hidden="true">↻</div>
        <span className="eyebrow">SESSION EXPIRED</span>
        <h1>다시 만나서 반가워요</h1>
        <p className="session-error" role="alert">[E-401] 세션이 만료되었습니다. 다시 로그인해 주세요.</p>
        <p className="muted">작성한 노트는 이 브라우저에 보관되어 있습니다.</p>
        <button type="button" className="button primary" onClick={onLogin}>다시 로그인 <span aria-hidden="true">→</span></button>
      </section>
    </main>
  )
}

export default SessionExpired
