import { useState } from 'react'
import { changePasswordElsewhere, type Session } from '../../auth/session'
import { getPlan } from '../../billing/pricing'
import { rebuildIndex } from '../../search/indexer'
import type { Note } from '../lib/storage'

interface SettingsPageProps { session: Session; notes: Note[]; onResetSync: () => void }

export function SettingsPage({ session, notes, onResetSync }: SettingsPageProps) {
  const [message, setMessage] = useState('')
  const [fault, setFault] = useState(() => localStorage.getItem('syncnote.fault') ?? '')
  const qaEnabled = new URLSearchParams(window.location.search).get('qa') === '1'

  function exportNotes() {
    const content = notes.map((note) => `# ${note.title || '제목 없는 노트'}\n\n${note.body}${note.attachments.length ? '\n\n## 첨부 파일\n\n' + note.attachments.map((attachment) => `- ${attachment.name} (${(attachment.size / 1024).toFixed(1)} KB)`).join('\n') : ''}`).join('\n\n---\n\n')
    const url = URL.createObjectURL(new Blob([content], { type: 'text/markdown;charset=utf-8' }))
    const anchor = document.createElement('a')
    const today = new Date()
    const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    anchor.href = url
    anchor.download = `syncnote-notes-${date}.md`
    document.body.append(anchor)
    anchor.click()
    anchor.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    setMessage(`${notes.length}개의 노트를 Markdown 파일로 내보냈습니다.`)
  }

  function toggleFault(code: string, enabled: boolean) {
    if (enabled) localStorage.setItem('syncnote.fault', code)
    else localStorage.removeItem('syncnote.fault')
    setFault(enabled ? code : '')
  }

  return (
    <section className="content-page settings-page">
      <header className="page-heading"><span className="eyebrow">PREFERENCES</span><h1>설정</h1><p>나의 계정과 기록 환경을 관리하세요.</p></header>
      {message && <div className="inline-success" role="status">✓ {message}</div>}
      <section className="settings-section">
        <div className="section-heading"><h2>계정</h2><p>현재 로그인된 계정 정보입니다.</p></div>
        <div className="settings-card">
          <div className="settings-row"><div><h3>이메일</h3><p>{session.email}</p></div><span className="account-avatar" aria-hidden="true">{session.email.slice(0, 1).toUpperCase()}</span></div>
          <div className="settings-row"><div><h3>이용 중인 요금제</h3><p>현재 브라우저에 적용된 요금제입니다.</p></div><span className={`plan-badge ${session.plan}`}>{getPlan(session.plan).name}</span></div>
          <div className="settings-row"><div><h3>비밀번호 변경 시뮬레이션</h3><p>다른 기기에서 비밀번호를 변경한 상황을 재현합니다.<br />다음 화면으로 이동하면 다시 로그인해야 합니다.</p></div><button type="button" className="button secondary" onClick={() => { changePasswordElsewhere(); setMessage('비밀번호 변경을 반영했습니다. 다음 화면 이동 시 세션이 만료됩니다.') }}>다른 기기에서 비밀번호 변경 시뮬레이션</button></div>
        </div>
      </section>
      <section className="settings-section">
        <div className="section-heading"><h2>고급</h2><p>검색과 저장 상태를 관리합니다.</p></div>
        <div className="settings-card">
          <div className="settings-row"><div><h3>검색 색인</h3><p>현재 노트를 바탕으로 검색 색인을 다시 만듭니다.</p></div><button type="button" className="button secondary" onClick={() => { rebuildIndex(notes); setMessage(`${notes.length}개 노트의 검색 색인을 재구성했습니다.`) }}>검색 색인 재구성</button></div>
          <div className="settings-row"><div><h3>동기화 재설정</h3><p>대기 중인 저장 요청을 비우고 기기의 노트를 다시 저장합니다.</p></div><button type="button" className="button secondary" onClick={() => { onResetSync(); setMessage('동기화를 재설정했습니다. 로컬 노트를 다시 저장합니다.') }}>동기화 재설정</button></div>
        </div>
      </section>
      <section className="settings-section">
        <div className="section-heading"><h2>데이터</h2><p>내 기록을 안전하게 보관하세요.</p></div>
        <div className="settings-card"><div className="settings-row"><div><h3>노트 내보내기</h3><p>모든 노트를 하나의 Markdown 파일로 다운로드합니다.<br />첨부 파일의 이름과 크기가 포함됩니다.</p></div><button type="button" className="button secondary" disabled={notes.length === 0} onClick={exportNotes}>모든 노트 내보내기 <span aria-hidden="true">↓</span></button></div></div>
      </section>
      {qaEnabled && <section className="settings-section qa-section">
        <div className="section-heading"><h2>QA</h2><p>저장 및 로그인 오류 상황을 확인합니다.</p></div>
        <div className="settings-card">
          <label className="settings-row"><div><h3>[E-502] 강제</h3><p>다음 저장 요청부터 저장 서버 응답 실패를 재현합니다.</p></div><input className="toggle-input" type="checkbox" checked={fault === 'e502'} onChange={(event) => toggleFault('e502', event.target.checked)} aria-label="E-502 강제" /></label>
          <label className="settings-row"><div><h3>[E-401] 강제</h3><p>다음 화면 이동 시 세션 만료를 재현합니다.</p></div><input className="toggle-input" type="checkbox" checked={fault === 'e401'} onChange={(event) => toggleFault('e401', event.target.checked)} aria-label="E-401 강제" /></label>
        </div>
        <p className="muted qa-note">주소의 fault 설정도 함께 적용됩니다. 한 번에 하나의 오류를 선택할 수 있습니다.</p>
      </section>}
    </section>
  )
}

export default SettingsPage
