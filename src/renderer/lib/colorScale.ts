/**
 * Diverging color scale for win rates, centered on the set's mean GIH WR
 * (power level varies wildly between sets, so a fixed "55% is good" lies).
 * ±6 percentage points from the mean saturates the scale.
 */
export function winRateColor(winRate: number | null | undefined, mean: number): string {
  if (typeof winRate !== 'number' || winRate <= 0) return 'var(--text-dim)'
  const t = Math.max(-1, Math.min(1, (winRate - mean) / 0.06))
  // red (< mean) -> grey (mean) -> teal (> mean)
  const hue = t < 0 ? 8 : 168
  const saturation = Math.round(Math.abs(t) * 75)
  const lightness = 62 + Math.round(Math.abs(t) * 6)
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`
}

/** Approximate the set mean from rated cards (main sends per-card ratings only). */
export function estimateMeanGihWr(rates: Array<number | null | undefined>): number {
  const valid = rates.filter((r): r is number => typeof r === 'number' && r > 0)
  if (valid.length === 0) return 0.55
  return valid.reduce((a, b) => a + b, 0) / valid.length
}
