'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import { useTheme } from '@/components/ThemeProvider'

import { supabase } from '@/lib/supabase'

type RecordEntry = {
  date: string
  note: string
  timeIn?: string
  timeOut?: string
  durationMinutes?: number
  savedAt?: string
}

const formatTime = (d: Date) => d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })
const formatDateLabel = (d: Date) => d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
const formatDateKey = (d: Date) => d.toLocaleDateString('en-CA') // YYYY-MM-DD without timezone shift
const formatHours = (mins?: number) => {
  if (!mins || Number.isNaN(mins)) return '0h'
  const h = Math.floor(mins / 60)
  const m = Math.floor(mins % 60)
  return m ? `${h}h ${m}m` : `${h}h`
}
const safeDate = (value?: string | null) => {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}
const makeDateTime = (dateStr?: string | null, timeStr?: string | null) => {
  if (!dateStr || !timeStr) return null
  // Ensure time has seconds
  const normalizedTime = timeStr.length === 5 ? `${timeStr}:00` : timeStr
  let d = new Date(`${dateStr}T${normalizedTime}`)
  if (Number.isNaN(d.getTime())) {
    // Fallback for legacy AM/PM strings
    d = new Date(`${dateStr} ${timeStr}`)
  }
  return Number.isNaN(d.getTime()) ? null : d
}
const toTimeString = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
const formatNoteText = (note?: string) => {
  if (!note) return ''
  // Insert line breaks before numbered or bullet-like markers, then trim consecutive spaces.
  const withBreaks = note
    .replace(/\s*(?=(?:\d+\.\s))/g, '\n')
    .replace(/\s*(?=(?:[-*•]\s))/g, '\n')
  return withBreaks
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n')
}

// On-site coordinates (provided): J23X+XHW San Juan City, Metro Manila
const OFFICE_COORDS = { lat: 14.605213, lng: 121.048929 }
// Increased radius to account for GPS drift and device variance
const OFFICE_RADIUS_METERS = 800

const distanceMeters = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const R = 6371000
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLon = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

export default function AttendancePage() {
  const [timeIn, setTimeIn] = useState<string | null>(null)
  const [timeOut, setTimeOut] = useState<string | null>(null)
  const [noteDraft, setNoteDraft] = useState('')
  const [records, setRecords] = useState<RecordEntry[]>([])
  const [timeInAt, setTimeInAt] = useState<Date | null>(null)
  const [timeOutAt, setTimeOutAt] = useState<Date | null>(null)
  const [tick, setTick] = useState(0)
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null)
  const [noteSavedPulse, setNoteSavedPulse] = useState(false)
  const [historyDate, setHistoryDate] = useState<string>(formatDateKey(new Date()))
  const [now, setNow] = useState(() => new Date())
  const [showCalendar, setShowCalendar] = useState(false)
  const [calendarMonth, setCalendarMonth] = useState(() => new Date())
  const [userId, setUserId] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [geoError, setGeoError] = useState<string | null>(null)
  const [isGeoChecking, setIsGeoChecking] = useState(false)
  const [calendarEditDate, setCalendarEditDate] = useState<string | null>(null)
  const [calendarEditDraft, setCalendarEditDraft] = useState('')
  const [calendarIsSaving, setCalendarIsSaving] = useState(false)
  const [showConfirmTimeout, setShowConfirmTimeout] = useState(false)
  const { theme } = useTheme()
  const isLight = theme === 'light'

  const todayLabel = useMemo(() => formatDateLabel(new Date()), [])

  const status: 'not' | 'in' | 'done' = timeInAt && !timeOutAt ? 'in' : timeInAt && timeOutAt ? 'done' : 'not'

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setUserId(data.session.user.id)
      }
    })
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!timeInAt || timeOutAt) return
    const id = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [timeInAt, timeOutAt])

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (!showCalendar) return
    const current = new Date()
    setCalendarMonth(new Date(current.getFullYear(), current.getMonth(), 1))
    setHistoryDate(formatDateKey(current))
  }, [showCalendar])

  useEffect(() => {
    if (!geoError) return
    const id = setTimeout(() => setGeoError(null), 3000)
    return () => clearTimeout(id)
  }, [geoError])

  const fetchRecords = useCallback(async () => {
    if (!userId) return
    const { data, error } = await supabase
      .from('attendance_logs')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .limit(60)

    if (error) return

    setRecords((prev) => {
      // keep any local notes if dates match
      const prevMap = Object.fromEntries(prev.map((r) => [r.date, r.note]))
      return (
        data?.map((r) => {
          const timeInDate = makeDateTime(r.date, r.time_in)
          const timeOutDate = makeDateTime(r.date, r.time_out)
          const durationMinutes = timeInDate && timeOutDate ? (timeOutDate.getTime() - timeInDate.getTime()) / 1000 / 60 : undefined
          const savedAtDate = safeDate(r.updated_at || r.created_at) || timeOutDate || timeInDate
          return {
            date: r.date,
            note: prevMap[r.date] ?? r.work_notes ?? '',
            timeIn: timeInDate ? formatTime(timeInDate) : undefined,
            timeOut: timeOutDate ? formatTime(timeOutDate) : undefined,
            durationMinutes,
            savedAt: savedAtDate ? savedAtDate.toISOString() : undefined,
          }
        }) || []
      )
    })

    const todayRecord = data?.find((r) => r.date === formatDateKey(new Date()))
    if (todayRecord) {
      const ti = makeDateTime(todayRecord.date, todayRecord.time_in)
      const to = makeDateTime(todayRecord.date, todayRecord.time_out)
      setTimeIn(ti ? formatTime(ti) : null)
      setTimeOut(to ? formatTime(to) : null)
      setTimeInAt(ti)
      setTimeOutAt(to)
      // Keep today's input blank after save; edits happen via history/calendar.
      setNoteDraft('')
    } else {
      setTimeIn(null)
      setTimeOut(null)
      setTimeInAt(null)
      setTimeOutAt(null)
      setNoteDraft('')
    }
  }, [userId])

  const handleTimeIn = async () => {
    const { data: sessionData } = await supabase.auth.getSession()
    const currentUserId = sessionData.session?.user.id
    if (!currentUserId) {
      setGeoError('Login required to time in. Please sign in again.')
      return
    }
    if (status === 'in' || status === 'done') return
    // Extra guard: prevent time-in if a completed record already exists today
    const todayKeyCheck = formatDateKey(new Date())
    const { data: existing } = await supabase
      .from('attendance_logs')
      .select('time_in,time_out')
      .eq('user_id', currentUserId)
      .eq('date', todayKeyCheck)
      .maybeSingle()
    if (existing?.time_in && existing?.time_out) {
      setGeoError('You already completed time in/out for today.')
      return
    }
    setGeoError(null)
    setIsGeoChecking(true)

    const checkLocation = () =>
      new Promise<GeolocationPosition>((resolve, reject) => {
        if (!('geolocation' in navigator)) {
          reject(new Error('Geolocation not supported'))
          return
        }
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000 })
      })

    try {
      const position = await checkLocation()
      const { latitude, longitude } = position.coords
      const distance = distanceMeters({ lat: latitude, lng: longitude }, OFFICE_COORDS)
      if (distance > OFFICE_RADIUS_METERS) {
        setGeoError(`You must be at the office location to time in. Detected distance: ${distance.toFixed(0)}m.`)
        setIsGeoChecking(false)
        return
      }
    } catch (err) {
      setGeoError('Location required to time in. Please enable location and try again.')
      setIsGeoChecking(false)
      return
    }

    setIsGeoChecking(false)
    setIsSaving(true)
    const now = new Date()
    setTimeInAt(now)
    setTimeIn(formatTime(now))
    setTimeOut(null)
    setTimeOutAt(null)
    const todayKeyLocal = formatDateKey(now)
    const nowIso = new Date().toISOString()
    await supabase
      .from('attendance_logs')
      .upsert(
        {
          user_id: currentUserId,
          date: todayKeyLocal,
          time_in: toTimeString(now),
          updated_at: nowIso,
          created_at: nowIso,
        },
        { onConflict: 'user_id,date' }
      )
    setLastSavedAt(new Date().toISOString())
    await fetchRecords()
    setIsSaving(false)
    setShowConfirmTimeout(false)
  }

  const handleTimeOut = async () => {
    const { data: sessionData } = await supabase.auth.getSession()
    const currentUserId = sessionData.session?.user.id
    if (!currentUserId) {
      setGeoError('Login required to time out. Please sign in again.')
      return
    }
    if (status !== 'in') return
    setShowConfirmTimeout(true)
  }

  const confirmTimeOut = async () => {
    const { data: sessionData } = await supabase.auth.getSession()
    const currentUserId = sessionData.session?.user.id
    if (!currentUserId || status !== 'in') {
      setShowConfirmTimeout(false)
      return
    }
    setIsSaving(true)
    const now = new Date()
    setTimeOutAt(now)
    setTimeOut(formatTime(now))
    const todayKeyLocal = formatDateKey(now)
    const nowIso = new Date().toISOString()
    await supabase
      .from('attendance_logs')
      .upsert(
        {
          user_id: currentUserId,
          date: todayKeyLocal,
          time_in: timeInAt ? toTimeString(timeInAt) : toTimeString(now),
          time_out: toTimeString(now),
          updated_at: nowIso,
          created_at: nowIso,
        },
        { onConflict: 'user_id,date' }
      )
    setLastSavedAt(new Date().toISOString())
    await fetchRecords()
    setIsSaving(false)
  }

  const handleSaveNote = async () => {
    if (!userId || hasTodayNote) return
    const dateKey = formatDateKey(new Date())
    const durationMinutes = timeInAt && timeOutAt ? (timeOutAt.getTime() - timeInAt.getTime()) / 1000 / 60 : undefined
    const payload = {
      user_id: userId,
      date: dateKey,
      time_in: timeInAt ? toTimeString(timeInAt) : null,
      time_out: timeOutAt ? toTimeString(timeOutAt) : null,
      work_notes: noteDraft.trim(),
      updated_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    }

    await supabase.from('attendance_logs').upsert(payload, { onConflict: 'user_id,date' })

    const updated: RecordEntry = {
      date: dateKey,
      note: payload.work_notes,
      timeIn: timeIn || undefined,
      timeOut: timeOut || undefined,
      durationMinutes,
      savedAt: new Date().toISOString(),
    }
    setRecords((prev) => {
      const filtered = prev.filter((r) => r.date !== dateKey)
      return [updated, ...filtered]
    })
    setLastSavedAt(updated.savedAt || null)
    setNoteDraft('')
    setNoteSavedPulse(true)
    setTimeout(() => setNoteSavedPulse(false), 1200)
    await fetchRecords()
  }

  const handleSaveCalendarNote = async () => {
    if (!userId || !calendarEditDate) return
    setCalendarIsSaving(true)
    const updatedAt = new Date().toISOString()
    const payload = {
      user_id: userId,
      date: calendarEditDate,
      work_notes: calendarEditDraft.trim(),
      updated_at: updatedAt,
    }

    await supabase.from('attendance_logs').upsert(payload, { onConflict: 'user_id,date' })

    setRecords((prev) =>
      prev.map((r) =>
        r.date === calendarEditDate
          ? {
              ...r,
              note: payload.work_notes,
              savedAt: updatedAt,
            }
          : r
      )
    )
    setLastSavedAt(updatedAt)
    setCalendarEditDate(null)
    setCalendarEditDraft('')
    await fetchRecords()
    setCalendarIsSaving(false)
  }

  useEffect(() => {
    fetchRecords()
  }, [fetchRecords])

  const liveDurationMinutes = useMemo(() => {
    if (timeInAt && !timeOutAt) {
      return (Date.now() - timeInAt.getTime()) / 1000 / 60
    }
    if (timeInAt && timeOutAt) return (timeOutAt.getTime() - timeInAt.getTime()) / 1000 / 60
    return 0
  }, [timeInAt, timeOutAt, tick])

  const weeklySummary = useMemo(() => {
    const now = new Date()
    const weekAgo = new Date(now)
    weekAgo.setDate(now.getDate() - 6)
    const inRange = records.filter((r) => {
      const d = new Date(r.date)
      return d >= new Date(formatDateKey(weekAgo)) && d <= new Date(formatDateKey(now))
    })
    const totalMinutes = inRange.reduce((sum, r) => {
      if (r.durationMinutes) return sum + r.durationMinutes
      const ti = makeDateTime(r.date, r.timeIn ?? undefined)
      const to = makeDateTime(r.date, r.timeOut ?? undefined) ?? (ti ? now : null)
      if (!ti || !to) return sum
      return sum + Math.max(0, (to.getTime() - ti.getTime()) / 1000 / 60)
    }, 0)
    const daysAttended = inRange.filter((r) => r.timeIn).length
    const avgHours = daysAttended ? totalMinutes / 60 / daysAttended : 0
    return { totalMinutes, daysAttended, avgHours }
  }, [records])

  const completedRecords = useMemo(() => records.filter((r) => !!r.timeOut), [records])
  const historyRecord = useMemo(() => completedRecords.find((r) => r.date === historyDate), [completedRecords, historyDate])

  const calendarLabel = calendarMonth.toLocaleString(undefined, {
    month: 'long',
    year: 'numeric',
  })

  const calendarNoteDirty = calendarEditDate === historyRecord?.date && calendarEditDraft.trim() !== (historyRecord?.note ?? '')

  const calendarDays = useMemo(() => {
    const year = calendarMonth.getFullYear()
    const month = calendarMonth.getMonth()
    const firstDayIdx = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const prevMonthDays = new Date(year, month, 0).getDate()

    const days: { label: number; current: boolean; date: Date }[] = []

    for (let i = firstDayIdx - 1; i >= 0; i -= 1) {
      const dayNum = prevMonthDays - i
      days.push({ label: dayNum, current: false, date: new Date(year, month - 1, dayNum) })
    }

    for (let d = 1; d <= daysInMonth; d += 1) {
      days.push({ label: d, current: true, date: new Date(year, month, d) })
    }

    let nextMonthDay = 1
    while (days.length % 7 !== 0) {
      days.push({ label: nextMonthDay, current: false, date: new Date(year, month + 1, nextMonthDay) })
      nextMonthDay += 1
    }

    return days
  }, [calendarMonth])

  const formattedDate = now.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  })
  const formattedTime = now.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  })
  const todayStart = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])
  const todayKey = formatDateKey(todayStart)
  const yesterdayKey = useMemo(() => {
    const d = new Date(todayStart)
    d.setDate(d.getDate() - 1)
    return formatDateKey(d)
  }, [todayStart])
  const todayRecord = useMemo(() => records.find((r) => r.date === todayKey), [records, todayKey])
  const hasTodayNote = !!todayRecord?.note?.trim()
  const currentMonthStart = useMemo(() => new Date(todayStart.getFullYear(), todayStart.getMonth(), 1), [todayStart])
  const canGoNextMonth = calendarMonth.getFullYear() < currentMonthStart.getFullYear() ||
    (calendarMonth.getFullYear() === currentMonthStart.getFullYear() && calendarMonth.getMonth() < currentMonthStart.getMonth())

  const historyPreview = useMemo(() => {
    if (!completedRecords.length) return undefined
    return (
      completedRecords.find((r) => r.date === todayKey) ||
      completedRecords.find((r) => r.date === yesterdayKey) ||
      completedRecords[0]
    )
  }, [completedRecords, todayKey, yesterdayKey])

  if (!mounted) return null

  return (
    <div className={`relative space-y-6 p-6 pt-2 ${isLight ? 'bg-white text-slate-900' : 'text-white'}`}>
      {geoError ? (
        <div
          className={`fixed inset-x-4 top-4 z-50 mx-auto max-w-md animate-[pageFadeUp_0.2s_ease-out] rounded-2xl border px-4 py-3 shadow-lg backdrop-blur-sm md:inset-x-auto md:right-6 ${
            isLight
              ? 'border-amber-200 bg-amber-50/95 text-amber-900'
              : 'border-amber-500/30 bg-amber-500/15 text-amber-50'
          }`}
        >
          <div className="flex items-start gap-3">
            <div className="flex-1 space-y-1 text-sm">
              <p className="font-semibold">On-site check required</p>
              <p className="leading-snug">{geoError}</p>
            </div>
          </div>
        </div>
      ) : null}

      {showConfirmTimeout ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className={`w-full max-w-md rounded-2xl border p-5 shadow-2xl ${isLight ? 'border-slate-200 bg-white text-slate-900' : 'border-white/10 bg-[#0b1220] text-white'}`}>
            <div className="space-y-2">
              <p className="text-lg font-semibold">Confirm time out</p>
              <p className={`${isLight ? 'text-slate-600' : 'text-slate-300'}`}>Are you sure you want to time out now? Your current session will be saved.</p>
            </div>
            <div className="mt-4 flex flex-wrap gap-2 justify-end">
              <button
                type="button"
                onClick={() => setShowConfirmTimeout(false)}
                className={`rounded-full px-4 py-2 text-sm font-semibold ring-1 transition ${isLight ? 'ring-slate-200 text-slate-700 hover:bg-slate-100' : 'ring-white/10 text-slate-200 hover:bg-white/10'}`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmTimeOut}
                className={`rounded-full px-4 py-2 text-sm font-semibold text-white transition ${isLight ? 'bg-red-500 ring-1 ring-red-200 hover:bg-red-600' : 'bg-red-500 ring-1 ring-white/10 hover:bg-red-400'}`}
              >
                Yes, time out
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <section className="relative left-1/2 w-screen -translate-x-1/2 px-6 md:w-[90vw] md:-translate-x-1/2 md:px-10">
        <div className="flex items-start gap-6">
          <div>
            <p className={`text-sm ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>{formattedDate}</p>
            <p className={`text-lg font-semibold ${isLight ? 'text-slate-900' : 'text-white'}`}>{formattedTime}</p>
          </div>
          <div className="flex flex-1 justify-center pt-1 text-center">
            <p className={`text-xl font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>Attendance</p>
          </div>
          <button
            type="button"
            onClick={() => setShowCalendar(true)}
            className={`ml-auto flex h-11 w-11 items-center justify-center rounded-xl ring-1 transition ${isLight ? 'bg-blue-50 text-blue-600 ring-blue-200 hover:bg-blue-100' : 'bg-blue-500/10 text-white ring-white/10 hover:bg-blue-500/20'}`}
            aria-label="Open attendance calendar"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="3" />
              <path d="M16 2v4M8 2v4M3 10h18" />
            </svg>
          </button>
        </div>
      </section>

      {/* Time in/out controls */}
      <section className="relative left-1/2 w-screen -translate-x-1/2 px-6 md:w-[90vw] md:-translate-x-1/2 md:px-10">
        <div className={`rounded-2xl border p-5 shadow-[0_20px_60px_-45px_rgba(0,0,0,0.8)] ${isLight ? 'border-slate-200 bg-white text-slate-900' : 'border-white/10 bg-[#0b1220]'}`}>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2">
              <div className={`flex items-center gap-2 text-sm ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                <p className={`text-xs uppercase tracking-wide ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Today</p>
                <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ring-1 ${
                  status === 'not'
                    ? isLight ? 'bg-slate-100 text-slate-700 ring-slate-200' : 'bg-white/5 text-slate-200 ring-white/10'
                    : status === 'in'
                        ? isLight ? 'bg-amber-100 text-amber-800 ring-amber-200' : 'bg-amber-500/20 text-amber-200 ring-white/10'
                        : isLight ? 'bg-green-100 text-green-800 ring-green-200' : 'bg-green-500/20 text-green-200 ring-white/10'
                }`}>
                  <span className={`h-2 w-2 rounded-full ${status === 'not' ? isLight ? 'bg-slate-400' : 'bg-slate-400' : status === 'in' ? 'bg-amber-400' : 'bg-green-500'}`} />
                  {status === 'not' ? 'Not Timed In' : status === 'in' ? 'Timed In' : 'Completed'}
                </span>
              </div>
              <p className={`text-lg font-semibold ${isLight ? 'text-slate-900' : 'text-white'}`}>{todayLabel}</p>
              <div className={`mt-2 flex flex-col gap-1 text-sm ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                <span className="inline-flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${timeIn ? 'bg-green-500' : isLight ? 'bg-slate-300' : 'bg-slate-500'}`} />
                  <span>Time in: {timeIn ?? '—'}</span>
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${timeOut ? 'bg-red-500' : isLight ? 'bg-slate-300' : 'bg-slate-500'}`} />
                  <span>Time out: {timeOut ?? '—'}</span>
                </span>
                {status !== 'not' ? (
                  <span className={`inline-flex items-center gap-2 ${isLight ? 'text-blue-700' : 'text-blue-200'}`}>
                    <span className={`h-2.5 w-2.5 rounded-full ${isLight ? 'bg-blue-500' : 'bg-blue-300'}`} />
                    <span>Session: {formatHours(liveDurationMinutes)}</span>
                  </span>
                ) : null}
              </div>
            </div>
            <div className="flex flex-wrap gap-2 md:justify-end">
              <button
                type="button"
                onClick={handleTimeIn}
                disabled={status === 'in' || status === 'done' || isSaving}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-white ring-1 transition hover:bg-green-400 disabled:cursor-not-allowed disabled:opacity-50 ${
                  isLight
                    ? 'bg-green-500 ring-green-200 disabled:bg-slate-200 disabled:text-slate-400 disabled:ring-slate-200'
                    : 'bg-green-500 ring-white/10 disabled:bg-white/10 disabled:text-slate-500 disabled:ring-white/10'
                }`}
              >
                <span className="h-2 w-2 rounded-full bg-white" />
                Time In
              </button>
              <button
                type="button"
                onClick={handleTimeOut}
                disabled={status !== 'in' || isSaving}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-white ring-1 transition hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-50 ${
                  isLight
                    ? 'bg-red-500 ring-red-200 disabled:bg-slate-200 disabled:text-slate-400 disabled:ring-slate-200'
                    : 'bg-red-500 ring-white/10 disabled:bg-white/10 disabled:text-slate-500 disabled:ring-white/10'
                }`}
              >
                <span className="h-2 w-2 rounded-full bg-white" />
                Time Out
              </button>
            </div>
          </div>
          {status === 'in' ? (
            <div className={`mt-3 flex items-center gap-2 rounded-xl px-3 py-2 text-sm ring-1 animate-[pageFadeUp_0.2s_ease-out] ${isLight ? 'bg-amber-50 text-amber-800 ring-amber-200' : 'bg-amber-500/10 text-amber-100 ring-amber-500/20'}`}>
              <span className={`h-2 w-2 rounded-full animate-pulse ${isLight ? 'bg-amber-500' : 'bg-amber-300'}`} />
              You haven’t timed out yet. Remember to log time out when you’re done.
            </div>
          ) : null}
        </div>
      </section>

      {/* Daily time record with note */}
      <section className="relative left-1/2 w-screen -translate-x-1/2 px-6 md:w-[90vw] md:-translate-x-1/2 md:px-10">
        <div className={`rounded-2xl border p-5 shadow-[0_20px_60px_-45px_rgba(0,0,0,0.8)] space-y-4 ${isLight ? 'border-slate-200 bg-white text-slate-900' : 'border-white/10 bg-[#0b1220]'}`}>
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className={`text-xs uppercase tracking-wide ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Daily record</p>
              <p className={`text-lg font-semibold ${isLight ? 'text-slate-900' : 'text-white'}`}>Add what you worked on</p>
            </div>
            <button
              type="button"
              onClick={handleSaveNote}
              disabled={hasTodayNote || isSaving}
              className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold text-white ring-1 transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-50 ${isLight ? 'bg-blue-500 ring-blue-200' : 'bg-blue-500 ring-white/10'}`}
            >
              Save
            </button>
            {noteSavedPulse ? (
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-green-500/10 text-green-600 ring-1 ring-green-200 animate-[pageFadeUp_0.2s_ease-out]">
                ✓
              </span>
            ) : null}
          </div>
          <textarea
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            placeholder="Describe your tasks for today..."
            className={`h-28 w-full resize-none rounded-xl px-3 py-2 text-sm placeholder:text-slate-400 ring-1 focus:ring-2 focus:ring-blue-500/60 ${isLight ? 'bg-white text-slate-900 ring-slate-200' : 'bg-[#0c1525] text-white ring-white/10'}`}
          />
          <div className={`flex items-center justify-between text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
            <span>Characters: {noteDraft.length}/500</span>
            <div className="flex items-center gap-2">
              {lastSavedAt ? <span className={`${isLight ? 'text-green-600' : 'text-green-200'}`}>Saved at {new Date(lastSavedAt).toLocaleTimeString()}</span> : null}
              {hasTodayNote ? (
                <span className={`${isLight ? 'text-green-700' : 'text-green-300'}`}>Saved. Edit via History.</span>
              ) : null}
            </div>
          </div>

          <div className="space-y-3">
            <p className={`text-xs uppercase tracking-wide ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>History</p>
            {completedRecords.length === 0 ? (
              <div className={`rounded-xl border p-4 text-sm ${isLight ? 'border-slate-200 bg-slate-50 text-slate-600' : 'border-white/10 bg-white/5 text-slate-300'}`}>
                No records yet. Time in/out and add a note to see it here.
              </div>
            ) : (
              <div className="space-y-3">
                {historyPreview ? (
                  <div key={historyPreview.date} className={`rounded-2xl border p-4 space-y-2 ${isLight ? 'border-slate-200 bg-slate-50' : 'border-white/10 bg-white/5'}`}>
                    <div className={`flex flex-wrap items-center gap-2 text-sm ${isLight ? 'text-slate-700' : 'text-slate-200'}`}>
                      <span className={`font-semibold ${isLight ? 'text-slate-900' : 'text-white'}`}>{historyPreview.date}</span>
                      <span className={`${isLight ? 'text-slate-400' : 'text-slate-500'}`}>•</span>
                      <span className={`${isLight ? 'text-slate-600' : 'text-slate-300'}`}>{formatHours(historyPreview.durationMinutes)}</span>
                    </div>
                    <div className={`flex flex-wrap items-center gap-3 text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                      <span className="inline-flex items-center gap-1.5">
                        <span className={`h-2.5 w-2.5 rounded-full ${historyPreview.timeIn ? 'bg-green-500' : isLight ? 'bg-slate-300' : 'bg-slate-600'}`} />
                        <span>In: {historyPreview.timeIn ?? '—'}</span>
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className={`h-2.5 w-2.5 rounded-full ${historyPreview.timeOut ? 'bg-red-500' : isLight ? 'bg-slate-300' : 'bg-slate-600'}`} />
                        <span>Out: {historyPreview.timeOut ?? '—'}</span>
                      </span>
                      <span className={`inline-flex items-center gap-1.5 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                        <span className={`h-2.5 w-2.5 rounded-full ${isLight ? 'bg-slate-400' : 'bg-slate-500'}`} />
                        <span>Saved {historyPreview.timeOut ?? historyPreview.timeIn ?? '—'}</span>
                      </span>
                    </div>
                    {historyPreview.note ? (
                      <p className={`text-sm leading-relaxed whitespace-pre-line ${isLight ? 'text-slate-700' : 'text-slate-200'}`}>{formatNoteText(historyPreview.note)}</p>
                    ) : (
                      <p className={`${isLight ? 'text-slate-500' : 'text-slate-500'}`}>No note added.</p>
                    )}
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Weekly summary */}
      <section className="relative left-1/2 w-screen -translate-x-1/2 px-6 md:w-[90vw] md:-translate-x-1/2 md:px-10">
        <div className={`rounded-2xl border p-5 shadow-[0_20px_60px_-45px_rgba(0,0,0,0.8)] ${isLight ? 'border-slate-200 bg-white text-slate-900' : 'border-white/10 bg-[#0b1220]'}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className={`text-xs uppercase tracking-wide ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Weekly attendance summary</p>
              <p className={`text-lg font-semibold ${isLight ? 'text-slate-900' : 'text-white'}`}>Last 7 days</p>
            </div>
            <div className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Auto-updates from your records</div>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className={`rounded-xl border px-4 py-3 ${isLight ? 'border-slate-200 bg-slate-50' : 'border-white/10 bg-white/5'}`}>
              <p className={`text-xs uppercase tracking-wide ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Total hours</p>
              <p className={`text-xl font-semibold ${isLight ? 'text-slate-900' : 'text-white'}`}>{formatHours(weeklySummary.totalMinutes)}</p>
            </div>
            <div className={`rounded-xl border px-4 py-3 ${isLight ? 'border-slate-200 bg-slate-50' : 'border-white/10 bg-white/5'}`}>
              <p className={`text-xs uppercase tracking-wide ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Days attended</p>
              <p className={`text-xl font-semibold ${isLight ? 'text-slate-900' : 'text-white'}`}>{weeklySummary.daysAttended}</p>
            </div>
            <div className={`rounded-xl border px-4 py-3 ${isLight ? 'border-slate-200 bg-slate-50' : 'border-white/10 bg-white/5'}`}>
              <p className={`text-xs uppercase tracking-wide ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Avg hrs/day</p>
              <p className={`text-xl font-semibold ${isLight ? 'text-slate-900' : 'text-white'}`}>{weeklySummary.avgHours.toFixed(1)}h</p>
            </div>
          </div>
        </div>
      </section>


      {showCalendar ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 text-white">
          <div className={`flex h-full w-full flex-col animate-[pageSwipeIn_0.2s_ease-out] md:h-auto md:max-h-[90vh] md:w-full md:max-w-3xl md:overflow-hidden md:rounded-2xl md:animate-[pageFadeUp_0.25s_ease-out] ${isLight ? 'bg-white text-slate-900 md:ring-1 md:ring-slate-200' : 'bg-[#060b15] text-white md:ring-1 md:ring-white/10'}`}>
            <div className="flex items-center gap-3 px-4 py-3">
              <button
                type="button"
                onClick={() => setShowCalendar(false)}
                className={`inline-flex h-7 w-9 items-center justify-center rounded-full ring-1 transition ${isLight ? 'bg-slate-100 text-slate-700 ring-slate-200 hover:bg-slate-200' : 'bg-white/5 text-white ring-white/15 hover:bg-white/10'}`}
                aria-label="Close calendar"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
              <div className="ml-1">
                <p className={`text-sm font-semibold leading-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>Attendance Calendar</p>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                  className={`inline-flex h-9 w-9 items-center justify-center rounded-full ring-1 transition ${isLight ? 'bg-slate-100 text-slate-700 ring-slate-200 hover:bg-slate-200' : 'bg-white/10 text-white ring-white/20 hover:bg-white/15'}`}
                  aria-label="Previous month"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m15 18-6-6 6-6" />
                  </svg>
                </button>
                <div className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 whitespace-nowrap ${isLight ? 'bg-slate-100 text-slate-800 ring-slate-200' : 'bg-white/10 text-white ring-white/20'}`}>
                  {calendarLabel}
                </div>
                <button
                  type="button"
                  onClick={() => setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                  disabled={!canGoNextMonth}
                  className={`inline-flex h-9 w-9 items-center justify-center rounded-full ring-1 transition ${
                    canGoNextMonth
                      ? isLight ? 'bg-slate-100 text-slate-700 ring-slate-200 hover:bg-slate-200' : 'bg-white/10 text-white ring-white/20 hover:bg-white/15'
                      : isLight ? 'bg-transparent text-slate-300 ring-slate-200 opacity-60 cursor-not-allowed' : 'bg-transparent text-slate-600 ring-white/20 opacity-60 cursor-not-allowed'
                  }`}
                  aria-label="Next month"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 pb-6">
              <div className={`rounded-2xl border p-4 shadow-[0_10px_40px_-30px_rgba(0,0,0,0.85)] ${isLight ? 'border-slate-200 bg-white text-slate-900' : 'border-white/10 bg-[#0b1220]'}`}>
                <div className={`grid grid-cols-7 gap-2 text-center text-xs uppercase tracking-wide ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                    <div key={d} className="py-2">{d}</div>
                  ))}
                </div>
                <div className="mt-2 grid grid-cols-7 gap-2 text-center text-sm">
                  {calendarDays.map((d, idx) => {
                    const key = formatDateKey(d.date)
                    const hasRecord = !!completedRecords.find((r) => r.date === key)
                    const isFuture = d.date > todayStart
                    return (
                      <button
                        type="button"
                        key={`${d.label}-${idx}`}
                        disabled={isFuture}
                        onClick={() => {
                          if (!isFuture) setHistoryDate(key)
                        }}
                        className={`relative rounded-xl border px-0 py-2 font-semibold transition ${
                          historyDate === key
                            ? isLight
                              ? 'border-blue-200 bg-blue-50 text-blue-700 shadow-[0_10px_30px_-20px_rgba(59,130,246,0.4)]'
                              : 'border-blue-400/60 bg-blue-500/10 text-white shadow-[0_10px_30px_-20px_rgba(59,130,246,0.7)]'
                            : isFuture
                                ? isLight ? 'border-slate-200 bg-transparent text-slate-300 opacity-60' : 'border-white/5 bg-transparent text-slate-700 opacity-60'
                                : d.current
                                    ? isLight ? 'border-slate-200 bg-white text-slate-900 hover:border-blue-200 hover:bg-blue-50' : 'border-white/15 bg-white/5 text-white hover:border-white/25 hover:bg-white/10'
                                    : isLight ? 'border-slate-200 bg-transparent text-slate-500 hover:border-slate-300' : 'border-white/5 bg-transparent text-slate-500 hover:border-white/10'
                        }`}
                        aria-disabled={isFuture}
                      >
                        {d.label}
                        {hasRecord ? (
                          <span className={`absolute left-1/2 top-[70%] h-1.5 w-1.5 -translate-x-1/2 rounded-full ${isLight ? 'bg-blue-500' : 'bg-blue-400'}`} />
                        ) : null}
                      </button>
                    )
                  })}
                </div>

                <div className={`mt-4 space-y-2 rounded-2xl border p-4 ${isLight ? 'border-slate-200 bg-slate-50' : 'border-white/10 bg-[#0c1525]'}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Selected day</p>
                      <p className={`text-sm font-semibold ${isLight ? 'text-slate-900' : 'text-white'}`}>{historyDate}</p>
                    </div>
                    {historyRecord ? (
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${isLight ? 'bg-white text-slate-800 ring-slate-200' : 'bg-white/5 text-white ring-white/10'}`}>
                        {historyRecord.durationMinutes ? formatHours(historyRecord.durationMinutes) : 'No hours'}
                      </span>
                    ) : null}
                  </div>

                  {historyRecord ? (
                    <div className={`space-y-2 text-sm ${isLight ? 'text-slate-700' : 'text-slate-200'}`}>
                      <div className={`flex flex-wrap items-center gap-3 text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                        <span className="inline-flex items-center gap-1.5">
                          <span className="h-2.5 w-2.5 rounded-full bg-green-500" />
                          <span>In: {historyRecord.timeIn ?? '—'}</span>
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
                          <span>Out: {historyRecord.timeOut ?? '—'}</span>
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <span className="h-2.5 w-2.5 rounded-full bg-slate-500" />
                          <span>Saved {historyRecord.timeOut ?? historyRecord.timeIn ?? '—'}</span>
                        </span>
                      </div>

                      {calendarEditDate === historyRecord.date ? (
                        <div className="space-y-2">
                          <textarea
                            value={calendarEditDraft}
                            onChange={(e) => setCalendarEditDraft(e.target.value)}
                            className={`w-full resize-none rounded-xl px-3 py-2 text-sm ring-1 focus:ring-2 ${
                              isLight
                                ? 'bg-white text-slate-900 ring-slate-200 focus:ring-blue-500/60'
                                : 'bg-[#0c1525] text-white ring-white/10 focus:ring-blue-500/60'
                            }`}
                            rows={4}
                          />
                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={handleSaveCalendarNote}
                              disabled={!calendarNoteDirty || calendarIsSaving}
                              className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold ring-1 transition ${
                                calendarNoteDirty && !calendarIsSaving
                                  ? isLight
                                    ? 'bg-blue-500 text-white ring-blue-200 hover:bg-blue-400'
                                    : 'bg-blue-500 text-white ring-white/10 hover:bg-blue-400'
                                  : isLight
                                    ? 'bg-slate-100 text-slate-400 ring-slate-200'
                                    : 'bg-white/5 text-slate-500 ring-white/10'
                              }`}
                            >
                              {calendarIsSaving ? 'Saving…' : 'Save changes'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <p className={`text-sm leading-relaxed whitespace-pre-line ${isLight ? 'text-slate-700' : 'text-slate-200'}`}>{formatNoteText(historyRecord.note) || 'No note added.'}</p>
                          <div className="pt-1">
                            <button
                              type="button"
                              onClick={() => {
                                setCalendarEditDate(historyRecord.date)
                                setCalendarEditDraft(historyRecord.note ?? '')
                              }}
                              className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold ring-1 transition ${
                                isLight
                                  ? 'bg-slate-100 text-slate-800 ring-slate-200 hover:bg-slate-200'
                                  : 'bg-white/5 text-white ring-white/10 hover:bg-white/10'
                              }`}
                            >
                              Edit note
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ) : (
                    <p className={`text-sm ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>No record for this date. Choose another day.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
