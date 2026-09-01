import { useEffect, useRef, useState } from 'react'
import { onError, type ErrorNotice } from '../lib/errors'

export function Toasts() {
  const [notices, setNotices] = useState<ErrorNotice[]>([])
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>())

  useEffect(() => {
    const activeTimers = timers.current
    const unsubscribe = onError((notice) => {
      setNotices((current) => [...current, notice].slice(-4))
      activeTimers.set(notice.id, setTimeout(() => {
        setNotices((current) => current.filter((item) => item.id !== notice.id))
        activeTimers.delete(notice.id)
      }, 9000))
    })
    return () => {
      unsubscribe()
      activeTimers.forEach(clearTimeout)
      activeTimers.clear()
    }
  }, [])

  function dismiss(id: string) {
    const timer = timers.current.get(id)
    if (timer) clearTimeout(timer)
    timers.current.delete(id)
    setNotices((current) => current.filter((item) => item.id !== id))
  }

  return <div className="toast-region" aria-live="assertive" aria-relevant="additions">
    {notices.map((notice) => <div className="toast" role="alert" key={notice.id}>
      <span className="toast-icon" aria-hidden="true">!</span>
      <div className="toast-copy"><p>{notice.message}</p>{notice.detail && <small>{notice.detail}</small>}</div>
      <button className="icon-button toast-close" type="button" aria-label="오류 알림 닫기" onClick={() => dismiss(notice.id)}>×</button>
    </div>)}
  </div>
}

export default Toasts
