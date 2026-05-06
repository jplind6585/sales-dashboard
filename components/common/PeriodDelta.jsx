// Reusable period-over-period delta indicator.
// direction: 'higher_better' (green=up) | 'lower_better' (green=down)
// format: 'number' | 'percent' | 'score'

export default function PeriodDelta({ current, prior, format = 'number', direction = 'higher_better', className = '' }) {
  if (current == null || prior == null) return null
  const delta = current - prior
  if (Math.abs(delta) < 0.05) return <span className={`text-xs text-gray-400 ${className}`}>—</span>

  const isGood = direction === 'higher_better' ? delta > 0 : delta < 0
  const colorClass = isGood ? 'text-green-600' : 'text-red-500'
  const arrow = delta > 0 ? '↑' : '↓'
  const abs = Math.abs(delta)

  let display
  if (format === 'percent') display = `${abs.toFixed(1)}%`
  else if (format === 'score') display = abs.toFixed(1)
  else display = Math.round(abs)

  return (
    <span className={`text-xs font-medium ${colorClass} ${className}`} title={`Was ${format === 'score' ? prior.toFixed(1) : Math.round(prior)}${format === 'percent' ? '%' : ''} last period`}>
      {arrow}{display}
    </span>
  )
}
