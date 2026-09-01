import { useState } from 'react'
import { search } from '../../search/indexer'
import type { Note } from '../lib/storage'
import { APP_VERSION } from '../version'

type View = 'notes' | 'plans' | 'settings'

interface SidebarProps {
  notes: Note[]
  selectedId: string | null
  view: View
  onSelect: (id: string) => void
  onCreate: () => void
  onNavigate: (view: View) => void
}

export default function Sidebar({ notes, selectedId, view, onSelect, onCreate, onNavigate }: SidebarProps) {
  const [query, setQuery] = useState('')
  const matchingIds = query.trim() ? new Set(search(query)) : null
  const visibleNotes = notes.filter((note) => !matchingIds || matchingIds.has(note.id))
  return (
    <aside className="sidebar" aria-label="노트 탐색">
      <button type="button" className="sidebar-brand" onClick={() => onNavigate('notes')} aria-label="싱크노트 홈">
        <span className="brand-symbol" aria-hidden="true"><svg viewBox="0 0 24 24" width="24" height="24" fill="none"><path d="M7 4h9a2 2 0 0 1 2 2v14H8a3 3 0 0 1-3-3V6a2 2 0 0 1 2-2ZM5 17a3 3 0 0 1 3-3h10M9 8h5M9 11h3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
        <span>싱크노트<small>생각을 잇는 공간</small></span>
      </button>
      <div className="search-field">
        <svg viewBox="0 0 20 20" width="17" height="17" fill="none" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5" stroke="currentColor" strokeWidth="1.5" /><path d="m12.5 12.5 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
        <label className="sr-only" htmlFor="note-search">노트 검색</label>
        <input id="note-search" type="search" placeholder="노트 검색" value={query} onChange={(event) => setQuery(event.target.value)} />
      </div>
      <button type="button" className="button primary new-note-button" onClick={onCreate}><span aria-hidden="true">＋</span> 새 노트</button>
      <div className="note-list-heading"><span>모든 노트</span><span>{notes.length}</span></div>
      <nav className="note-list" aria-label="노트 목록">
        {visibleNotes.map((note) => <button type="button" key={note.id} className={`note-list-item${view === 'notes' && note.id === selectedId ? ' active' : ''}`} aria-current={view === 'notes' && note.id === selectedId ? 'page' : undefined} onClick={() => onSelect(note.id)}>
          <div className="note-list-title"><svg viewBox="0 0 20 20" width="16" height="16" fill="none" aria-hidden="true"><path d="M5 2.5h6.5l3.5 3.7v11.3H5v-15ZM11.5 2.5v4H15M8 10h4M8 13h4" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /></svg><span>{note.title || '제목 없는 노트'}</span></div>
          <p>{note.body.replace(/[#*|\[\]]/g, '').replace(/\s+/g, ' ').trim().slice(0, 64) || '첫 문장을 적어보세요.'}</p>
          <time dateTime={new Date(note.updatedAt).toISOString()}>{new Date(note.updatedAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}</time>
        </button>)}
        {visibleNotes.length === 0 && <p className="empty-state">{query.trim() ? '검색 결과가 없어요.' : '새 노트로 첫 생각을 기록해 보세요.'}</p>}
      </nav>
      <div className="sidebar-footer">
        <nav aria-label="서비스 메뉴">
          <button type="button" className={`nav-item${view === 'plans' ? ' active' : ''}`} aria-current={view === 'plans' ? 'page' : undefined} onClick={() => onNavigate('plans')}><svg viewBox="0 0 20 20" width="18" height="18" fill="none" aria-hidden="true"><path d="m10 2 2.3 5.3L18 8l-4.2 4 .9 5.8L10 15l-4.7 2.8.9-5.8L2 8l5.7-.7L10 2Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" /></svg>요금제</button>
          <button type="button" className={`nav-item${view === 'settings' ? ' active' : ''}`} aria-current={view === 'settings' ? 'page' : undefined} onClick={() => onNavigate('settings')}><svg viewBox="0 0 20 20" width="18" height="18" fill="none" aria-hidden="true"><path d="m8.2 2-.5 2-1.5.9-2-.5-1.7 3 1.5 1.5v1.8l-1.5 1.5 1.7 3 2-.5 1.5.9.5 2h3.6l.5-2 1.5-.9 2 .5 1.7-3-1.5-1.5V8.9l1.5-1.5-1.7-3-2 .5-1.5-.9-.5-2H8.2Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" /><circle cx="10" cy="9.8" r="2.5" stroke="currentColor" strokeWidth="1.2" /></svg>설정</button>
        </nav>
        <div className="sidebar-footnote"><span className="online-dot" aria-hidden="true" />나의 공간, 어디서나 <span>v{APP_VERSION}</span></div>
      </div>
    </aside>
  )
}
