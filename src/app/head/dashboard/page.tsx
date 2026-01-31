'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

import { supabase } from '@/lib/supabase'

type Profile = { id: string; name: string | null; role: string | null; required_hours: number | null }
type AttendanceLog = {
  user_id: string
  date: string
  time_in: string | null
  time_out: string | null
  total_hours: number | null
  work_notes: string | null
}

type Row = {
  id: string
  name: string
  status: 'Complete' | 'Missing Time-Out' | 'Absent'
  timeIn: string | null
  timeOut: string | null
  totalHours: number | null
  workNotes: string | null
}

const formatTime = (value?: string | null) => {
  if (!value) return '—'
  const d = new Date(`1970-01-01T${value}`)
  return Number.isNaN(d.getTime()) ? value : d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

const computeMinutes = (log: AttendanceLog | undefined) => {
  if (!log) return null
  if (log.total_hours != null) return log.total_hours * 60
  if (log.time_in && log.time_out) {
    const start = new Date(`1970-01-01T${log.time_in}`)
    const end = new Date(`1970-01-01T${log.time_out}`)
    const diff = end.getTime() - start.getTime()
    if (!Number.isNaN(diff)) return Math.max(0, diff / 1000 / 60)
  }
  return null
}

export default function HeadDashboardPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<Row[]>([])
  const [stats, setStats] = useState({ totalTrainees: 0, timedIn: 0, missingOut: 0, avgHours: 0 })

  const todayKey = useMemo(() => {
    const now = new Date()
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const d = String(now.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }, [])

  useEffect(() => {
    const run = async () => {
      setError(null)
      setLoading(true)

      const { data: sessionData, error: sessionErr } = await supabase.auth.getSession()
      if (sessionErr || !sessionData.session) {
        router.replace('/login')
        return
      }

      const userId = sessionData.session.user.id

      const { data: headProfile, error: profileErr } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .maybeSingle()

      if (profileErr) {
        setError('Unable to load profile')
        setLoading(false)
        return
      }

      if (headProfile?.role !== 'head') {
        router.replace('/login')
        return
      }

      const { data: traineeProfiles, error: traineesErr } = await supabase
        .from('profiles')
        .select('id, name, role, required_hours')
        .eq('role', 'ojt')

      if (traineesErr) {
        setError('Unable to load trainees')
        setLoading(false)
        return
      }

      const traineeIds = (traineeProfiles ?? []).map((p) => p.id)
      const { data: logsData, error: logsErr } = traineeIds.length
        ? await supabase
            .from('attendance_logs')
            .select('user_id, date, time_in, time_out, total_hours, work_notes')
            .eq('date', todayKey)
            .in('user_id', traineeIds)
        : { data: [], error: null }

      if (logsErr) {
        setError('Unable to load attendance logs')
        setLoading(false)
        return
      }

      const logsByUser = Object.fromEntries((logsData ?? []).map((l) => [l.user_id, l])) as Record<string, AttendanceLog>

      const builtRows: Row[] = (traineeProfiles ?? []).map((p) => {
        const log = logsByUser[p.id]
        const hasIn = log?.time_in
        const hasOut = log?.time_out
        const status: Row['status'] = log ? (hasOut ? 'Complete' : 'Missing Time-Out') : 'Absent'
        return {
          id: p.id,
          name: p.name || '—',
          status,
          timeIn: log?.time_in ?? null,
          timeOut: log?.time_out ?? null,
          totalHours: log ? ((computeMinutes(log) ?? 0) / 60) : null,
          workNotes: log?.work_notes ?? null,
        }
      })

      const timedIn = builtRows.filter((r) => r.timeIn).length
      const missingOut = builtRows.filter((r) => r.status === 'Missing Time-Out').length
      const hourValues = builtRows.map((r) => (r.totalHours != null ? r.totalHours : null)).filter((v): v is number => v != null)
      const avgHours = hourValues.length ? hourValues.reduce((a, b) => a + b, 0) / hourValues.length : 0

      setRows(builtRows)
      setStats({ totalTrainees: traineeProfiles?.length ?? 0, timedIn, missingOut, avgHours: Number(avgHours.toFixed(2)) })
      setLoading(false)
    }

    run()
  }, [router, todayKey])

  const statusColor = (status: Row['status']) => {
    if (status === 'Complete') return 'text-emerald-500'
    if (status === 'Missing Time-Out') return 'text-amber-500'
    return 'text-red-500'
  }

  return (
    <div className="min-h-dvh bg-[#0b1220] text-white px-4 pb-20 pt-6 md:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-400">Head / Supervisor</p>
            <h1 className="text-2xl font-bold">Dashboard</h1>
            <p className="text-xs text-slate-500">{todayKey}</p>
          </div>
          <button
            type="button"
            onClick={() => router.refresh()}
            className="rounded-full bg-white/5 px-3 py-2 text-sm font-semibold text-white ring-1 ring-white/10 hover:bg-white/10"
          >
            Refresh
          </button>
        </header>

        {error ? (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>
        ) : null}

        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Card title="Total Trainees" value={stats.totalTrainees.toString()} accent="from-blue-500 to-cyan-500" />
          <Card title="Timed-in Today" value={stats.timedIn.toString()} accent="from-emerald-500 to-lime-500" />
          <Card title="Missing Time-Out" value={stats.missingOut.toString()} accent="from-amber-500 to-orange-500" />
          <Card title="Avg Hours Today" value={`${stats.avgHours.toFixed(2)}h`} accent="from-indigo-500 to-purple-500" />
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-lg">
          <div className="flex items-center justify-between gap-2 pb-3">
            <div>
              <h2 className="text-lg font-semibold">Today&apos;s Attendance</h2>
              <p className="text-xs text-slate-400">Status overview for all trainees</p>
            </div>
            {loading ? <span className="text-xs text-slate-400">Loading…</span> : null}
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-slate-400">
                  <th className="pb-2 pr-4">Name</th>
                  <th className="pb-2 pr-4">Status</th>
                  <th className="pb-2 pr-4">Time In</th>
                  <th className="pb-2 pr-4">Time Out</th>
                  <th className="pb-2 pr-4">Hours</th>
                  <th className="pb-2 pr-4">Work Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {rows.map((row) => (
                  <tr key={row.id} className="align-top">
                    <td className="py-2 pr-4 font-semibold text-slate-100">{row.name}</td>
                    <td className={`py-2 pr-4 font-semibold ${statusColor(row.status)}`}>{row.status}</td>
                    <td className="py-2 pr-4 text-slate-200">{formatTime(row.timeIn)}</td>
                    <td className="py-2 pr-4 text-slate-200">{formatTime(row.timeOut)}</td>
                    <td className="py-2 pr-4 text-slate-200">{row.totalHours != null ? `${row.totalHours.toFixed(2)}h` : '—'}</td>
                    <td className="py-2 pr-4 text-slate-300 whitespace-pre-wrap">{row.workNotes || '—'}</td>
                  </tr>
                ))}
                {!loading && rows.length === 0 ? (
                  <tr>
                    <td className="py-4 text-slate-400" colSpan={6}>
                      No trainees found.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  )
}

function Card({ title, value, accent }: { title: string; value: string; accent: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-lg">
      <p className="text-xs uppercase tracking-wide text-slate-400">{title}</p>
      <div className="mt-2 flex items-end justify-between">
        <p className="text-2xl font-bold text-white">{value}</p>
        <span className={`h-8 w-8 rounded-full bg-gradient-to-br ${accent} opacity-70`} />
      </div>
    </div>
  )
}
