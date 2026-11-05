import { getEnv } from './env'

export class SupportUrlError extends Error {}

export function getCustomerId(): string {
  const current = localStorage.getItem('syncnote.customerId')
  if (current && /^U-2\d{3}$/.test(current)) return current
  const id = `U-${2000 + Math.floor(Math.random() * 1000)}`
  localStorage.setItem('syncnote.customerId', id)
  return id
}

export function getSupportUrl(configuredUrl: string): string {
  if (!configuredUrl.trim()) {
    throw new SupportUrlError('문의 페이지가 아직 준비되지 않았습니다. 잠시 후 다시 이용해 주세요.')
  }
  let url: URL
  try {
    url = new URL(configuredUrl.trim())
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error()
  } catch {
    throw new SupportUrlError('문의 페이지 주소를 확인할 수 없습니다. 잠시 후 다시 이용해 주세요.')
  }

  // 설정 주소와 현재 페이지의 검색어·해시는 전달하지 않는다.
  url.search = ''
  url.hash = ''
  const environment = getEnv()
  url.searchParams.set('cid', getCustomerId())
  url.searchParams.set('os', environment.os)
  url.searchParams.set('app_version', environment.app_version)
  if (environment.error_code) url.searchParams.set('error_code', environment.error_code)
  url.searchParams.set('from', window.location.origin + window.location.pathname)
  return url.href
}
