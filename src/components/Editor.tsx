import { Fragment, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { getPlan, type PlanId } from '../../billing/pricing'
import { insertTable, isTableCommand } from '../../editor/table'
import { enqueue, type Change } from '../../sync/saveHandler'
import { checkAttachment } from '../../upload/attachmentLimit'
import { reportError } from '../lib/errors'
import type { Attachment, Note } from '../lib/storage'

interface EditorProps {
  note: Note
  plan: PlanId
  onChange: (note: Note) => void
  onDelete: () => void
}

function inlineMarkdown(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={index}>{part.slice(2, -2)}</strong>
      : <Fragment key={index}>{part}</Fragment>,
  )
}

function tableCells(line: string): string[] {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim())
}

function MarkdownPreview({ body }: { body: string }) {
  if (!body.trim()) return <p className="preview-placeholder">내용을 작성하면 이곳에서 미리 볼 수 있어요.</p>
  const lines = body.split('\n')
  const blocks: ReactNode[] = []
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    if (!line.trim()) continue
    if (line.includes('|')) {
      const start = index
      const rows: string[][] = []
      while (index < lines.length && lines[index].includes('|')) {
        rows.push(tableCells(lines[index]))
        index += 1
      }
      const hasHeader = rows.length > 1 && rows[1].every((cell) => /^:?-{3,}:?$/.test(cell))
      const columnCount = Math.max(...rows.map((row) => row.length))
      blocks.push(<table key={start}>
        {hasHeader && <thead><tr>{Array.from({ length: columnCount }, (_, column) => <th key={column} scope="col">{inlineMarkdown(rows[0][column] ?? '')}</th>)}</tr></thead>}
        <tbody>{rows.slice(hasHeader ? 2 : 0).map((row, rowIndex) => <tr key={rowIndex}>{Array.from({ length: columnCount }, (_, column) => <td key={column}>{inlineMarkdown(row[column] ?? '')}</td>)}</tr>)}</tbody>
      </table>)
      index -= 1
      continue
    }
    const heading = /^(#{1,3})\s+(.+)$/.exec(line)
    if (heading) {
      const content = inlineMarkdown(heading[2])
      blocks.push(heading[1].length === 1 ? <h1 key={index}>{content}</h1>
        : heading[1].length === 2 ? <h2 key={index}>{content}</h2>
          : <h3 key={index}>{content}</h3>)
      continue
    }
    if (/^\s*[-*]\s+/.test(line)) {
      const start = index
      const items: ReactNode[] = []
      while (index < lines.length && /^\s*[-*]\s+/.test(lines[index])) {
        const value = lines[index].replace(/^\s*[-*]\s+/, '')
        const checklist = /^\[([ xX])\]\s*(.*)$/.exec(value)
        items.push(checklist
          ? <li key={index} className="checklist-item"><input type="checkbox" checked={checklist[1].toLowerCase() === 'x'} readOnly tabIndex={-1} aria-label={checklist[2]} />{inlineMarkdown(checklist[2])}</li>
          : <li key={index}>{inlineMarkdown(value)}</li>)
        index += 1
      }
      blocks.push(<ul key={start}>{items}</ul>)
      index -= 1
      continue
    }
    blocks.push(<p key={index}>{inlineMarkdown(line)}</p>)
  }
  return <div className="markdown-preview">{blocks}</div>
}

function attachmentKey(noteId: string, attachment: Attachment): string {
  return JSON.stringify([noteId, attachment.name, attachment.size, attachment.type])
}

function formatSize(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function Editor({ note, plan, onChange, onDelete }: EditorProps) {
  const [preview, setPreview] = useState(true)
  const [tagDraft, setTagDraft] = useState('')
  const [previews, setPreviews] = useState<Record<string, string>>({})
  const objectUrls = useRef(new Set<string>())
  const fileInput = useRef<HTMLInputElement>(null)
  const bodyInput = useRef<HTMLTextAreaElement>(null)
  const pendingCursor = useRef<number | null>(null)

  useEffect(() => { setTagDraft('') }, [note.id])
  useEffect(() => () => { objectUrls.current.forEach((url) => URL.revokeObjectURL(url)) }, [])
  useLayoutEffect(() => {
    if (pendingCursor.current !== null) {
      bodyInput.current?.setSelectionRange(pendingCursor.current, pendingCursor.current)
      pendingCursor.current = null
    }
  }, [note.body])

  function update(field: Change['field'], value: string | string[]) {
    const at = Date.now()
    onChange({ ...note, [field]: value, updatedAt: at })
    enqueue({ noteId: note.id, field, value, at })
  }

  function handleBodyKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== 'Enter' || event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return
    const cursor = event.currentTarget.selectionStart
    const lineStart = note.body.lastIndexOf('\n', cursor - 1) + 1
    const nextNewline = note.body.indexOf('\n', cursor)
    const lineEnd = nextNewline === -1 ? note.body.length : nextNewline
    if (event.currentTarget.selectionEnd > lineEnd || !isTableCommand(note.body.slice(lineStart, lineEnd))) return
    event.preventDefault()
    const table = `${insertTable()}\n`
    pendingCursor.current = lineStart + table.length
    update('body', note.body.slice(0, lineStart) + table + note.body.slice(lineEnd))
  }

  function addTag() {
    const value = tagDraft.trim().replace(/^#/, '')
    if (!value) return
    if (!note.tags.includes(value)) update('tags', [...note.tags, value])
    setTagDraft('')
  }

  function attach(file: File) {
    try {
      checkAttachment(file, plan)
    } catch {
      reportError('E-413')
      return
    }
    const attachment: Attachment = { name: file.name, size: file.size, type: file.type }
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file)
      objectUrls.current.add(url)
      setPreviews((current) => ({ ...current, [attachmentKey(note.id, attachment)]: url }))
    }
    onChange({ ...note, attachments: [...note.attachments, attachment], updatedAt: Date.now() })
  }

  return (
    <article className="editor" aria-label="노트 편집기">
      <div className="editor-header">
        <div className="editor-heading"><span className="eyebrow">MY NOTES</span><span className="editor-section-label">나의 노트</span></div>
        <div className="editor-actions">
          <button className={`button secondary${preview ? ' selected' : ''}`} type="button" aria-pressed={preview} onClick={() => setPreview(!preview)}>
            <svg viewBox="0 0 20 20" width="17" height="17" fill="none" aria-hidden="true"><path d="M2 10s3-5 8-5 8 5 8 5-3 5-8 5-8-5-8-5Z" stroke="currentColor" strokeWidth="1.5" /><circle cx="10" cy="10" r="2.2" stroke="currentColor" strokeWidth="1.5" /></svg>
            미리보기
          </button>
          <button className="icon-button delete-note-button" type="button" aria-label="노트 삭제" title="노트 삭제" onClick={() => { if (window.confirm(`“${note.title || '제목 없는 노트'}” 노트를 삭제할까요?`)) onDelete() }}>
            <svg viewBox="0 0 20 20" width="18" height="18" fill="none" aria-hidden="true"><path d="M4 5.5h12M8 3h4l1 2.5H7L8 3ZM5.5 5.5l.7 11h7.6l.7-11M8.3 8.5v5M11.7 8.5v5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </div>
      </div>

      <label className="sr-only" htmlFor="note-title">노트 제목</label>
      <input id="note-title" className="title-input" value={note.title} placeholder="제목 없는 노트" onChange={(event) => update('title', event.target.value)} />
      <div className="editor-meta"><span>{new Date(note.updatedAt).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })} 수정</span><span aria-hidden="true">·</span><span>{note.body.length.toLocaleString('ko-KR')}자</span></div>
      <div className="tag-row">
        <svg viewBox="0 0 20 20" width="16" height="16" fill="none" aria-hidden="true"><path d="m3 3 6.5.1L17 10.6 10.6 17 3.1 9.5 3 3Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /><circle cx="6.5" cy="6.5" r="1" fill="currentColor" /></svg>
        {note.tags.map((tag) => <span className="tag" key={tag}>{tag}<button className="tag-remove" type="button" aria-label={`${tag} 태그 삭제`} onClick={() => update('tags', note.tags.filter((item) => item !== tag))}>×</button></span>)}
        <label className="sr-only" htmlFor="note-tag">태그 추가</label>
        <input id="note-tag" className="tag-input" value={tagDraft} placeholder="태그 추가 후 Enter" onChange={(event) => setTagDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.nativeEvent.isComposing) { event.preventDefault(); addTag() } }} />
      </div>

      <div className={`editor-workspace${preview ? ' with-preview' : ''}`}>
        <section className="editor-panel" aria-label="마크다운 작성">
          <div className="panel-heading"><label htmlFor="note-body">작성</label><span>Markdown</span></div>
          <textarea ref={bodyInput} id="note-body" className="body-input" value={note.body} placeholder="생각을 자유롭게 적어보세요. /표 입력 후 Enter로 표를 넣을 수 있어요." onChange={(event) => update('body', event.target.value)} onKeyDown={handleBodyKeyDown} spellCheck={false} />
        </section>
        {preview && <section className="preview-panel" aria-label="노트 미리보기"><div className="panel-heading"><span>미리보기</span><span>읽기 모드</span></div><MarkdownPreview body={note.body} /></section>}
      </div>

      <div className="editor-footer">
        <button type="button" className="button ghost" onClick={() => fileInput.current?.click()}>
          <svg viewBox="0 0 20 20" width="17" height="17" fill="none" aria-hidden="true"><path d="m7 10.5 5-5a2.3 2.3 0 0 1 3.2 3.2l-6.3 6.4a3.6 3.6 0 0 1-5.1-5.2L10 3.7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
          파일 첨부
        </button>
        <input ref={fileInput} type="file" className="sr-only" tabIndex={-1} aria-label="첨부 파일 선택" onChange={(event) => { const file = event.target.files?.[0]; if (file) attach(file); event.target.value = '' }} />
        <span className="muted">파일당 최대 {getPlan(plan).attachmentMB}MB</span>
      </div>
      {note.attachments.length > 0 && <section className="attachments" aria-label="첨부 파일 목록">
        {note.attachments.map((attachment, index) => {
          const imageUrl = previews[attachmentKey(note.id, attachment)]
          return <div className="attachment-card" key={`${attachment.name}-${index}`}>
            {imageUrl ? <img className="attachment-thumbnail" src={imageUrl} alt={`${attachment.name} 미리보기`} /> : <div className="attachment-file-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="23" height="23" fill="none"><path d="M7 3h7l4 4v14H7V3Zm7 0v5h4M10 12h5M10 15h5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /></svg></div>}
            <div className="attachment-info"><span>{attachment.name}</span><small>{formatSize(attachment.size)}{attachment.type.startsWith('image/') && !imageUrl ? ' · 미리보기는 첨부한 세션에서 제공' : ''}</small></div>
            <button type="button" className="icon-button" aria-label={`${attachment.name} 첨부 삭제`} onClick={() => onChange({ ...note, attachments: note.attachments.filter((_, itemIndex) => itemIndex !== index), updatedAt: Date.now() })}>×</button>
          </div>
        })}
      </section>}
    </article>
  )
}
