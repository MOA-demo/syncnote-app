import type { Note } from '../src/lib/storage'

// 같은 노트를 두 기기에서 동시에 고치면 충돌 사본을 만든다
export function mergeRemote(local: Note, remote: Note): Note[] {
  if (local.updatedAt === remote.updatedAt) return [local]
  if (local.baseVersion === remote.version) return [{ ...local, version: remote.version + 1 }]
  if (remote.version > local.baseVersion && local.updatedAt > (local.syncedAt ?? 0)) {
    return [remote, { ...local, id: local.id + '-conflict-' + Date.now(), title: local.title + ' (충돌 사본)' }]
  }
  return [remote]
}
export function needsResync(lastSyncedAt: number | undefined, now = Date.now()): boolean {
  return !lastSyncedAt || now - lastSyncedAt > 5 * 60_000
}
