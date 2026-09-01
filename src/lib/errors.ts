export type ErrorCode = 'E-401' | 'E-413' | 'E-429' | 'E-502'

export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  'E-401': '세션이 만료되었습니다. 다시 로그인해 주세요.',
  'E-413': '첨부 파일 용량을 초과했습니다. (Free 10MB, Pro·Team 100MB)',
  'E-429': '요청이 너무 많습니다. 1분 후 다시 시도해 주세요.',
  'E-502': '저장 서버 응답 실패. 작성 내용은 기기에 보관되고 자동으로 다시 저장을 시도합니다.',
}

export interface ErrorNotice {
  id: string
  code: ErrorCode
  message: string
  detail?: string
  at: number
}

const listeners = new Set<(notice: ErrorNotice) => void>()
const lastShown = new Map<ErrorCode, number>()
let sequence = 0

export function isErrorCode(code: string): code is ErrorCode {
  return Object.prototype.hasOwnProperty.call(ERROR_MESSAGES, code)
}

export function reportError(code: ErrorCode | string, detail?: string): void {
  const safeCode = isErrorCode(code) ? code : 'E-502'
  const at = Date.now()
  try {
    localStorage.setItem('syncnote.lastError', JSON.stringify({ code: safeCode, at }))
  } catch {
    // 저장 공간이 부족해도 오류 안내는 표시한다.
  }
  const previous = lastShown.get(safeCode)
  if (previous !== undefined && at - previous < 10_000) return
  lastShown.set(safeCode, at)
  const notice: ErrorNotice = {
    id: `${at}-${++sequence}`, code: safeCode, at, detail,
    message: `[${safeCode}] ${ERROR_MESSAGES[safeCode]}`,
  }
  listeners.forEach((listener) => listener(notice))
}

export function onError(listener: (notice: ErrorNotice) => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
