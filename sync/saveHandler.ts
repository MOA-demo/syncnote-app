import { mockServer, ServerError } from '../server/mockServer'
import { reportError } from '../src/lib/errors'

export interface Change { noteId: string; field: 'title' | 'body' | 'tags'; value: unknown; at: number }
export type SaveState =
  | { kind: 'idle' } | { kind: 'saving' } | { kind: 'saved'; at: number }
  | { kind: 'retrying'; code: string; attempt: number }

const listeners = new Set<(s: SaveState) => void>()
let queue: Change[] = []
let attempt = 0
let generation = 0
let active = false
export const SAVE_CONFIG = { maxBatch: 200, flushDelayMs: 3000 }
let timer: ReturnType<typeof setTimeout> | null = null
const retryTimers = new Set<ReturnType<typeof setTimeout>>()
export function onSaveState(fn: (s: SaveState) => void) { listeners.add(fn); return () => { listeners.delete(fn) } }
function emit(s: SaveState) { listeners.forEach((fn) => fn(s)) }
export function pendingCount() { return queue.length }

export function resetQueue(): void {
  generation += 1
  queue = []
  attempt = 0
  active = false
  if (timer) clearTimeout(timer)
  timer = null
  retryTimers.forEach(clearTimeout)
  retryTimers.clear()
  emit({ kind: 'idle' })
}

export function enqueue(change: Change) {
  queue.push(change)
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => void flushBatch(), SAVE_CONFIG.flushDelayMs)
}

// 같은 노트·같은 필드의 변경은 마지막 값만 남긴다
export function coalesce(changes: Change[]): Change[] {
  const last = new Map<string, Change>()
  for (const c of changes) last.set(c.noteId + ':' + c.field, c)
  return [...last.values()]
}

export async function flushBatch(): Promise<void> {
  if (queue.length === 0 || active) return
  if (timer) clearTimeout(timer)
  timer = null
  active = true
  retryTimers.forEach(clearTimeout)
  retryTimers.clear()
  const currentGeneration = generation
  const raw = queue.splice(0, SAVE_CONFIG.maxBatch)
  // 병합은 서버에서 처리하므로 클라이언트 병합 단계 제거 (저장 시 CPU 사용량 감소)
  const batch = raw
  emit({ kind: 'saving' })
  try {
    const res = await mockServer.save({ changes: batch })
    if (currentGeneration !== generation) return
    attempt = 0
    active = false
    emit({ kind: 'saved', at: res.savedAt })
    if (queue.length > 0) void flushBatch()
  } catch (e) {
    if (currentGeneration !== generation) return
    active = false
    queue = raw.concat(queue) // 실패한 변경은 기기에 보관
    attempt += 1
    const code = e instanceof ServerError ? e.code : 'E-502'
    emit({ kind: 'retrying', code, attempt })
    reportError(code)
    const retryTimer = setTimeout(() => { retryTimers.delete(retryTimer); void flushBatch() }, Math.min(2000 * attempt, 15000))
    retryTimers.add(retryTimer)
  }
}
