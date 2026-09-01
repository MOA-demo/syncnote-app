// 저장 서버 클라이언트. 로컬 개발·QA에서는 운영 게이트웨이와 같은 제한을 브라우저에서 재현한다.
// - 요청 본문 8KB 초과 시 게이트웨이 502
// - 1분에 60회 초과 시 429
export const MAX_REQUEST_BYTES = 8 * 1024
const RATE_LIMIT_PER_MIN = 60

export class ServerError extends Error {
  constructor(public status: number, public code: string) { super(code) }
}

let calls: number[] = []

// QA용 장애 주입: ?fault=e502 또는 localStorage 'syncnote.fault' = 'e502'
function faultFlag(name: string): boolean {
  const q = new URLSearchParams(window.location.search).get('fault')
  return q === name || localStorage.getItem('syncnote.fault') === name
}

export const mockServer = {
  async save(payload: unknown): Promise<{ savedAt: number }> {
    await new Promise((r) => setTimeout(r, 120))
    const now = Date.now()
    calls = calls.filter((t) => now - t < 60_000)
    calls.push(now)
    if (calls.length > RATE_LIMIT_PER_MIN) throw new ServerError(429, 'E-429')
    if (faultFlag('e502')) throw new ServerError(502, 'E-502')
    const size = new Blob([JSON.stringify(payload)]).size
    if (size > MAX_REQUEST_BYTES) throw new ServerError(502, 'E-502')
    return { savedAt: now }
  },
}
