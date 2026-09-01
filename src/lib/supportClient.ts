import { getEnv } from './env'

const API_URL = (import.meta.env.VITE_SUPPORT_API_URL ?? '').trim().replace(/\/+$/, '')
const TENANT_ID = import.meta.env.VITE_TENANT_ID || 'syncnote'
const ATTACHMENT_KEY = 'syncnote.supportAttachments'
export const SUPPORT_CATEGORIES = ['이용 방법', '계정', '결제', '기능 오류', '개선 요청', '기타'] as const
export type SupportCategory = typeof SUPPORT_CATEGORIES[number]
export type InquiryStatus = '접수' | '담당자 확인 중' | '추가 정보 필요' | '답변 완료' | '상담 종료'

export interface SupportAttachment {
  attachment_id: string
  url: string
  mime: string
  size: number
  name?: string
}

export interface SupportMessage {
  sender: string
  text: string
  sent_at: string
  attachments: string[]
  id?: string
  local_echo?: boolean
}

export interface SupportInquiry {
  inquiry_id: string
  status: InquiryStatus
  messages: SupportMessage[]
  customer_category?: SupportCategory
  remote_cursor?: string
}

export interface InquiryInput {
  message: string
  customer_category: SupportCategory
  attachments?: string[]
}

export interface SupportRating { rating: number; comment: string }

export class SupportClientError extends Error {
  constructor(public status?: number, message = '잠시 후 다시 시도해 주세요') { super(message) }
}

function readLocal<T>(key: string): T | null {
  try { const value = localStorage.getItem(key); return value ? JSON.parse(value) as T : null } catch { return null }
}

function writeLocal(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value))
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' ? value as Record<string, unknown> : {}
}

function koreanTime(): string {
  return new Date(Date.now() + 9 * 60 * 60_000).toISOString().replace('Z', '+09:00')
}

function localId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function getCustomerId(): string {
  const current = localStorage.getItem('syncnote.customerId')
  if (current && /^U-2\d{3}$/.test(current)) return current
  const id = `U-${2000 + Math.floor(Math.random() * 1000)}`
  localStorage.setItem('syncnote.customerId', id)
  return id
}

export function isOfflineMode(inquiryId?: string): boolean {
  return !API_URL || Boolean(inquiryId?.startsWith('LOCAL-'))
}

export function getOpenInquiryId(): string | null {
  return localStorage.getItem('syncnote.openInquiry')
}

export function getCachedInquiry(inquiryId: string): SupportInquiry | null {
  const cached = readLocal<SupportInquiry>(`syncnote.inquiry.${inquiryId}`)
  return cached && cached.inquiry_id === inquiryId && Array.isArray(cached.messages) ? cached : null
}

function cacheInquiry(inquiry: SupportInquiry): SupportInquiry {
  writeLocal(`syncnote.inquiry.${inquiry.inquiry_id}`, inquiry)
  localStorage.setItem('syncnote.openInquiry', inquiry.inquiry_id)
  return inquiry
}

export function getAttachment(attachmentId: string): SupportAttachment | null {
  return readLocal<Record<string, SupportAttachment>>(ATTACHMENT_KEY)?.[attachmentId] ?? null
}

function cacheAttachment(attachment: SupportAttachment): SupportAttachment {
  const current = readLocal<Record<string, SupportAttachment>>(ATTACHMENT_KEY) ?? {}
  writeLocal(ATTACHMENT_KEY, { ...current, [attachment.attachment_id]: attachment })
  return attachment
}

async function request(path: string, init: RequestInit = {}): Promise<unknown> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15_000)
  try {
    const response = await fetch(`${API_URL}${path}`, { ...init, signal: controller.signal })
    if (!response.ok) throw new SupportClientError(response.status)
    const body = await response.text()
    return body ? JSON.parse(body) as unknown : null
  } catch (error) {
    if (error instanceof SupportClientError) throw error
    throw new SupportClientError()
  } finally { clearTimeout(timeout) }
}

function postJson(path: string, payload: unknown): Promise<unknown> {
  return request(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
}

function statusOf(value: unknown, fallback: InquiryStatus = '접수'): InquiryStatus {
  const statuses: InquiryStatus[] = ['접수', '담당자 확인 중', '추가 정보 필요', '답변 완료', '상담 종료']
  return statuses.includes(value as InquiryStatus) ? value as InquiryStatus : fallback
}

function attachmentIds(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item: unknown) => {
    if (typeof item === 'string') return [item]
    const data = record(item)
    if (typeof data.attachment_id !== 'string') return []
    const previous = getAttachment(data.attachment_id)
    cacheAttachment({
      attachment_id: data.attachment_id,
      url: typeof data.url === 'string' ? data.url : previous?.url ?? '',
      mime: typeof data.mime === 'string' ? data.mime : previous?.mime ?? '',
      size: typeof data.size === 'number' ? data.size : previous?.size ?? 0,
      name: typeof data.name === 'string' ? data.name : previous?.name,
    })
    return [data.attachment_id]
  })
}

function messageOf(value: unknown, fallbackTime = koreanTime()): SupportMessage | null {
  const data = record(value)
  if (typeof data.sender !== 'string' || typeof data.text !== 'string') return null
  return {
    sender: data.sender, text: data.text,
    sent_at: typeof data.sent_at === 'string' && Number.isFinite(Date.parse(data.sent_at)) ? data.sent_at : fallbackTime,
    attachments: attachmentIds(data.attachments),
    id: typeof data.message_id === 'string' ? data.message_id : typeof data.id === 'string' ? data.id : undefined,
  }
}

function messageKey(message: SupportMessage): string {
  return message.id ?? JSON.stringify([message.sender, message.text, message.sent_at, message.attachments])
}

function sameContent(a: SupportMessage, b: SupportMessage): boolean {
  return a.sender === b.sender && a.text === b.text
    && [...a.attachments].sort().join(',') === [...b.attachments].sort().join(',')
}

function mergeMessages(current: SupportMessage[], incoming: SupportMessage[]): SupportMessage[] {
  const merged = [...current]
  for (const message of incoming) {
    const exact = merged.findIndex((item) => messageKey(item) === messageKey(message))
    if (exact >= 0) { merged[exact] = message; continue }
    // 전송 직후 표시한 말풍선을 서버가 돌려준 메시지로 교체한다.
    const echo = merged.findIndex((item) => item.local_echo && sameContent(item, message))
    if (echo >= 0) merged[echo] = message
    else merged.push(message)
  }
  return merged.sort((a, b) => Date.parse(a.sent_at) - Date.parse(b.sent_at))
}

export async function createInquiry(input: InquiryInput): Promise<SupportInquiry> {
  const customer_id = getCustomerId()
  const sent_at = koreanTime()
  const customerMessage: SupportMessage = {
    sender: 'customer', text: input.message, sent_at, attachments: input.attachments ?? [], local_echo: !isOfflineMode(),
  }
  if (isOfflineMode()) return cacheInquiry({
    inquiry_id: localId('LOCAL'), status: '접수', customer_category: input.customer_category, messages: [customerMessage],
  })
  const data = record(await postJson('/api/v1/inquiries', {
    tenant_id: TENANT_ID, customer_id, message: input.message, customer_category: input.customer_category,
    env: getEnv(), attachments: input.attachments ?? [], created_at: null,
  }))
  if (typeof data.inquiry_id !== 'string') throw new SupportClientError()
  const automatic = messageOf(data.auto_message, sent_at)
  return cacheInquiry({
    inquiry_id: data.inquiry_id, status: statusOf(data.status), customer_category: input.customer_category,
    messages: automatic ? [customerMessage, { ...automatic, local_echo: true }] : [customerMessage],
  })
}

export async function sendMessage(inquiryId: string, text: string, attachments: string[] = []): Promise<SupportInquiry> {
  const localMessage: SupportMessage = { sender: 'customer', text, attachments, sent_at: koreanTime(), local_echo: !isOfflineMode(inquiryId) }
  const previousMatches = getCachedInquiry(inquiryId)?.messages.filter((message) => sameContent(message, localMessage)).length ?? 0
  let sent = localMessage
  if (!isOfflineMode(inquiryId)) {
    const response = await postJson(`/api/v1/inquiries/${encodeURIComponent(inquiryId)}/messages`, { sender: 'customer', text, attachments })
    sent = messageOf(record(response).message) ?? messageOf(response) ?? localMessage
  }
  const inquiry = getCachedInquiry(inquiryId) ?? { inquiry_id: inquiryId, status: '접수' as const, messages: [] }
  // 응답을 기다리는 동안 조회된 메시지가 있으면 말풍선을 중복 추가하지 않는다.
  if (!isOfflineMode(inquiryId) && ((sent.id && inquiry.messages.some((message) => message.id === sent.id))
    || inquiry.messages.filter((message) => sameContent(message, localMessage)).length > previousMatches)) {
    return inquiry
  }
  return cacheInquiry({ ...inquiry, messages: [...inquiry.messages, sent] })
}

export async function uploadAttachment(file: File, inquiryId?: string): Promise<SupportAttachment> {
  if (file.size > 10 * 1024 * 1024) throw new SupportClientError(undefined, '첨부 파일은 10MB 이하로 선택해 주세요.')
  const extension = file.name.split('.').pop()?.toLowerCase()
  const allowedExtensions = ['png', 'jpg', 'jpeg', 'pdf']
  const allowedMimes = ['image/png', 'image/jpeg', 'application/pdf']
  if (!extension || !allowedExtensions.includes(extension) || (file.type && !allowedMimes.includes(file.type))) {
    throw new SupportClientError(undefined, 'PNG, JPG, PDF 파일만 첨부할 수 있습니다.')
  }
  if (isOfflineMode(inquiryId)) return cacheAttachment({
    attachment_id: localId('ATT'), url: '', mime: file.type, size: file.size, name: file.name,
  })
  const form = new FormData()
  form.append('file', file)
  const data = record(await request('/api/v1/attachments', { method: 'POST', body: form }))
  if (typeof data.attachment_id !== 'string') throw new SupportClientError()
  return cacheAttachment({
    attachment_id: data.attachment_id, url: typeof data.url === 'string' ? data.url : '',
    mime: typeof data.mime === 'string' ? data.mime : file.type,
    size: typeof data.size === 'number' ? data.size : file.size, name: file.name,
  })
}

export async function fetchInquiry(inquiryId: string, since?: string): Promise<SupportInquiry> {
  const current = getCachedInquiry(inquiryId) ?? { inquiry_id: inquiryId, status: '접수' as const, messages: [] }
  if (isOfflineMode(inquiryId)) return current
  const cursor = since ?? current.remote_cursor
  const query = cursor ? `?${new URLSearchParams({ since: cursor }).toString()}` : ''
  const data = record(await request(`/api/v1/inquiries/${encodeURIComponent(inquiryId)}${query}`))
  if (!Array.isArray(data.messages)) throw new SupportClientError()
  const incoming = data.messages.map((value: unknown) => messageOf(value)).filter((value): value is SupportMessage => value !== null)
  const latest = incoming.reduce<string | undefined>((last, message) => !last || Date.parse(message.sent_at) > Date.parse(last) ? message.sent_at : last, cursor)
  // 조회와 전송이 겹쳐도 가장 최근의 로컬 메시지를 보존한다.
  const fresh = getCachedInquiry(inquiryId) ?? current
  return cacheInquiry({ ...fresh, status: statusOf(data.status, fresh.status), messages: mergeMessages(fresh.messages, incoming), remote_cursor: latest })
}

export function getSavedRating(inquiryId: string): SupportRating | null {
  return readLocal<SupportRating>(`syncnote.rating.${inquiryId}`)
}

export async function submitRating(inquiryId: string, rating: number, comment: string): Promise<void> {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new SupportClientError(undefined, '별점을 선택해 주세요.')
  const payload = { rating, comment }
  if (!isOfflineMode(inquiryId)) {
    try { await postJson(`/api/v1/inquiries/${encodeURIComponent(inquiryId)}/rating`, payload) }
    catch (error) {
      if (!(error instanceof SupportClientError) || (error.status !== 404 && error.status !== 501)) throw error
    }
  }
  writeLocal(`syncnote.rating.${inquiryId}`, payload)
}
