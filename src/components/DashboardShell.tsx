"use client"

import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useCallback } from 'react'

import { useTheme } from './ThemeProvider'
import type { ReactNode } from 'react'

import { supabase } from '@/lib/supabase'

type Role = 'ojt' | 'head' | 'senior' | 'admin'
type NavItem = { label: string; href: string; icon: ReactNode; roles: Role[] }

const IconHome = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9.5 12 3l9 6.5" />
    <path d="M5 10.5V20h14v-9.5" />
    <path d="M9 14h6v6H9z" />
  </svg>
)

const IconAttendance = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="4" width="16" height="16" rx="2" />
    <path d="M8 9h8M8 13h5M8 17h3" />
  </svg>
)

const IconProfile = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="4" />
    <path d="M5 20c1.5-2.5 4.5-4 7-4s5.5 1.5 7 4" />
  </svg>
)

const defaultNavItems: NavItem[] = [
  { label: 'Home', href: '/ojt/dashboard', icon: IconHome, roles: ['ojt'] },
  { label: 'Attendance', href: '/ojt/attendance', icon: IconAttendance, roles: ['ojt'] },
  { label: 'Profile', href: '/ojt/profile', icon: IconProfile, roles: ['ojt'] },
  { label: 'Head Dashboard', href: '/head/dashboard', icon: IconHome, roles: ['head'] },
  { label: 'Senior Dashboard', href: '/senior/dashboard', icon: IconHome, roles: ['senior'] },
  { label: 'Admin Dashboard', href: '/admin/dashboard', icon: IconHome, roles: ['admin'] },
]

interface DashboardShellProps {
  children: ReactNode
  navItems?: NavItem[]
  role?: Role
}

export default function DashboardShell({ children, navItems = defaultNavItems, role = 'ojt' }: DashboardShellProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { theme } = useTheme()

  const isLight = theme === 'light'

  const filteredNavItems = navItems.filter((item) => item.roles.includes(role))

  const isActive = (href: string) => pathname === href

  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut()
    router.replace('/login')
  }, [router])

  return (
    <div className={`min-h-dvh ${isLight ? 'bg-white text-slate-900' : 'bg-[#0b1220] text-white'}`}>
      <div className="flex min-h-dvh md:h-screen md:overflow-hidden">
        {/* Desktop sidebar */}
        <aside
          className={`hidden w-56 flex-shrink-0 border-r px-4 py-6 md:sticky md:top-0 md:flex md:h-screen md:flex-col md:gap-4 md:overflow-y-auto ${
            isLight ? 'border-slate-200 bg-white text-slate-900' : 'border-white/10 bg-[#0f1628] text-white'
          }`}
        >
          <div className={`px-2 pb-4 text-lg font-semibold ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>Menu</div>
          <nav className={`space-y-2 text-sm font-medium ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
            {filteredNavItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 rounded-xl px-3 py-2 transition-colors ${
                  isActive(item.href)
                    ? isLight
                        ? 'bg-slate-200 text-slate-900'
                        : 'bg-white/10 text-white'
                    : isLight
                        ? 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                        : 'text-slate-300 hover:bg-white/5 hover:text-white'
                }`}
              >
                <span aria-hidden="true">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>
          <div className="mt-auto pt-6">
            <button
              type="button"
              onClick={handleLogout}
              className={`w-full rounded-xl px-3 py-2 text-left text-sm font-semibold transition-colors ${
                isLight ? 'bg-slate-100 text-slate-900 hover:bg-slate-200' : 'bg-white/5 text-slate-100 hover:bg-white/10'
              }`}
            >
              Logout
            </button>
          </div>
        </aside>

        {/* Main content */}
        <div
          className={`relative flex-1 min-w-0 overflow-x-hidden px-4 pb-20 pt-6 md:h-screen md:overflow-y-auto md:px-10 md:pb-6 ${isLight ? 'bg-white text-slate-900' : ''}`}
        >
          <div
            key={pathname}
            className="animate-[pageSwipeIn_0.2s_ease-out] md:animate-[pageFadeUp_0.3s_ease-out]"
          >
            {children}
          </div>

          <div className="pointer-events-none absolute bottom-25 right-4 opacity-30 grayscale md:hidden">
            <Image
              src="/illustration/dash.svg"
              alt="Dashboard illustration"
              width={140}
              height={140}
              priority
              sizes="140px"
              style={{ width: 140, height: 140 }}
            />
          </div>
        </div>
      </div>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 flex justify-center px-0 md:hidden">
        <div
          className={`flex w-full flex-1 items-center justify-between rounded-none rounded-t-[20px] px-6 py-3 shadow-[0_-6px_30px_-20px_rgba(0,0,0,0.9)] ring-1 backdrop-blur-md ${
            isLight ? 'bg-white text-slate-900 ring-slate-200' : 'bg-white/5 text-white ring-white/10'
          }`}
        >
          {filteredNavItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-1 flex-col items-center gap-1 text-[11px] font-semibold transition ${
                isActive(item.href)
                  ? isLight ? 'text-slate-900' : 'text-white'
                  : isLight
                      ? 'text-slate-500 hover:text-slate-700'
                      : 'text-slate-300 hover:text-white'
              }`}
            >
              <span
                aria-hidden="true"
                className={`flex h-9 w-9 items-center justify-center rounded-full ring-1 transition ${
                  isActive(item.href)
                    ? isLight
                        ? 'bg-slate-200 text-slate-900 ring-slate-200 shadow-[0_10px_30px_-20px_rgba(0,0,0,0.15)]'
                        : 'bg-white/10 text-white ring-white/10 shadow-[0_10px_30px_-20px_rgba(0,0,0,0.8)]'
                    : isLight
                        ? 'bg-white text-slate-500 ring-slate-200'
                        : 'bg-transparent text-slate-300 ring-white/10'
                }`}
              >
                {item.icon}
              </span>
              <span className="text-[11px] leading-tight">{item.label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </div>
  )
}
