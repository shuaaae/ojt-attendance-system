'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'

import DashboardShell from '@/components/DashboardShell'
import { ThemeProvider } from '@/components/ThemeProvider'
import { supabase } from '@/lib/supabase'

export default function HeadLayout({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [allowed, setAllowed] = useState(false)

  useEffect(() => {
    const run = async () => {
      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData.session) {
        router.replace('/login')
        return
      }
      const userId = sessionData.session.user.id
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).maybeSingle()
      const role = profile?.role ?? null
      if (role !== 'head') {
        const redirectUrl = role === 'ojt' ? '/ojt/dashboard' : role === 'senior' ? '/senior/dashboard' : role === 'admin' ? '/admin/dashboard' : '/login'
        router.replace(redirectUrl)
        return
      }
      setAllowed(true)
    }
    run()
  }, [router])

  if (!allowed) return null

  return (
    <ThemeProvider>
      <DashboardShell role="head">{children}</DashboardShell>
    </ThemeProvider>
  )
}
