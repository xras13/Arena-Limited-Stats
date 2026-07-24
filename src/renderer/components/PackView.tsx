import { useState } from 'react'
import type { PackViewModel } from '../../shared/types'
import { estimateMeanGihWr } from '../lib/colorScale'
import { CardRow } from './CardRow'

export function PackView({ vm }: { vm: PackViewModel }): React.JSX.Element {
  const [showPicked, setShowPicked] = useState(false)
  const mean = estimateMeanGihWr(
    [...vm.cards, ...vm.picked].map((c) => c.rating?.everDrawnWinRate)
  )

  return (
    <div>
      <div className="section-head">
        <span>
          Pack {vm.pack} · Pick {vm.pick} — {vm.cards.length} cards
        </span>
      </div>
      <div className="col-head">
        <span style={{ width: 46, textAlign: 'right' }}>GIH WR</span>
        <span style={{ width: 8 }} />
        <span style={{ width: 40 }} />
        <span style={{ flex: 1 }}>Card</span>
        <span style={{ width: 60, textAlign: 'right' }}>ALSA · OH</span>
        {vm.personalConnected && <span style={{ width: 62, textAlign: 'right' }}>You W/P</span>}
      </div>
      {vm.cards.map((card) => (
        <CardRow key={card.grpId} card={card} mean={mean} />
      ))}

      <div
        className="section-head"
        style={{ cursor: 'pointer' }}
        onClick={() => setShowPicked((v) => !v)}
      >
        <span>
          {showPicked ? '▾' : '▸'} Picked so far ({vm.picked.length})
        </span>
      </div>
      {showPicked &&
        vm.picked.map((card, i) => <CardRow key={`${card.grpId}-${i}`} card={card} mean={mean} />)}
    </div>
  )
}
