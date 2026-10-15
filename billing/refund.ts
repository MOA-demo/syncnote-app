export const REFUND_WINDOW_DAYS = 7
export interface RefundInput { paidAt: Date; requestedAt: Date; amount: number; usedPaidFeature: boolean; annual?: boolean }
export interface RefundResult { refundable: boolean; amount: number; reason: string }

export function calcRefund(input: RefundInput): RefundResult {
  const elapsed = Math.max(0, input.requestedAt.getTime() - input.paidAt.getTime())
  const days = Math.floor(elapsed / 86_400_000)
  if (input.annual) {
    if (days <= REFUND_WINDOW_DAYS) return { refundable: true, amount: input.amount, reason: `연간 결제 후 ${REFUND_WINDOW_DAYS}일 이내 전액 환불` }
    const usedMonths = Math.ceil(elapsed / (30 * 86_400_000))
    const remainingMonths = Math.max(0, 12 - usedMonths)
    const amount = Math.max(0, Math.round(remainingMonths * (input.amount / 12) * 0.9))
    return { refundable: amount > 0, amount, reason: `남은 ${remainingMonths}개월 요금에서 위약금 10%를 제외한 금액 환불` }
  }
  if (days > REFUND_WINDOW_DAYS) return { refundable: false, amount: 0, reason: `결제 후 ${REFUND_WINDOW_DAYS}일이 지났습니다. 다음 결제일부터 해지가 적용됩니다.` }
  if (!input.usedPaidFeature) return { refundable: true, amount: input.amount, reason: `결제 후 ${REFUND_WINDOW_DAYS}일 이내 유료 기능 미사용 전액 환불` }
  const amount = Math.max(0, Math.round(input.amount - (input.amount / 30) * days))
  return { refundable: amount > 0, amount, reason: `유료 기능 사용 ${days}일의 요금을 차감한 금액 환불` }
}

export const REFUND_POLICY_TEXT = '결제일로부터 7일 이내이고 유료 기능 사용 이력이 없으면 전액 환불합니다. 7일 이내라도 사용 이력이 있으면 사용 일수만큼 뺀 금액을 환불합니다. 7일이 지나면 환불되지 않으며 다음 결제일부터 해지가 적용됩니다.'
