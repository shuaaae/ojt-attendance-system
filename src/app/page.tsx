'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function Home() {
  const router = useRouter()
  const [isChecking, setIsChecking] = useState(true)

  useEffect(() => {
    let isMounted = true

    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!isMounted) return
        if (error) {
          router.replace('/login')
          return
        }

        if (data.session) {
          router.replace('/ojt/dashboard')
        } else {
          router.replace('/login')
        }
      })
      .finally(() => {
        if (!isMounted) return
        setIsChecking(false)
      })

    return () => {
      isMounted = false
    }
  }, [router])

  return isChecking ? <div className="p-4">Loading…</div> : null
}
