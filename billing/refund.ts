export const REFUND_WINDOW_DAYS = 14
export interface RefundInput { paidAt: Date; requestedAt: Date; amount: number; usedPaidFeature: boolean; annual?: boolean }
export interface RefundResult { refundable: boolean; amount: number; reason: string }

export function calcRefund(input: RefundInput): RefundResult {
  const days = Math.floor((input.requestedAt.getTime() - input.paidAt.getTime()) / 86_400_000)
  if (days > REFUND_WINDOW_DAYS) return { refundable: false, amount: 0, reason: `결제 후 ${REFUND_WINDOW_DAYS}일이 지났습니다` }
  return { refundable: true, amount: input.amount, reason: `결제 후 ${REFUND_WINDOW_DAYS}일 이내 전액 환불` }
}

export const REFUND_POLICY_TEXT = `결제일로부터 ${REFUND_WINDOW_DAYS}일 이내에 요청하면 사용 여부와 관계없이 전액 환불합니다.`
