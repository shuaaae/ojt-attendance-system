"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

import { useTheme } from './ThemeProvider'
import { supabase } from '@/lib/supabase'

type AttendanceStatus =
  | { state: 'loading' }
  | { state: 'none' }
  | { state: 'timed_in'; timeIn: Date; elapsedMinutes: number }
  | { state: 'completed'; timeIn: Date; timeOut: Date; totalHours: number }

const formatDateKey = (d: Date) => d.toLocaleDateString('en-CA')
const makeDateTime = (dateStr?: string | null, timeStr?: string | null) => {
  if (!dateStr || !timeStr) return null
  const normalizedTime = timeStr.length === 5 ? `${timeStr}:00` : timeStr
  const d = new Date(`${dateStr}T${normalizedTime}`)
  return Number.isNaN(d.getTime()) ? null : d
}

export default function TodayAttendanceStatusCard() {
  const router = useRouter()
  const [status, setStatus] = useState<AttendanceStatus>({ state: 'loading' })
  const { theme } = useTheme()
  const isLight = theme === 'light'

  useEffect(() => {
    let isMounted = true

    const fetchStatus = async () => {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession()

      if (!session || sessionError) {
        if (isMounted) setStatus({ state: 'none' })
        return
      }

      const today = new Date()
      const yyyyMmDd = formatDateKey(today)

      const { data, error } = await supabase
        .from('attendance_logs')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('date', yyyyMmDd)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error) {
        if (isMounted) setStatus({ state: 'none' })
        return
      }

      if (!data) {
        if (isMounted) setStatus({ state: 'none' })
        return
      }

      const timeIn = makeDateTime(data.date, data.time_in)
      const timeOut = makeDateTime(data.date, data.time_out)

      if (!timeIn) {
        if (isMounted) setStatus({ state: 'none' })
        return
      }

      if (timeOut) {
        const totalMs = timeOut.getTime() - timeIn.getTime()
        const totalHours = Math.max(0, totalMs / (1000 * 60 * 60))
        if (isMounted) setStatus({ state: 'completed', timeIn, timeOut, totalHours: parseFloat(totalHours.toFixed(2)) })
        return
      }

      // Active time-in
      const now = new Date()
      const elapsedMinutes = Math.max(0, Math.floor((now.getTime() - timeIn.getTime()) / (1000 * 60)))
      if (isMounted) setStatus({ state: 'timed_in', timeIn, elapsedMinutes })
    }

    fetchStatus()

    const interval = setInterval(fetchStatus, 60_000)
    return () => {
      isMounted = false
      clearInterval(interval)
    }
  }, [])

  const handleNavigate = () => router.push('/ojt/attendance')

  const formatTime = (date: Date) =>
    date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })

  const renderContent = () => {
    if (status.state === 'loading') {
      return <p className={`text-sm ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Checking today&apos;s status...</p>
    }

    if (status.state === 'none') {
      return <p className={`text-sm ${isLight ? 'text-slate-600' : 'text-slate-100'}`}>Not Timed In Today</p>
    }

    if (status.state === 'timed_in') {
      const hours = Math.floor(status.elapsedMinutes / 60)
      const minutes = status.elapsedMinutes % 60
      return (
        <div className="space-y-1">
          <p className={`text-sm ${isLight ? 'text-slate-800' : 'text-slate-100'}`}>Timed In at {formatTime(status.timeIn)}</p>
          <p className={`text-xs ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Elapsed: {hours}h {minutes}m</p>
        </div>
      )
    }

    if (status.state === 'completed') {
      return (
        <div className="space-y-1">
          <p className={`text-sm ${isLight ? 'text-slate-800' : 'text-slate-100'}`}>Completed Today (Timed Out)</p>
          <p className={`text-xs ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Time In: {formatTime(status.timeIn)}</p>
          <p className={`text-xs ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Time Out: {formatTime(status.timeOut)}</p>
          <p className={`text-xs font-semibold ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>Total: {status.totalHours.toFixed(2)} hours</p>
        </div>
      )
    }

    return null
  }

  return (
    <section aria-label="Today’s Attendance Status" className="w-full">
      <button
        type="button"
        onClick={handleNavigate}
        className={`w-full rounded-2xl p-4 text-left ring-1 transition active:translate-y-[1px] ${
          isLight
            ? 'bg-white ring-slate-200 hover:ring-blue-200'
            : 'bg-gradient-to-br from-white/8 via-white/4 to-white/10 ring-white/10 hover:ring-white/20'
        }`}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className={`text-sm ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>Today&apos;s Attendance Status</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ring-1 ${isLight ? 'bg-blue-50 text-blue-700 ring-blue-200' : 'bg-white/10 text-white ring-white/15'}`}>
            Overview
          </span>
        </div>
        <div className="mt-3 space-y-1">
          {renderContent()}
        </div>
      </button>
    </section>
  )
}
