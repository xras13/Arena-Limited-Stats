export function winRateColor(winRate: number | null | undefined, mean: number): string {
  if (typeof winRate !== 'number' || winRate <= 0) return 'var(--text-dim)'
  const t = Math.max(-1, Math.min(1, (winRate - mean) / 0.06))
  const hue = t < 0 ? 8 : 168
  const saturation = Math.round(Math.abs(t) * 75)
  const lightness = 62 + Math.round(Math.abs(t) * 6)
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`
}

export function estimateMeanGihWr(rates: Array<number | null | undefined>): number {
  const valid = rates.filter((r): r is number => typeof r === 'number' && r > 0)
  if (valid.length === 0) return 0.55
  return valid.reduce((a, b) => a + b, 0) / valid.length
}
