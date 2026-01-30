import { useTheme } from './ThemeProvider'

type OjtProgressCardProps = {
  currentHours?: number
  currentMinutes?: number
  totalHours?: number
}

export default function OjtProgressCard({ currentHours = 0, currentMinutes = 0, totalHours = 486 }: OjtProgressCardProps) {
  const { theme } = useTheme()
  const isLight = theme === 'light'
  const totalMinutesTarget = totalHours * 60
  const currentTotalMinutes = Math.max(0, Math.min(currentHours * 60 + currentMinutes, totalMinutesTarget))
  const remainingMinutes = Math.max(totalMinutesTarget - currentTotalMinutes, 0)
  const percent = totalMinutesTarget === 0 ? 0 : Math.round((currentTotalMinutes / totalMinutesTarget) * 100)

  const displayHours = Math.floor(currentTotalMinutes / 60)
  const displayMinutes = currentTotalMinutes % 60
  const remainingHours = Math.floor(remainingMinutes / 60)
  const remainingMins = remainingMinutes % 60

  return (
    <div className={`rounded-2xl p-4 ring-1 ${isLight ? 'bg-white text-slate-900 ring-slate-200' : 'bg-white/5 text-white ring-white/10'}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className={`text-sm ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>OJT Progress</p>
          <p className="text-lg font-semibold">{displayHours}h {displayMinutes}m / {totalHours}h</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${isLight ? 'bg-blue-50 text-blue-700 ring-blue-200' : 'bg-blue-500/10 text-blue-100 ring-blue-400/30'}`}>
          {percent}%
        </span>
      </div>

      <div className={`mt-3 h-2 w-full rounded-full ${isLight ? 'bg-slate-200' : 'bg-white/10'}`}>
        <div
          className={`h-full rounded-full bg-gradient-to-r ${isLight ? 'from-blue-500 to-blue-600' : 'from-blue-400 to-blue-600'}`}
          style={{ width: `${percent}%` }}
        />
      </div>

      <p className={`mt-2 text-xs ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Remaining: {remainingHours}h {remainingMins}m</p>
    </div>
  )
}
