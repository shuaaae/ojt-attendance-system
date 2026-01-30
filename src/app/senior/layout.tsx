import type { ReactNode } from 'react'

import { ThemeProvider } from '@/components/ThemeProvider'

export default function SeniorLayout({ children }: { children: ReactNode }) {
  return <ThemeProvider>{children}</ThemeProvider>
}
