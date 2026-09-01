import { getPlan, type PlanId } from '../billing/pricing'

export class AttachmentError extends Error {
  code = 'E-413' as const
  constructor(public limitMB: number, public sizeMB: number) {
    super(`첨부 파일 용량 초과 (${sizeMB.toFixed(1)}MB / 최대 ${limitMB}MB)`)
  }
}

export function checkAttachment(file: { size: number }, plan: PlanId): void {
  const limitMB = getPlan(plan).attachmentMB
  const sizeMB = file.size / (1024 * 1024)
  if (sizeMB > limitMB) throw new AttachmentError(limitMB, sizeMB)
}
