import { useEffect, useState } from 'react'
import { assertSession, getSession, logout, type Session } from '../auth/session'
import { getPlan, type PlanId } from '../billing/pricing'
import { rebuildIndex } from '../search/indexer'
import { enqueue, onSaveState, resetQueue } from '../sync/saveHandler'
import { createNote, loadNotes, saveNotesLocal, type Note } from './lib/storage'
import { reportError } from './lib/errors'
import { APP_VERSION } from './version'
import LoginScreen from './components/LoginScreen'
import Sidebar from './components/Sidebar'
import Editor from './components/Editor'
import SaveStatus from './components/SaveStatus'
import PlansPage from './components/PlansPage'
import SettingsPage from './components/SettingsPage'
import Toasts from './components/Toasts'
import SessionExpired from './components/SessionExpired'
import SupportWidget from './components/SupportWidget'

type View = 'notes' | 'plans' | 'settings'
function initialSession(): { session: Session | null; expired: boolean } {
  const forced = new URLSearchParams(location.search).get('fault') === 'e401' || localStorage.getItem('syncnote.fault') === 'e401'
  if (!getSession() && !forced) return { session: null, expired: false }
  try { return { session: assertSession(), expired: false } } catch { return { session: null, expired: true } }
}

export default function App() {
  const [auth, setAuth] = useState(initialSession)
  const [notes, setNotes] = useState(() => { const initial = loadNotes(); rebuildIndex(initial); return initial })
  const [selectedId, setSelectedId] = useState<string | null>(() => notes[0]?.id ?? null)
  const [view, setView] = useState<View>('notes')
  useEffect(() => { if (auth.expired) reportError('E-401') }, [auth.expired])
  useEffect(() => onSaveState((state) => {
    if (state.kind === 'saved') setNotes((current) => {
      const updated = current.map((note) => ({ ...note, syncedAt: state.at }))
      saveNotesLocal(updated)
      return updated
    })
  }), [])

  function persist(next: Note[]) { saveNotesLocal(next); rebuildIndex(next); setNotes(next) }
  function validate() {
    try { const session = assertSession(); setAuth({ session, expired: false }); return true }
    catch { setAuth({ session: null, expired: true }); return false }
  }
  function navigate(next: View) { if (validate()) setView(next) }
  function addNote() {
    if (!validate()) return
    const note = createNote()
    persist([note, ...notes]); setSelectedId(note.id); setView('notes')
    enqueue({ noteId: note.id, field: 'title', value: note.title, at: note.updatedAt })
  }
  function removeNote() {
    const next = notes.filter((note) => note.id !== selectedId)
    persist(next); setSelectedId(next[0]?.id ?? null)
  }
  function changePlan(plan: PlanId) { setAuth((current) => ({ ...current, session: current.session ? { ...current.session, plan } : null })) }
  function resetSync() {
    resetQueue()
    notes.forEach((note) => (['title', 'body', 'tags'] as const).forEach((field) => enqueue({ noteId: note.id, field, value: note[field], at: Date.now() })))
  }
  function signOut() { logout(); resetQueue(); setAuth({ session: null, expired: false }); setView('notes') }
  function restartLogin() {
    logout(); resetQueue()
    if (localStorage.getItem('syncnote.fault') === 'e401') localStorage.removeItem('syncnote.fault')
    const url = new URL(location.href)
    if (url.searchParams.get('fault') === 'e401') { url.searchParams.delete('fault'); history.replaceState(null, '', url) }
    setAuth({ session: null, expired: false })
  }
  const selected = notes.find((note) => note.id === selectedId)
  return <>
    {auth.expired ? <SessionExpired onLogin={restartLogin} /> : !auth.session ? <LoginScreen onLogin={(session) => { setAuth({ session, expired: false }); setView('notes') }} /> :
      <div className="app-shell">
        <Sidebar notes={notes} selectedId={selectedId} view={view} onSelect={(id) => { if (validate()) { setSelectedId(id); setView('notes') } }} onCreate={addNote} onNavigate={navigate} />
        <main className="main-shell">
          <header className="topbar">
            <div className="breadcrumb">내 워크스페이스 <span>/</span> <strong>{view === 'notes' ? '모든 노트' : view === 'plans' ? '요금제' : '설정'}</strong></div>
            <div className="account-bar"><SaveStatus /><span className="plan-badge">{getPlan(auth.session.plan).name}</span><span className="account-email">{auth.session.email}</span><button className="button ghost logout-button" onClick={signOut}>로그아웃</button></div>
          </header>
          {view === 'plans' ? <PlansPage plan={auth.session.plan} onPlanChange={changePlan} /> : view === 'settings' ? <SettingsPage session={auth.session} notes={notes} onResetSync={resetSync} /> : selected ?
            <Editor key={selected.id} note={selected} plan={auth.session.plan} onChange={(note) => persist(notes.map((old) => old.id === note.id ? note : old))} onDelete={removeNote} /> :
            <section className="empty-workspace"><div className="empty-note-icon">✎</div><h1>첫 생각을 적어보세요</h1><p>짧은 메모부터 새로운 계획까지, 여기에 모아두세요.</p><button className="button primary" onClick={addNote}>새 노트 만들기</button></section>}
          <footer className="app-version">싱크노트 v{APP_VERSION}<span>생각이 이어지는 공간</span></footer>
        </main>
      </div>}
    <SupportWidget /><Toasts />
  </>
}
