import { useEffect, useState } from 'react'
import { onSaveState, pendingCount, type SaveState } from '../../sync/saveHandler'

export function SaveStatus() {
  const [state, setState] = useState<SaveState>({ kind: 'idle' })
  useEffect(() => onSaveState(setState), [])
  const pending = pendingCount()
  const label = state.kind === 'retrying' ? `[${state.code}] 저장 실패 · 다시 시도 중 (${state.attempt}회)`
    : state.kind === 'saving' ? '저장 중…'
    : pending ? '저장 대기 중…'
    : state.kind === 'saved' ? `저장됨 ${new Date(state.at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })}` : '모든 변경 사항 저장됨'
  return <div className={`save-status ${state.kind}`} role="status" aria-live="polite"><span className="status-dot" />{label}{pending > 0 && <small>대기 {pending}개</small>}</div>
}
export default SaveStatus
