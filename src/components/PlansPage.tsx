import { useState } from 'react'
import { setPlan } from '../../auth/session'
import { ANNUAL_DISCOUNT, PLANS, annualPrice, formatKRW, getPlan, type PlanId } from '../../billing/pricing'
import { REFUND_POLICY_TEXT } from '../../billing/refund'

interface PlansPageProps { plan: PlanId; onPlanChange: (plan: PlanId) => void }

const descriptions: Record<PlanId, string> = {
  free: '가벼운 기록을 위한 첫 시작',
  pro: '더 많은 생각을 자유롭게',
  team: '함께 기록하고 함께 성장하기',
}

export function PlansPage({ plan, onPlanChange }: PlansPageProps) {
  const [message, setMessage] = useState('')

  function changePlan(nextPlan: PlanId) {
    const name = getPlan(nextPlan).name
    if (!window.confirm(`${name} 요금제로 변경하시겠습니까? 실제 결제는 발생하지 않으며 이 브라우저의 요금제가 바로 변경됩니다.`)) return
    setPlan(nextPlan)
    onPlanChange(nextPlan)
    setMessage(`${name} 요금제로 변경되었습니다.`)
  }

  return (
    <section className="content-page plans-page">
      <header className="page-heading">
        <span className="eyebrow">PLANS & BILLING</span>
        <h1>생각의 크기에 맞는 요금제</h1>
        <p>나의 기록 방식에 맞춰, 싱크노트와 함께하세요.</p>
      </header>
      {message && <div className="inline-success" role="status">✓ {message}</div>}
      <div className="plan-grid">
        {PLANS.map((item) => (
          <article className={`plan-card${item.id === 'pro' ? ' recommended' : ''}`} key={item.id}>
            {item.id === 'pro' && <div className="plan-recommendation">더 넓은 가능성을 위한 선택</div>}
            <div className="plan-card-heading"><h2>{item.name}</h2>{plan === item.id && <span className="plan-current">현재 요금제</span>}</div>
            <p className="plan-description">{descriptions[item.id]}</p>
            <div className="plan-price"><strong>{item.monthly === 0 ? '무료' : formatKRW(item.monthly)}</strong>{item.monthly > 0 && <span>{item.perUser ? '/ 인 · 월' : '/ 월'}</span>}</div>
            <p className="plan-annual">{item.id === 'pro' ? <>연간 {formatKRW(annualPrice(item))} <span className="discount-badge">{Math.round(ANNUAL_DISCOUNT * 100)}% 할인</span></> : item.id === 'team' ? '팀원 수에 맞춰 유연하게 이용하세요' : '부담 없이 기록을 시작하세요'}</p>
            <button type="button" className={`button ${item.id === 'pro' ? 'primary' : 'secondary'} plan-action`} disabled={plan === item.id} onClick={() => changePlan(item.id)}>{plan === item.id ? '현재 이용 중' : '이 요금제로 변경'}</button>
            <ul className="plan-features">
              <li><span aria-hidden="true">✓</span>기기 {item.devices === null ? '무제한' : `${item.devices}대`}</li>
              <li><span aria-hidden="true">✓</span>{item.storageGB}GB 저장 공간</li>
              <li><span aria-hidden="true">✓</span>파일당 최대 {item.attachmentMB}MB 첨부</li>
              <li><span aria-hidden="true">✓</span>버전 기록 {item.versionHistoryDays === 365 ? '1년' : `${item.versionHistoryDays}일`}</li>
              {item.features.map((feature) => <li key={feature}><span aria-hidden="true">✓</span>{feature}</li>)}
            </ul>
          </article>
        ))}
      </div>
      <div className="policy-card"><h3>환불 정책</h3><p>{REFUND_POLICY_TEXT}</p><p className="muted">요금제 변경은 이 브라우저에 적용되며 실제 결제는 발생하지 않습니다.</p></div>
    </section>
  )
}

export default PlansPage
