import { useEffect, useRef, useState, type FormEvent } from 'react'
import { getEnv } from '../lib/env'
import {
  SUPPORT_CATEGORIES, SupportClientError, createInquiry, fetchInquiry, getAttachment,
  getCachedInquiry, getCustomerId, getOpenInquiryId, getSavedRating, isOfflineMode,
  sendMessage, submitRating, uploadAttachment,
  type SupportAttachment, type SupportCategory, type SupportInquiry, type SupportMessage,
} from '../lib/supportClient'

function Icon({ name }: { name: 'chat' | 'close' | 'attach' | 'send' }) {
  const paths = {
    chat: <><path d="M20 11.5a8.3 8.3 0 0 1-.9 3.8 8.4 8.4 0 0 1-7.6 4.7 8.3 8.3 0 0 1-3.8-.9L2 21l1.9-5.7a8.3 8.3 0 0 1-.9-3.8 8.4 8.4 0 0 1 4.7-7.6 8.3 8.3 0 0 1 3.8-.9h.5a8.4 8.4 0 0 1 8 8v.5Z"/><path d="M7 10h9M7 14h5"/></>,
    close: <path d="m6 6 12 12M6 18 18 6"/>,
    attach: <path d="m8 12 6.5-6.5a3.5 3.5 0 0 1 5 5L10 20a5 5 0 0 1-7-7l9-9a2 2 0 0 1 3 3l-8.5 8.5a.7.7 0 0 1-1-1L13 8"/>,
    send: <><path d="m21 3-7 18-4-7-7-4 18-7Z"/><path d="m10 14 6-6"/></>,
  }
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}

function errorText(error: unknown): string {
  return error instanceof SupportClientError ? error.message : '잠시 후 다시 시도해 주세요'
}

function attachmentUrl(value: string): string | null {
  try {
    const url = new URL(value)
    return ['https:', 'http:'].includes(url.protocol) ? url.href : null
  } catch { return null }
}

function Message({ message }: { message: SupportMessage }) {
  const customer = message.sender === 'customer'
  const automatic = message.sender === 'ai_auto'
  return <div className={`support-message ${customer ? 'is-customer' : automatic ? 'is-automatic' : 'is-agent'}`}>
    {!customer && <span className="support-sender">{automatic ? '자동 안내' : '싱크노트 고객지원'}</span>}
    <div className="support-bubble">
      <p>{message.text}</p>
      {message.attachments.length > 0 && <div className="support-message-attachments">
        {message.attachments.map((id) => {
          const attachment = getAttachment(id)
          const url = attachment ? attachmentUrl(attachment.url) : null
          return url
            ? <a key={id} href={url} target="_blank" rel="noopener noreferrer"><Icon name="attach"/>{attachment?.name ?? '첨부 파일'}</a>
            : <span key={id}><Icon name="attach"/>{attachment?.name ?? '첨부 파일'}</span>
        })}
      </div>}
    </div>
    <time dateTime={message.sent_at}>{new Date(message.sent_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })}</time>
  </div>
}

export function SupportWidget() {
  const [open, setOpen] = useState(false)
  const [inquiryId, setInquiryId] = useState<string | null>(getOpenInquiryId)
  const [inquiry, setInquiry] = useState<SupportInquiry | null>(() => {
    const id = getOpenInquiryId()
    return id ? getCachedInquiry(id) : null
  })
  const [category, setCategory] = useState<SupportCategory | null>(inquiry?.customer_category ?? null)
  const [text, setText] = useState('')
  const [attachments, setAttachments] = useState<SupportAttachment[]>([])
  const [sending, setSending] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [pollError, setPollError] = useState('')
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [ratingSaved, setRatingSaved] = useState(() => Boolean(inquiryId && getSavedRating(inquiryId)))
  const [ratingBusy, setRatingBusy] = useState(false)
  const end = useRef<HTMLDivElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const messageInput = useRef<HTMLTextAreaElement>(null)
  const launcher = useRef<HTMLButtonElement>(null)
  const environment = getEnv()
  const offline = isOfflineMode(inquiryId ?? undefined)
  const closed = inquiry?.status === '상담 종료'

  useEffect(() => {
    try { getCustomerId() } catch { setError('잠시 후 다시 시도해 주세요') }
  }, [])

  useEffect(() => {
    if (!open || !inquiryId) return
    let active = true
    let fetching = false
    const refresh = async () => {
      if (fetching) return
      fetching = true
      try {
        const updated = await fetchInquiry(inquiryId)
        if (active) { setInquiry(updated); setPollError('') }
      } catch (failure) {
        if (active) setPollError(errorText(failure))
      } finally { fetching = false }
    }
    void refresh()
    const interval = setInterval(() => { void refresh() }, 3000)
    return () => { active = false; clearInterval(interval) }
  }, [open, inquiryId])

  useEffect(() => {
    if (open) end.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [open, inquiry?.messages.length, closed])

  useEffect(() => {
    if (open && (category || inquiryId) && !closed) messageInput.current?.focus()
  }, [open, category, inquiryId, closed])

  useEffect(() => {
    if (!open) return
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setOpen(false); launcher.current?.focus() }
    }
    window.addEventListener('keydown', escape)
    return () => window.removeEventListener('keydown', escape)
  }, [open])

  async function handleSend(event: FormEvent) {
    event.preventDefault()
    if (!text.trim() || sending || uploading || closed || (!inquiryId && !category)) return
    setSending(true)
    setError('')
    try {
      const ids = attachments.map((attachment) => attachment.attachment_id)
      const updated = inquiryId
        ? await sendMessage(inquiryId, text.trim(), ids)
        : await createInquiry({ message: text.trim(), customer_category: category!, attachments: ids })
      setInquiry(updated)
      setInquiryId(updated.inquiry_id)
      setText('')
      setAttachments([])
    } catch (failure) { setError(errorText(failure)) }
    finally { setSending(false) }
  }

  async function handleUpload(file: File) {
    setUploading(true)
    setError('')
    try {
      const attachment = await uploadAttachment(file, inquiryId ?? undefined)
      setAttachments((current) => [...current, attachment])
    } catch (failure) { setError(errorText(failure)) }
    finally { setUploading(false) }
  }

  async function handleRating(event: FormEvent) {
    event.preventDefault()
    if (!inquiryId || ratingBusy || !rating) return
    setRatingBusy(true)
    setError('')
    try {
      await submitRating(inquiryId, rating, comment.trim())
      setRatingSaved(true)
    } catch (failure) { setError(errorText(failure)) }
    finally { setRatingBusy(false) }
  }

  return <div className="support-widget">
    {open && <section className="support-panel" id="support-panel" role="dialog" aria-label="싱크노트 고객지원">
      <header className="support-header">
        <span className="support-brand-icon"><Icon name="chat"/></span>
        <div><strong>싱크노트 고객지원</strong><span className="support-status"><i aria-hidden="true"/>{inquiry?.status ?? '무엇을 도와드릴까요?'}</span></div>
        <button type="button" className="icon-button support-close" aria-label="문의 창 닫기" onClick={() => { setOpen(false); launcher.current?.focus() }}><Icon name="close"/></button>
      </header>
      {offline && <div className="support-offline" role="status">고객지원 서버에 연결되지 않았습니다<span>메시지는 이 기기에만 보관됩니다.</span></div>}
      <div className="support-content">
        {!inquiryId && <div className="support-welcome">
          <div className="support-welcome-icon"><Icon name="chat"/></div>
          <h3>안녕하세요</h3>
          <p>싱크노트를 사용하며 궁금한 점이 있나요?<br/>문의 유형을 선택하고 이야기를 남겨주세요.</p>
          <div className="support-categories" aria-label="문의 유형">
            {SUPPORT_CATEGORIES.map((item) => <button key={item} type="button" className={category === item ? 'selected' : ''} aria-pressed={category === item} disabled={sending || uploading} onClick={() => { setCategory(item); setError('') }}>{item}</button>)}
          </div>
        </div>}
        {inquiryId && <div className="support-conversation-label"><span>{inquiry?.customer_category ?? '문의 내역'}</span><span>{inquiryId.startsWith('LOCAL-') ? '기기에 보관됨' : inquiryId}</span></div>}
        <div className="support-messages" role="log" aria-label="문의 메시지" aria-live="polite">
          {inquiry?.messages.map((message, index) => <Message key={message.id ?? `${message.sent_at}-${index}`} message={message}/>)}
        </div>
        {inquiryId && !inquiry && !pollError && <p className="support-loading">문의 내역을 불러오는 중…</p>}
        {closed && <div className="support-rating">
          {ratingSaved ? <><h3>의견을 남겨주셔서 감사합니다.</h3><p>더 나은 싱크노트로 보답할게요.</p></> : <form onSubmit={(event) => { void handleRating(event) }}>
            <h3>상담은 도움이 되었나요?</h3>
            <p>소중한 의견을 들려주세요.</p>
            <div className="support-stars" role="group" aria-label="상담 만족도">
              {[1, 2, 3, 4, 5].map((value) => <button key={value} type="button" className={rating >= value ? 'selected' : ''} aria-label={`${value}점`} aria-pressed={rating === value} disabled={ratingBusy} onClick={() => setRating(value)}>★</button>)}
            </div>
            <label className="sr-only" htmlFor="support-rating-comment">한 줄 의견</label>
            <input id="support-rating-comment" value={comment} onChange={(event) => setComment(event.target.value)} placeholder="한 줄 의견을 남겨주세요 (선택)" maxLength={300} disabled={ratingBusy}/>
            <button type="submit" className="button primary" disabled={!rating || ratingBusy}>{ratingBusy ? '보내는 중…' : '평가 보내기'}</button>
          </form>}
        </div>}
        <div ref={end}/>
      </div>
      {(error || pollError) && <div className="support-error" role="alert">{error || pollError}</div>}
      {!closed && (category || inquiryId) && <form className="support-composer" onSubmit={(event) => { void handleSend(event) }}>
        <div className="support-env">함께 보내는 정보: {environment.os}{environment.error_code ? ` · 최근 오류 ${environment.error_code}` : ''}</div>
        {attachments.length > 0 && <div className="support-pending-attachments">
          {attachments.map((attachment) => <span key={attachment.attachment_id}><Icon name="attach"/>{attachment.name}<button type="button" disabled={sending} aria-label={`${attachment.name} 첨부 취소`} onClick={() => setAttachments((current) => current.filter((item) => item.attachment_id !== attachment.attachment_id))}>×</button></span>)}
        </div>}
        <label htmlFor="support-message" className="sr-only">문의 메시지</label>
        <textarea ref={messageInput} id="support-message" value={text} onChange={(event) => setText(event.target.value)} placeholder="궁금한 점을 편하게 남겨주세요" rows={3} disabled={sending}/>
        <div className="support-composer-actions">
          <input ref={fileInput} type="file" accept=".png,.jpg,.jpeg,.pdf,image/png,image/jpeg,application/pdf" hidden onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (file) void handleUpload(file)
          }}/>
          <button type="button" className="icon-button" disabled={uploading || sending} aria-label="파일 첨부 (PNG, JPG, PDF, 최대 10MB)" title="PNG, JPG, PDF · 최대 10MB" onClick={() => fileInput.current?.click()}><Icon name="attach"/></button>
          <span className="support-file-hint">{uploading ? '첨부 중…' : 'PNG, JPG, PDF · 10MB'}</span>
          <button type="submit" className="support-send" disabled={!text.trim() || sending || uploading || Boolean(inquiryId && !inquiry)} aria-label={sending ? '메시지 전송 중' : '메시지 전송'}><Icon name="send"/></button>
        </div>
        <p className="support-privacy">첨부 파일에 개인정보가 보이지 않게 가려주세요.</p>
      </form>}
      {!category && !inquiryId && <footer className="support-footer">작은 질문도 편하게 남겨주세요.</footer>}
    </section>}
    <button ref={launcher} type="button" className={`support-launcher${open ? ' is-open' : ''}`} aria-expanded={open} aria-controls="support-panel" onClick={() => setOpen((current) => !current)}><Icon name={open ? 'close' : 'chat'}/><span>{open ? '닫기' : '문의하기'}</span></button>
  </div>
}

export default SupportWidget
