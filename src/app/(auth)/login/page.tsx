
'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { type FormEvent, useState } from 'react'

import { supabase } from '@/lib/supabase'
import TypingQuote from '@/components/TypingQuote'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isPasswordVisible, setIsPasswordVisible] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) {
        setError(signInError.message)
        return
      }

      const { data: userResp } = await supabase.auth.getUser()
      const userId = userResp.user?.id

      let role: string | null = null
      if (userId) {
        const { data: profile, error: profileErr } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', userId)
          .maybeSingle()

        if (profileErr) {
          console.error('[login] profile fetch error', profileErr)
        } else {
          role = profile?.role ?? null
        }
      }

      console.log('[login redirect] userId', userId, 'role', role)

      let redirectUrl = '/ojt/dashboard'
      if (role === 'head') redirectUrl = '/head/dashboard'
      else if (role === 'senior') redirectUrl = '/senior/dashboard'
      else if (role === 'admin') redirectUrl = '/admin/dashboard'

      router.replace(redirectUrl)
      router.refresh()
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="relative min-h-dvh w-full overflow-hidden bg-[#0b1220] px-5 py-10 flex items-start justify-center md:items-center md:justify-end md:px-28">
      <div className="absolute left-5 top-5 hidden md:left-20 md:top-10 md:block">
        <div className="inline-flex flex-col items-start">
          <h2
            className="text-2xl font-semibold tracking-wide text-slate-100"
            style={{
              textShadow:
                '0 12px 26px rgba(0,0,0,0.75), 0 0 12px rgba(255,255,255,0.14)',
            }}
          >
            <span style={{ display: 'inline-block', transform: 'scaleY(-1)' }}>s</span>
            <span style={{ display: 'inline-block', transform: 'translateY(-0.10em)' }}>h</span>
            <span style={{ display: 'inline-block', transform: 'scaleY(-1)' }}>uaaa.</span>
          </h2>
          <span
            className="-mt-3 text-2xl font-semibold tracking-wide text-slate-100"
            style={{
              opacity: 0.3,
              filter: 'blur(0.6px)',
              WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.85), rgba(0,0,0,0))',
              maskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.85), rgba(0,0,0,0))',
            }}
            aria-hidden="true"
          >
            shuaaa.
          </span>
        </div>
      </div>

      <section className="w-full max-w-sm px-6 pb-8 pt-10 text-white md:max-w-lg md:rounded-3xl md:bg-white/5 md:px-10 md:py-12 md:shadow-[0_30px_90px_-40px_rgba(0,0,0,0.85)] md:ring-1 md:ring-white/10">
        <header className="text-center">
          <div className="inline-flex flex-col items-center">
            <h2
              className="text-2xl font-semibold tracking-wide text-slate-100"
              style={{
                textShadow:
                  '0 12px 26px rgba(0,0,0,0.75), 0 0 12px rgba(255,255,255,0.14)',
              }}
            >
              shuaaa.
            </h2>
            <span
              className="-mt-1 text-2xl font-semibold tracking-wide text-slate-100"
              style={{
                transform: 'scaleY(-1)',
                opacity: 0.3,
                filter: 'blur(0.6px)',
                WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.85), rgba(0,0,0,0))',
                maskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.85), rgba(0,0,0,0))',
              }}
              aria-hidden="true"
            >
              shuaaa.
            </span>
          </div>
        </header>

        <section className="mt-10" aria-label="Login heading">
          <h1 className="text-3xl font-semibold leading-tight text-slate-100">
            Hey
            <br />
            Login Now.
          </h1>
          <p className="mt-2 text-sm text-slate-300">
            Don&apos;t have any account?{' '}
            <Link className="underline underline-offset-4 text-slate-100" href="/register">
              Sign up
            </Link>
          </p>
        </section>

        <form className="mt-8 space-y-4" onSubmit={onSubmit}>
          <fieldset className="space-y-4" disabled={isLoading}>
            <input
              className="w-full rounded-2xl bg-[#0f1a2e] px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 outline-none ring-1 ring-slate-700 focus:ring-2 focus:ring-[#2f66ff]"
              placeholder="Email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <div className="relative">
              <input
                className="w-full rounded-2xl bg-[#0f1a2e] px-4 py-3 pr-12 text-sm text-slate-100 placeholder:text-slate-500 outline-none ring-1 ring-slate-700 focus:ring-2 focus:ring-[#2f66ff]"
                placeholder="Password"
                type={isPasswordVisible ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-100"
                onClick={() => setIsPasswordVisible((v) => !v)}
                aria-label={isPasswordVisible ? 'Hide password' : 'Show password'}
              >
                {isPasswordVisible ? (
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                  >
                    <path
                      d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                  >
                    <path
                      d="M3 3l18 18"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M10.58 10.58A2 2 0 0 0 13.41 13.4"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M9.88 5.09A10.94 10.94 0 0 1 12 5c6.5 0 10 7 10 7a18.06 18.06 0 0 1-5.17 5.82"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M6.11 6.11C3.73 7.8 2 12 2 12s3.5 7 10 7a10.9 10.9 0 0 0 3.41-.55"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M14.12 14.12A3 3 0 0 1 9.88 9.88"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </button>
            </div>
          </fieldset>

          <section className="flex items-center justify-between text-xs text-slate-400" aria-label="Login helpers">
            <button
              type="button"
              className="underline underline-offset-4"
              onClick={async () => {
                setError(null)
                if (!email) {
                  setError('Enter your email first to reset your password.')
                  return
                }
                setIsLoading(true)
                try {
                  const { error: resetError } = await supabase.auth.resetPasswordForEmail(email)
                  if (resetError) {
                    setError(resetError.message)
                    return
                  }
                  setError('Password reset email sent. Please check your inbox.')
                } finally {
                  setIsLoading(false)
                }
              }}
            >
              Forgot Password?
            </button>
            <span>Notify Admin</span>
          </section>

          {error ? (
            <section className="rounded-2xl bg-[#0f1a2e] px-4 py-3 text-sm text-slate-100 ring-1 ring-slate-700" aria-live="polite">
              {error}
            </section>
          ) : null}

          <button
            className="mt-2 w-full rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-900 transition-opacity disabled:opacity-60"
            type="submit"
            disabled={isLoading}
          >
            {isLoading ? 'Logging in…' : 'Login'}
          </button>
        </form>
      </section>

      <TypingQuote
        line1="Streamline your workflow and"
        line2="track your progress with ease."
        typingSpeed={50}
      />

      <img
        src="/illustration/world.svg"
        alt=""
        className="pointer-events-none absolute bottom-10 right-10 w-44 select-none opacity-90 sm:bottom-8 sm:right-8 sm:w-56 md:hidden"
      />
    </main>
  )
}
