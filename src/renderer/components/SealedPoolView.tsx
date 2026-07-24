import { useMemo, useState } from 'react'
import type { SealedViewModel } from '../../shared/types'
import { estimateMeanGihWr } from '../lib/colorScale'
import { CardRow } from './CardRow'

const COLOR_FILTERS = ['W', 'U', 'B', 'R', 'G'] as const

export function SealedPoolView({ vm }: { vm: SealedViewModel }): React.JSX.Element {
  const [filters, setFilters] = useState<Set<string>>(new Set())
  const mean = estimateMeanGihWr(vm.cards.map((c) => c.rating?.everDrawnWinRate))

  const visible = useMemo(() => {
    if (filters.size === 0) return vm.cards
    return vm.cards.filter((c) => {
      const colors = c.color || 'C'
      return [...colors].some((ch) => filters.has(ch))
    })
  }, [vm.cards, filters])

  const toggle = (color: string): void => {
    setFilters((prev) => {
      const next = new Set(prev)
      if (next.has(color)) next.delete(color)
      else next.add(color)
      return next
    })
  }

  return (
    <div>
      <div className="section-head">
        <span>Pool — {visible.length} of {vm.cards.length} cards</span>
        <span>
          {COLOR_FILTERS.map((color) => (
            <button
              key={color}
              onClick={() => toggle(color)}
              className={`pip-${color}`}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                opacity: filters.size === 0 || filters.has(color) ? 1 : 0.25,
                fontSize: 12
              }}
            >
              ●
            </button>
          ))}
        </span>
      </div>
      {visible.map((card, i) => (
        <CardRow key={`${card.grpId}-${i}`} card={card} mean={mean} />
      ))}
    </div>
  )
}
