"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import { supabase } from '@/lib/supabase'

export default function ChangePasswordPage() {
  const router = useRouter()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [show, setShow] = useState(false)
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.')
      return
    }
    setStatus('loading')
    // Supabase does not require current password when updating via auth update.
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
    if (updateError) {
      setError(updateError.message || 'Could not update password.')
      setStatus('error')
      return
    }
    setStatus('success')
    setTimeout(() => router.back(), 800)
  }

  const inputClass =
    'w-full rounded-xl bg-[#0c1525] px-3 py-2 text-sm text-white placeholder:text-slate-500 ring-1 ring-white/10 focus:ring-2 focus:ring-blue-500/60'

  return (
    <div className="min-h-[90vh] p-6 text-white">
      <button
        type="button"
        onClick={() => router.back()}
        className="mb-4 inline-flex items-center gap-2 text-sm text-slate-300 hover:text-white"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m15 18-6-6 6-6" />
        </svg>
        Back
      </button>

      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Change Password</h1>
        <p className="text-sm text-slate-300">Update your account password. Use at least 8 characters.</p>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4 rounded-2xl bg-white/5 p-5 ring-1 ring-white/10">
        <div className="space-y-1">
          <label className="text-sm text-slate-300">Current Password</label>
          <input
            type={show ? 'text' : 'password'}
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className={inputClass}
            placeholder="Enter current password"
            autoComplete="current-password"
            required
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm text-slate-300">New Password</label>
          <input
            type={show ? 'text' : 'password'}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className={inputClass}
            placeholder="Enter new password"
            autoComplete="new-password"
            required
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm text-slate-300">Confirm New Password</label>
          <input
            type={show ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className={inputClass}
            placeholder="Confirm new password"
            autoComplete="new-password"
            required
          />
        </div>

        <div className="flex items-center gap-2 text-sm text-slate-300">
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} className="h-4 w-4 rounded border border-white/20 bg-transparent" />
            Show passwords
          </label>
        </div>

        {error ? <p className="text-sm text-red-400">{error}</p> : null}
        {status === 'success' ? <p className="text-sm text-green-300">Password updated!</p> : null}

        <button
          type="submit"
          disabled={status === 'loading'}
          className="mt-2 inline-flex w-full items-center justify-center rounded-full bg-blue-500 px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/10 transition hover:bg-blue-400 active:translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {status === 'loading' ? 'Updating…' : 'Update Password'}
        </button>
      </form>
    </div>
  )
}
