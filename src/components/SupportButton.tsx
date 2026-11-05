import { useState } from 'react'
import { getSupportUrl, SupportUrlError } from '../lib/supportUrl'

export default function SupportButton() {
  const [notice, setNotice] = useState('')

  function openSupport() {
    setNotice('')
    try {
      const url = getSupportUrl(import.meta.env.VITE_SUPPORT_URL ?? '')
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (error) {
      setNotice(error instanceof SupportUrlError
        ? error.message
        : '이 브라우저에 고객 정보를 보관할 수 없습니다. 브라우저 저장소 설정을 확인해 주세요.')
    }
  }

  return <div className="support-entry">
    {notice && <div className="support-notice" id="support-notice" role="status">
      <p>{notice}</p>
      <button type="button" className="icon-button" aria-label="문의 안내 닫기" onClick={() => setNotice('')}>×</button>
    </div>}
    <button type="button" className="support-launcher" aria-label="문의하기 (새 탭)" aria-describedby={notice ? 'support-notice' : undefined} onClick={openSupport}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M20 11.5a8.3 8.3 0 0 1-.9 3.8 8.4 8.4 0 0 1-7.6 4.7 8.3 8.3 0 0 1-3.8-.9L2 21l1.9-5.7a8.3 8.3 0 0 1-.9-3.8 8.4 8.4 0 0 1 4.7-7.6 8.3 8.3 0 0 1 3.8-.9h.5a8.4 8.4 0 0 1 8 8v.5Z" /><path d="M7 10h9M7 14h5" />
      </svg>
      <span>문의하기</span>
      <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 3H3v10h10v-3M9 2h5v5M14 2 7 9" /></svg>
    </button>
  </div>
}
