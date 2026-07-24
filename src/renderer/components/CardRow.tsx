import { useState } from 'react'
import type { RatedCard } from '../../shared/types'
import { winRateColor } from '../lib/colorScale'

export function CardRow({ card, mean }: { card: RatedCard; mean: number }): React.JSX.Element {
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null)
  const r = card.rating

  return (
    <div
      className="row"
      onMouseMove={(e) => card.imageUrl && setHover({ x: e.clientX, y: e.clientY })}
      onMouseLeave={() => setHover(null)}
    >
      <span className="wr" style={{ color: winRateColor(r?.everDrawnWinRate, mean) }}>
        {fmtPct(r?.everDrawnWinRate)}
      </span>
      <span className={`rarity ${card.rarity || 'common'}`} title={card.rarity} />
      <span className="pips">{colorPips(card.color)}</span>
      <span className="name" title={card.name}>
        {card.name}
      </span>
      <span className="minor" title="ALSA / OH WR">
        {fmtNum(r?.avgSeen)} · {fmtPct(r?.openingHandWinRate)}
      </span>
      {card.personal && (
        <span className="personal" title="Your win% / play% with this card">
          {fmtPct(card.personal.winRate)} / {fmtPct(card.personal.playRate)}
        </span>
      )}
      {hover && card.imageUrl && (
        <img
          className="preview"
          src={card.imageUrl}
          alt=""
          style={{
            left: Math.min(hover.x + 14, window.innerWidth - 244),
            top: Math.min(hover.y - 60, window.innerHeight - 330)
          }}
        />
      )}
    </div>
  )
}

function colorPips(colors: string): React.JSX.Element[] {
  const chars = colors && colors.length > 0 ? colors.split('') : ['C']
  return chars.map((c, i) => (
    <span key={i} className={`pip-${c}`}>
      ●
    </span>
  ))
}

function fmtPct(v: number | null | undefined): string {
  return typeof v === 'number' && v > 0 ? `${(v * 100).toFixed(1)}%` : '–'
}

function fmtNum(v: number | null | undefined): string {
  return typeof v === 'number' ? v.toFixed(1) : '–'
}
