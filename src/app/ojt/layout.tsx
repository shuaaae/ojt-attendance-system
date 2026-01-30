import type { ReactNode } from 'react'

import DashboardShell from '@/components/DashboardShell'
import { ThemeProvider } from '@/components/ThemeProvider'

export default function OjtLayout({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <DashboardShell>{children}</DashboardShell>
    </ThemeProvider>
  )
}
