export type PlanId = 'free' | 'pro' | 'team'

export const PRO_MONTHLY = 12900
export const TEAM_MONTHLY_PER_USER = 14900
export const ANNUAL_DISCOUNT = 0.2
export const PRO_ANNUAL = Math.round(PRO_MONTHLY * 12 * (1 - ANNUAL_DISCOUNT))

export interface Plan {
  id: PlanId
  name: string
  monthly: number
  perUser?: boolean
  devices: number | null
  storageGB: number
  attachmentMB: number
  versionHistoryDays: number
  features: string[]
}

export const PLANS: Plan[] = [
  { id: 'free', name: 'Free', monthly: 0, devices: 2, storageGB: 1, attachmentMB: 10, versionHistoryDays: 7, features: ['보기 전용 링크 공유'] },
  { id: 'pro', name: 'Pro', monthly: PRO_MONTHLY, devices: null, storageGB: 50, attachmentMB: 100, versionHistoryDays: 30, features: ['편집 권한 링크 공유'] },
  { id: 'team', name: 'Team', monthly: TEAM_MONTHLY_PER_USER, perUser: true, devices: null, storageGB: 50, attachmentMB: 100, versionHistoryDays: 365, features: ['Pro 기능 전체', '공유 워크스페이스', '멤버 권한 관리'] },
]

export function getPlan(id: PlanId): Plan {
  return PLANS.find((plan) => plan.id === id) ?? PLANS[0]
}

export function annualPrice(plan: Plan): number {
  return Math.round(plan.monthly * 12 * (1 - ANNUAL_DISCOUNT))
}

export function prorate(fromMonthly: number, toMonthly: number, remainingDays: number, cycleDays = 30): number {
  return Math.round(((toMonthly - fromMonthly) * remainingDays) / cycleDays)
}

export function formatKRW(amount: number): string {
  return amount.toLocaleString('ko-KR') + '원'
}
