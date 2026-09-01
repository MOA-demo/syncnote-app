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
const retryTimers = new Set<ReturnType<typeof setTimeout>>()
export function onSaveState(fn: (s: SaveState) => void) { listeners.add(fn); return () => { listeners.delete(fn) } }
function emit(s: SaveState) { listeners.forEach((fn) => fn(s)) }
export function pendingCount() { return queue.length }

export function resetQueue(): void {
  generation += 1
  queue = []
  attempt = 0
  retryTimers.forEach(clearTimeout)
  retryTimers.clear()
  emit({ kind: 'idle' })
}

export function enqueue(change: Change) { queue.push(change); void flushBatch() }

export async function flushBatch(): Promise<void> {
  if (queue.length === 0) return
  retryTimers.forEach(clearTimeout)
  retryTimers.clear()
  const currentGeneration = generation
  const batch = queue.splice(0, queue.length)
  emit({ kind: 'saving' })
  try {
    const res = await mockServer.save({ changes: batch })
    if (currentGeneration !== generation) return
    attempt = 0
    emit({ kind: 'saved', at: res.savedAt })
    if (queue.length > 0) void flushBatch()
  } catch (e) {
    if (currentGeneration !== generation) return
    queue = batch.concat(queue) // 실패한 변경은 기기에 보관
    attempt += 1
    const code = e instanceof ServerError ? e.code : 'E-502'
    emit({ kind: 'retrying', code, attempt })
    reportError(code)
    const retryTimer = setTimeout(() => { retryTimers.delete(retryTimer); void flushBatch() }, Math.min(2000 * attempt, 15000))
    retryTimers.add(retryTimer)
  }
}
