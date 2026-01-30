"use client"

import { useEffect, useState, type ChangeEvent } from 'react'
import { useRouter } from 'next/navigation'

import { supabase } from '@/lib/supabase'
import { useTheme } from '@/components/ThemeProvider'

type Profile = {
  name: string | null
  email: string | null
  avatarUrl: string | null
}

const AVATAR_BUCKET = process.env.NEXT_PUBLIC_SUPABASE_AVATARS_BUCKET || 'avatars'

export default function ProfilePage() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile>({ name: null, email: null, avatarUrl: null })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadSuccess, setUploadSuccess] = useState(false)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const { theme, setTheme } = useTheme()

  useEffect(() => {
    let active = true
    const load = async () => {
      const { data, error: sessionError } = await supabase.auth.getSession()
      if (sessionError || !data.session) {
        setError('Not signed in')
        setLoading(false)
        return
      }

      const user = data.session.user
      setUserId(user.id)

      // Try profiles table first for canonical avatar/name, fallback to auth metadata/email
      const { data: profileData } = await supabase.from('profiles').select('name, avatar_url').eq('id', user.id).maybeSingle()
      const displayName = profileData?.name ?? (user.user_metadata && (user.user_metadata.full_name || user.user_metadata.name)) ?? null
      const avatarUrl = profileData?.avatar_url ?? (user.user_metadata && user.user_metadata.avatar_url) ?? null

      if (!active) return
      setProfile({ name: displayName, email: user.email ?? null, avatarUrl })
      setLoading(false)
    }

    load()
    return () => {
      active = false
    }
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  const initial = (profile.name || profile.email || 'U').slice(0, 1).toUpperCase()

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    setUploadError(null)
    if (!userId) {
      setUploadError('Not signed in')
      return
    }
    const file = event.target.files?.[0]
    if (!file) return

    const ext = file.name.split('.').pop() || 'png'
    const filePath = `avatars/${userId}-${Date.now()}.${ext}`
    setUploading(true)

    const { error: uploadErr } = await supabase.storage.from(AVATAR_BUCKET).upload(filePath, file, {
      upsert: true,
      contentType: file.type || undefined,
    })
    if (uploadErr) {
      console.error('Avatar upload failed', uploadErr)
      if (uploadErr.message?.toLowerCase().includes('bucket')) {
        setUploadError(`Storage bucket "${AVATAR_BUCKET}" not found. Create it in Supabase Storage (public) or set NEXT_PUBLIC_SUPABASE_AVATARS_BUCKET to the correct bucket name.`)
      } else {
        setUploadError(uploadErr.message || 'Upload failed. Please try again.')
      }
      setUploading(false)
      return
    }

    const { data: publicData } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(filePath)
    const publicUrl: string | null = publicData?.publicUrl ?? null

    if (publicUrl) {
      // Update auth metadata for convenience
      await supabase.auth.updateUser({ data: { avatar_url: publicUrl } })
      // Try to persist into profiles table; ignore failures so upload still succeeds
      const { error: profileErr } = await supabase.from('profiles').upsert({ id: userId, avatar_url: publicUrl })
      if (profileErr) {
        console.warn('profiles upsert failed; avatar saved to storage but not in profiles table', profileErr)
        // Keep showing the uploaded avatar even if profiles write is blocked
      }
      setProfile((p) => ({ ...p, avatarUrl: publicUrl }))
      setUploadSuccess(true)
      setTimeout(() => setUploadSuccess(false), 1200)
    }

    setUploading(false)
  }

  const isLight = theme === 'light'
  const surface = isLight ? 'bg-white text-slate-900 ring-1 ring-slate-200' : 'bg-white/5 text-white ring-1 ring-white/10'
  const subText = isLight ? 'text-slate-500' : 'text-slate-300'
  const buttonBase =
    'inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold ring-1 transition active:translate-y-[1px]'

  return (
    <div
      className={`relative left-1/2 w-screen -translate-x-1/2 min-h-[90vh] px-4 md:px-8 lg:px-12 ${isLight ? 'bg-white text-slate-900' : 'bg-[#0b1220] text-white'}`}
    >
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 pb-10">
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-semibold">Profile</h1>
            <p className={`text-sm ${subText}`}>View and manage your profile details.</p>
          </div>
          <button
            type="button"
            onClick={() => setTheme(isLight ? 'dark' : 'light')}
            className={`relative h-9 w-16 rounded-full border transition ${
              isLight
                ? 'border-slate-200 bg-slate-100 shadow-inner'
                : 'border-white/15 bg-[#1f2937] shadow-inner'
            }`}
            aria-label="Toggle theme"
          >
            <span
              className={`absolute top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-white text-base shadow transition-all duration-200 ${
                isLight ? 'left-1 text-slate-700' : 'left-[calc(100%-1.75rem)] text-slate-700'
              }`}
            >
              {isLight ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2m0 16v2m10-10h-2M4 12H2m15.54 6.54-1.42-1.42M6.88 6.88 5.46 5.46m12.08 0-1.42 1.42M6.88 17.12l-1.42 1.42" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              )}
            </span>
          </button>
        </div>

        <div className={`flex flex-col items-center gap-4 rounded-2xl p-6 ${surface}`}>
          <div className="relative h-24 w-24">
            {profile.avatarUrl ? (
              <img
                src={profile.avatarUrl}
                alt="Profile avatar"
                className="h-full w-full rounded-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center rounded-full bg-slate-700">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white">
                  <circle cx="12" cy="8" r="4" />
                  <path d="M5 20c1.5-2.5 4.5-4 7-4s5.5 1.5 7 4" />
                </svg>
              </div>
            )}
            <label className="absolute bottom-0 right-0 inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-blue-500 text-white shadow ring-1 ring-white/70 transition hover:bg-blue-400">
              <input type="file" accept="image/*" className="hidden" onChange={handleUpload} />
              {uploading ? (
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
              ) : uploadSuccess ? (
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5h3l2 3h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3l2-3Z" />
                  <circle cx="12" cy="13" r="3" />
                </svg>
              )}
            </label>
          </div>
          <div className="text-center space-y-1">
            <p className="text-xl font-semibold">{loading ? 'Loading…' : profile.name || 'Your name'}</p>
            <p className={`text-sm ${subText}`}>{loading ? ' ' : profile.email || 'Email not available'}</p>
            {uploadError ? <p className="text-xs text-red-400">{uploadError}</p> : null}
            {error ? <p className="text-xs text-red-400">{error}</p> : null}
          </div>
        </div>

        <div className={`space-y-3 rounded-2xl p-4 ${surface}`}>
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Actions</p>
          </div>
          <div className="flex flex-col gap-2 md:flex-row md:gap-3">
            <button
              type="button"
              onClick={() => router.push('/ojt/profile/change-password')}
              className={`${buttonBase} w-full md:w-auto ${isLight ? 'bg-blue-500 text-white ring-blue-200 hover:bg-blue-400' : 'bg-blue-500 text-white ring-white/10 hover:bg-blue-400'}`}
            >
              Change Password
            </button>
            <button
              type="button"
              onClick={() => setShowLogoutConfirm(true)}
              className={`${buttonBase} w-full md:hidden ${isLight ? 'bg-red-500 text-white ring-red-200 hover:bg-red-400' : 'bg-red-500 text-white ring-white/10 hover:bg-red-400'}`}
            >
              Logout
            </button>
          </div>
        </div>
      </div>
      {showLogoutConfirm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className={`w-full max-w-sm rounded-2xl p-6 shadow-xl ${isLight ? 'bg-white text-slate-900 ring-1 ring-slate-200' : 'bg-[#0b1220] text-white ring-1 ring-white/10'}`}>
            <h2 className="text-lg font-semibold">Sign out?</h2>
            <p className={`mt-2 text-sm ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>Are you sure you want to logout?</p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                className={`rounded-full px-4 py-2 text-sm font-semibold ring-1 transition ${isLight ? 'bg-slate-100 text-slate-800 ring-slate-200 hover:bg-slate-200' : 'bg-white/10 text-white ring-white/15 hover:bg-white/15'}`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-full px-4 py-2 text-sm font-semibold text-white ring-1 ring-red-200 bg-red-500 hover:bg-red-400"
              >
                Yes, logout
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
