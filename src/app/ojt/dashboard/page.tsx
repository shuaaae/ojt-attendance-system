 'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'

import Image from 'next/image'
import OjtProgressCard from '@/components/OjtProgressCard'
import TodayAttendanceStatusCard from '@/components/TodayAttendanceStatusCard'
import { useTheme } from '@/components/ThemeProvider'
import { supabase } from '@/lib/supabase'

type TodoItem = {
  id: string
  title: string | null
  description: string | null
  tag: string | null
  due_at: string | null
  is_completed: boolean | null
}

export default function OjtDashboardPage() {
  const router = useRouter()
  const [isChecking, setIsChecking] = useState(true)
  const [email, setEmail] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [now, setNow] = useState(() => new Date())
  const [todos, setTodos] = useState<TodoItem[]>([])
  const [isTodosLoading, setIsTodosLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [isSavingTodo, setIsSavingTodo] = useState(false)
  const [newTodo, setNewTodo] = useState({ title: '', description: '', tag: '', due_at: '' })
  type Block = { type: 'text' | 'checkbox'; text: string; checked?: boolean }
  const [blocks, setBlocks] = useState<Block[]>([{ type: 'text', text: '' }])
  const [focusIndex, setFocusIndex] = useState(0)
  const [todoError, setTodoError] = useState<string | null>(null)
  const [showCalendar, setShowCalendar] = useState(false)
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [notesByDate, setNotesByDate] = useState<Record<string, string>>({})
  const [noteDraft, setNoteDraft] = useState('')
  const [progressMinutes, setProgressMinutes] = useState(0)
  const textareaRefs = useRef<HTMLTextAreaElement[]>([])
  const notesScrollRef = useRef<HTMLDivElement | null>(null)
  const { theme } = useTheme()
  const isLight = theme === 'light'

  const syncTextareaSize = (el: HTMLTextAreaElement | null) => {
    if (!el) return
    const container = notesScrollRef.current
    const prevHeight = container?.scrollHeight ?? 0
    const prevTop = container?.scrollTop ?? 0
    const atBottom = container
      ? container.scrollTop + container.clientHeight >= prevHeight - 2
      : false

    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`

    if (container) {
      const nextHeight = container.scrollHeight
      const delta = nextHeight - prevHeight
      if (atBottom) {
        container.scrollTop = nextHeight - container.clientHeight
      } else {
        container.scrollTop = prevTop + delta
      }
    }
  }

  const makeDateTime = (dateStr?: string | null, timeStr?: string | null) => {
    if (!dateStr || !timeStr) return null
    const normalizedTime = timeStr.length === 5 ? `${timeStr}:00` : timeStr
    const d = new Date(`${dateStr}T${normalizedTime}`)
    return Number.isNaN(d.getTime()) ? null : d
  }

  useEffect(() => {
    let isMounted = true

    const timer = setInterval(() => {
      if (!isMounted) return
      setNow(new Date())
    }, 1000)

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!isMounted) return

        if (!data.session) {
          router.replace('/login')
          return
        }

        setEmail(data.session.user.email ?? null)
        setUserId(data.session.user.id)
      })
      .finally(() => {
        if (!isMounted) return
        setIsChecking(false)
      })

    return () => {
      isMounted = false
      clearInterval(timer)
    }
  }, [router])

  useEffect(() => {
    if (!showCalendar) return
    const today = new Date()
    const initial =
      today.getFullYear() === calendarMonth.getFullYear() && today.getMonth() === calendarMonth.getMonth()
        ? today
        : new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1)
    setSelectedDate(initial)
    const key = initial.toISOString().split('T')[0]
    setNoteDraft(notesByDate[key] || '')
  }, [showCalendar, calendarMonth, notesByDate])

  const fetchTodos = useCallback(async () => {
    if (!userId) return
    setIsTodosLoading(true)
    const { data, error } = await supabase
      .from('todo_items')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })

    if (error) {
      setTodos([])
    } else {
      setTodos(data || [])
    }
    setIsTodosLoading(false)
  }, [userId])

  const fetchProgress = useCallback(async () => {
    if (!userId) return
    const { data, error } = await supabase
      .from('attendance_logs')
      .select('date,time_in,time_out')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .limit(120)

    if (error || !data) {
      setProgressMinutes(0)
      return
    }

    const totalMinutes = data.reduce((sum, r) => {
      const ti = makeDateTime(r.date, r.time_in)
      const to = makeDateTime(r.date, r.time_out) ?? (ti ? new Date() : null)
      if (!ti || !to) return sum
      const minutes = Math.max(0, (to.getTime() - ti.getTime()) / 1000 / 60)
      return sum + minutes
    }, 0)

    setProgressMinutes(Math.floor(totalMinutes))
  }, [userId])

  useEffect(() => {
    let isMounted = true
    fetchTodos()
    fetchProgress()
    return () => {
      isMounted = false
    }
  }, [fetchTodos, fetchProgress])

  useEffect(() => {
    if (!userId) return
    const id = setInterval(() => {
      fetchProgress()
    }, 60_000)
    return () => clearInterval(id)
  }, [fetchProgress, showCalendar, fetchTodos])

  useEffect(() => {
    const target = textareaRefs.current[focusIndex]
    if (target) {
      syncTextareaSize(target)
      target.focus()
      target.setSelectionRange(target.value.length, target.value.length)
    }
  }, [focusIndex])

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

  const calendarLabel = calendarMonth.toLocaleString(undefined, {
    month: 'long',
    year: 'numeric',
  })

  const calendarDays = (() => {
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
  })()

  const formatSelectedDate = (date: Date | null) =>
    date?.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) || ''

  const handleSelectDay = (date: Date) => {
    setSelectedDate(date)
    const key = date.toISOString().split('T')[0]
    setNoteDraft(notesByDate[key] || '')
  }

  const handleSaveNote = () => {
    if (!selectedDate) return
    const key = selectedDate.toISOString().split('T')[0]
    setNotesByDate((prev) => ({ ...prev, [key]: noteDraft.trim() }))
  }

  const formatDue = (isoString: string | null) => {
    if (!isoString) return 'No due date'
    const date = new Date(isoString)
    return date.toLocaleString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  const handleCreateTodo = async () => {
    if (!userId) return
    const title = newTodo.title.trim()
    if (!title) {
      setTodoError('Title is required')
      return
    }
    setTodoError(null)
    setIsSavingTodo(true)

    const payload = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      title,
      description: JSON.stringify(blocks),
      // due_at removed per UI
      due_at: null,
      is_completed: false,
      user_id: userId,
    }

    const { error } = await supabase.from('todo_items').insert(payload)

    if (error) {
      console.error('Error inserting todo:', error)
      setTodoError('Could not add to-do. Please try again.')
      setIsSavingTodo(false)
      return
    }

    setNewTodo({ title: '', description: '', tag: '', due_at: '' })
    setBlocks([{ type: 'text', text: '' }])
    setShowAddForm(false)
    setIsSavingTodo(false)
    fetchTodos()
  }

  const updateBlockText = (index: number, text: string) => {
    setBlocks((prev: Block[]) => prev.map((b: Block, i: number) => (i === index ? { ...b, text } : b)))
  }

  const toggleCheckboxChecked = (index: number) => {
    setBlocks((prev: Block[]) =>
      prev.map((b: Block, i: number) =>
        i === index ? { ...b, checked: !b.checked, type: 'checkbox' } : b
      )
    )
  }

  const insertBlockAfter = (index: number, type: 'text' | 'checkbox') => {
    setBlocks((prev: Block[]) => {
      const next = [...prev]
      next.splice(index + 1, 0, { type, text: '', checked: type === 'checkbox' ? false : undefined })
      return next
    })
    setFocusIndex(index + 1)
  }

  const removeBlockIfEmpty = (index: number) => {
    setBlocks((prev: Block[]) => {
      if (prev.length === 1) return prev
      if (prev[index].text.trim() === '') {
        const next = [...prev]
        next.splice(index, 1)
        return next
      }
      return prev
    })
  }

  const toggleBlockType = (index: number) => {
    setBlocks((prev: Block[]) =>
      prev.map((b: Block, i: number) =>
        i === index ? { type: b.type === 'checkbox' ? 'text' : 'checkbox', text: b.text, checked: b.type === 'checkbox' ? undefined : false } : b
      )
    )
  }

  if (isChecking) return null

  return (
    <div className={`relative space-y-6 p-6 pt-2 ${isLight ? 'bg-white text-slate-900' : 'text-white'}`}>
      {/* Schedule section (aligned with edge-to-edge sections) */}
      <section className="relative left-1/2 w-screen -translate-x-1/2 px-6 md:w-[90vw] md:-translate-x-1/2 md:px-10">
        <div className="flex items-start gap-6">
          <div>
            <p className={`text-sm ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>{formattedDate}</p>
            <p className={`text-lg font-semibold ${isLight ? 'text-slate-900' : 'text-white'}`}>{formattedTime}</p>
          </div>
          <div className="flex flex-1 justify-center pt-1 text-center">
            <p className={`text-xl font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>Dashboard</p>
          </div>
          <button
            type="button"
            onClick={() => setShowCalendar(true)}
            className={`ml-auto flex h-11 w-11 items-center justify-center rounded-xl ring-1 transition ${isLight ? 'bg-blue-50 text-blue-600 ring-blue-200 hover:bg-blue-100' : 'bg-blue-500/10 text-white ring-white/10 hover:bg-blue-500/20'}`}
            aria-label="Open calendar"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="3" />
              <path d="M16 2v4M8 2v4M3 10h18" />
            </svg>
          </button>
        </div>
      </section>

      {/* OJT Progress section */}
      <section
        aria-label="OJT Progress"
        className="relative left-1/2 w-screen -translate-x-1/2 px-6 md:w-[90vw] md:-translate-x-1/2 md:px-10"
      >
        <OjtProgressCard
          currentHours={Math.floor(progressMinutes / 60)}
          currentMinutes={progressMinutes % 60}
          totalHours={486}
        />
      </section>

      {/* To-Do List section (isolated, flexible, can overflow) */}
      <section
        aria-label="To-Do List"
        className="relative left-1/2 w-screen -translate-x-1/2 space-y-3 px-6 md:w-[90vw] md:-translate-x-1/2 md:px-10"
      >
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-semibold">To-Do List</h2>
          <button
            type="button"
            className={`ml-2 inline-flex h-8 w-9 items-center justify-center rounded-full ring-1 transition ${isLight ? 'bg-slate-100 text-slate-700 ring-slate-200 hover:bg-slate-200' : 'bg-white/10 text-white ring-white/10 hover:bg-white/20'}`}
            aria-label="Sort tasks"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 7h14" />
              <path d="M8 12h11" />
              <path d="M11 17h8" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => setShowAddForm(true)}
            className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold text-white shadow ring-1 transition hover:bg-blue-400 ${isLight ? 'bg-blue-500 ring-blue-200' : 'bg-blue-500 ring-white/10'}`}
          >
            Add Item
          </button>
        </div>

        <div className="w-full overflow-x-auto pb-2 hide-scrollbar">
          <div className="flex w-max gap-4 pr-6">
            {isTodosLoading ? (
              Array.from({ length: 3 }).map((_, idx) => (
                <div
                  key={`todo-skel-${idx}`}
                  className={`w-[200px] h-[200px] flex-shrink-0 rounded-2xl p-4 ring-1 flex flex-col animate-pulse ${isLight ? 'bg-slate-100 ring-slate-200' : 'bg-white/5 ring-white/10'}`}
                >
                  <div className="h-3 w-16 rounded bg-white/20" />
                  <div className="mt-3 h-4 w-24 rounded bg-white/30" />
                  <div className="mt-2 h-4 w-32 rounded bg-white/20" />
                  <div className="mt-auto h-3 w-24 rounded bg-white/10" />
                </div>
              ))
            ) : todos.length === 0 ? (
              <div
                className={`w-[200px] h-[200px] flex-shrink-0 rounded-2xl p-4 ring-1 flex flex-col items-start justify-center ${isLight ? 'bg-slate-50 ring-slate-200 text-slate-600' : 'bg-white/5 ring-white/10 text-slate-300'}`}
              >
                <p className={`text-sm font-semibold ${isLight ? 'text-slate-900' : 'text-white'}`}>No to-do items</p>
                <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Add tasks to see them here.</p>
              </div>
            ) : (
              todos.map((item) => (
                <div
                  key={item.id}
                  className={`w-[200px] h-[200px] flex-shrink-0 rounded-2xl p-4 shadow-lg shadow-black/10 ring-1 flex flex-col ${isLight ? 'bg-white ring-slate-200 text-slate-900' : 'bg-white/5 ring-white/10 text-white'}`}
                >
                  <div className="space-y-1">
                    <p className={`text-xs font-semibold uppercase tracking-wide ${isLight ? 'text-blue-600' : 'text-blue-200/80'}`}>{item.tag || 'Task'}</p>
                    <h3 className={`text-base font-semibold leading-snug line-clamp-2 ${isLight ? 'text-slate-900' : 'text-white'}`}>{item.title || 'Untitled'}</h3>
                    <p className={`text-sm leading-snug line-clamp-2 ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>{item.description || 'No description'}</p>
                  </div>
                  <div className="mt-auto pt-3 text-xs text-slate-400">
                    <span className={isLight ? 'text-slate-500' : 'text-slate-400'}>{formatDue(item.due_at)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* Today Attendance Status */}
      <section
        aria-label="Today Attendance Status"
        className="relative left-1/2 w-screen -translate-x-1/2 px-6 md:w-[90vw] md:-translate-x-1/2 md:px-10"
      >
        <TodayAttendanceStatusCard />
      </section>

      {showAddForm ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 text-white overflow-hidden overscroll-contain"
          style={{ overscrollBehavior: 'contain' }}
        >
          <div className={`flex h-full w-full flex-col md:h-auto md:max-h-[90vh] md:w-full md:max-w-2xl md:overflow-hidden md:rounded-2xl md:animate-[pageFadeUp_0.25s_ease-out] ${isLight ? 'bg-white text-slate-900 md:ring-1 md:ring-slate-200' : 'bg-[#060b15] text-white md:ring-1 md:ring-white/10'}`}>
            <div className="relative flex h-full flex-col bg-transparent px-4 py-3">
              <div className="flex items-center">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false)
                    setTodoError(null)
                  }}
                  className={`inline-flex h-9 w-9 items-center justify-center rounded-full ring-1 transition ${isLight ? 'bg-slate-100 text-slate-700 ring-slate-200 hover:bg-slate-200' : 'bg-white/5 text-white ring-white/10 hover:bg-white/10'}`}
                  aria-label="Close"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 6 6 18" />
                    <path d="m6 6 12 12" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={handleCreateTodo}
                  disabled={isSavingTodo}
                  className={`ml-auto inline-flex h-9 w-9 items-center justify-center rounded-full text-white ring-1 transition hover:bg-blue-400 disabled:opacity-60 ${isLight ? 'bg-blue-500 ring-blue-200' : 'bg-blue-500 ring-white/10'}`}
                  aria-label="Save to-do"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                </button>
              </div>

              <div className="mt-4 flex min-h-0 flex-1 flex-col gap-3 pb-16">
                <input
                  value={newTodo.title}
                  onChange={(e) => setNewTodo((t) => ({ ...t, title: e.target.value }))}
                  className={`border-none bg-transparent px-1 text-xl font-semibold leading-tight outline-none placeholder:text-slate-500 ${isLight ? 'text-slate-900' : 'text-white'}`}
                  placeholder="Title"
                />

                <div
                  ref={notesScrollRef}
                  className="flex-1 space-y-0 pb-28 min-h-0 overflow-y-auto overscroll-contain"
                  style={{ scrollbarGutter: 'stable both-edges', overscrollBehavior: 'contain' }}
                >
                  {blocks.map((block, idx) => (
                    <div key={idx} className="flex items-start gap-1 py-0">
                      {block.type === 'checkbox' ? (
                        <input
                          type="checkbox"
                          checked={!!block.checked}
                          onChange={() => toggleCheckboxChecked(idx)}
                          className="mt-0.5 h-4 w-4 rounded-full border-slate-400 text-blue-500 focus:ring-blue-500"
                        />
                      ) : null}
                      <textarea
                        ref={(el) => {
                          textareaRefs.current[idx] = el as HTMLTextAreaElement
                          syncTextareaSize(el)
                        }}
                        value={block.text}
                        onFocus={() => setFocusIndex(idx)}
                        onChange={(e) => {
                          updateBlockText(idx, e.target.value)
                          syncTextareaSize(e.target)
                        }}
                        onInput={(e) => syncTextareaSize(e.currentTarget)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && block.type === 'checkbox') {
                            e.preventDefault()
                            insertBlockAfter(idx, 'checkbox')
                            setFocusIndex(idx + 1)
                          }
                          if (e.key === 'Backspace' && block.type === 'checkbox' && block.text === '') {
                            e.preventDefault()
                            setBlocks((prev: Block[]) =>
                              prev.map((b: Block, i: number) =>
                                i === idx ? { type: 'text', text: '', checked: undefined } : b
                              )
                            )
                            removeBlockIfEmpty(idx)
                          }
                        }}
                        className={`flex-1 resize-none border-none bg-transparent px-1 text-sm leading-relaxed outline-none placeholder:text-slate-500 ${
                          block.type === 'checkbox' && block.checked
                            ? isLight
                              ? 'text-slate-400 line-through'
                              : 'text-slate-500 line-through'
                            : isLight
                                ? 'text-slate-800'
                                : 'text-slate-200'
                        }`}
                        placeholder={block.type === 'checkbox' ? 'Checklist item' : 'Notes...'}
                      />
                    </div>
                  ))}
                </div>

                {todoError ? <p className="text-xs text-red-400">{todoError}</p> : null}
              </div>

              <button
                type="button"
                onClick={() => toggleBlockType(focusIndex)}
                className={`fixed bottom-6 right-6 inline-flex h-12 w-12 items-center justify-center rounded-full shadow-lg transition ${
                  isLight ? 'bg-blue-500 text-white shadow-blue-500/30' : 'bg-blue-500 text-white shadow-black/50'
                }`}
                aria-label="Toggle checklist"
              >
                ✓
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showCalendar ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 text-white">
          <div className={`flex h-full w-full flex-col animate-[pageSwipeIn_0.2s_ease-out] md:h-auto md:max-h-[90vh] md:w-full md:max-w-3xl md:overflow-hidden md:rounded-2xl md:animate-[pageFadeUp_0.25s_ease-out] ${isLight ? 'bg-white text-slate-900 md:ring-1 md:ring-slate-200' : 'bg-[#060b15] text-white md:ring-1 md:ring-white/10'}`}>
            <div className="flex items-center gap-3 px-4 py-3">
              <button
                type="button"
                onClick={() => setShowCalendar(false)}
                className={`inline-flex h-9 w-9 items-center justify-center rounded-full ring-1 transition ${isLight ? 'bg-slate-100 text-slate-700 ring-slate-200 hover:bg-slate-200' : 'bg-white/5 text-white ring-white/10 hover:bg-white/10'}`}
                aria-label="Close calendar"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
              <div className="ml-1">
                <p className={`text-sm ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Schedule</p>
                <p className={`text-lg font-semibold ${isLight ? 'text-slate-900' : 'text-white'}`}>Calendar</p>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                  className={`inline-flex h-9 w-9 items-center justify-center rounded-full ring-1 transition ${isLight ? 'bg-slate-100 text-slate-700 ring-slate-200 hover:bg-slate-200' : 'bg-white/5 text-white ring-white/10 hover:bg-white/10'}`}
                  aria-label="Previous month"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m15 18-6-6 6-6" />
                  </svg>
                </button>
                <div className={`rounded-full px-3 py-1 text-sm font-semibold ring-1 ${isLight ? 'bg-slate-100 text-slate-800 ring-slate-200' : 'bg-white/5 text-white ring-white/10'}`}>
                  {calendarLabel}
                </div>
                <button
                  type="button"
                  onClick={() => setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                  className={`inline-flex h-9 w-9 items-center justify-center rounded-full ring-1 transition ${isLight ? 'bg-slate-100 text-slate-700 ring-slate-200 hover:bg-slate-200' : 'bg-white/5 text-white ring-white/10 hover:bg-white/10'}`}
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
                  {calendarDays.map((d, idx) => (
                    <button
                      type="button"
                      key={`${d.label}-${idx}`}
                      onClick={() => handleSelectDay(d.date)}
                      className={`relative rounded-xl border px-0 py-2 font-semibold transition ${
                        selectedDate && d.date.toDateString() === selectedDate.toDateString()
                          ? isLight
                            ? 'border-blue-200 bg-blue-50 text-blue-700 shadow-[0_10px_30px_-20px_rgba(59,130,246,0.4)]'
                            : 'border-blue-400/60 bg-blue-500/10 text-white shadow-[0_10px_30px_-20px_rgba(59,130,246,0.7)]'
                          : d.current
                              ? isLight ? 'border-slate-200 bg-white text-slate-900 hover:border-blue-200 hover:bg-blue-50' : 'border-white/15 bg-white/5 text-white hover:border-white/25 hover:bg-white/10'
                              : isLight ? 'border-slate-200 bg-transparent text-slate-500 hover:border-slate-300' : 'border-white/5 bg-transparent text-slate-500 hover:border-white/10'
                      }`}
                    >
                      {d.label}
                      {notesByDate[d.date.toISOString().split('T')[0]] ? (
                        <span className={`absolute left-1/2 top-[70%] h-1.5 w-1.5 -translate-x-1/2 rounded-full ${isLight ? 'bg-blue-500' : 'bg-blue-400'}`} />
                      ) : null}
                    </button>
                  ))}
                </div>
                <div className={`mt-4 space-y-2 rounded-2xl border p-4 ${isLight ? 'border-slate-200 bg-slate-50' : 'border-white/10 bg-[#0c1525]'}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Selected day</p>
                      <p className={`text-sm font-semibold ${isLight ? 'text-slate-900' : 'text-white'}`}>{formatSelectedDate(selectedDate) || 'Choose a date'}</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleSaveNote}
                      disabled={!selectedDate}
                      className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold text-white ring-1 transition hover:bg-blue-400 disabled:opacity-60 ${isLight ? 'bg-blue-500 ring-blue-200' : 'bg-blue-500 ring-white/10'}`}
                    >
                      Save note
                    </button>
                  </div>
                  <textarea
                    value={noteDraft}
                    onChange={(e) => setNoteDraft(e.target.value)}
                    placeholder={selectedDate ? 'Add a note for this day...' : 'Select a date to add notes'}
                    className={`h-24 w-full resize-none rounded-xl px-3 py-2 text-sm placeholder:text-slate-400 ring-1 focus:ring-2 focus:ring-blue-500/60 disabled:opacity-60 ${isLight ? 'bg-white text-slate-900 ring-slate-200' : 'bg-[#0b1220] text-white ring-white/10'}`}
                    disabled={!selectedDate}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
