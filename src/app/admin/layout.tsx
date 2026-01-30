'use client'

import type { ReactNode } from 'react'

import { ThemeProvider } from '@/components/ThemeProvider'

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <ThemeProvider>{children}</ThemeProvider>
}
