'use client'

import { useEffect, useState } from 'react'

interface TypingQuoteReverseProps {
  line1: string
  line2: string
  illustrationSrc: string
  typingSpeed?: number
  pauseDuration?: number
}

export default function TypingQuoteReverse({
  line1,
  line2,
  illustrationSrc,
  typingSpeed = 80,
  pauseDuration = 3000,
}: TypingQuoteReverseProps) {
  const [displayText1, setDisplayText1] = useState('')
  const [displayText2, setDisplayText2] = useState('')
  const [showCursor1, setShowCursor1] = useState(true)
  const [showCursor2, setShowCursor2] = useState(false)
  const [phase, setPhase] = useState<'typing1' | 'typing2' | 'pause' | 'clear'>('typing1')

  useEffect(() => {
    let timeout: NodeJS.Timeout

    if (phase === 'typing1') {
      if (displayText1.length < line1.length) {
        timeout = setTimeout(() => {
          setDisplayText1(line1.slice(0, displayText1.length + 1))
        }, typingSpeed)
      } else {
        setShowCursor1(false)
        setShowCursor2(true)
        setPhase('typing2')
      }
    } else if (phase === 'typing2') {
      if (displayText2.length < line2.length) {
        timeout = setTimeout(() => {
          setDisplayText2(line2.slice(0, displayText2.length + 1))
        }, typingSpeed)
      } else {
        setShowCursor2(false)
        timeout = setTimeout(() => {
          setPhase('pause')
        }, pauseDuration)
      }
    } else if (phase === 'pause') {
      timeout = setTimeout(() => {
        setPhase('clear')
      }, 100)
    } else if (phase === 'clear') {
      setDisplayText1('')
      setDisplayText2('')
      setShowCursor1(true)
      setShowCursor2(false)
      setPhase('typing1')
    }

    return () => clearTimeout(timeout)
  }, [displayText1, displayText2, phase, line1, line2, typingSpeed, pauseDuration])

  return (
    <div className="pointer-events-none absolute left-70 top-1/2 hidden h-[400px] w-[600px] -translate-y-1/2 select-none md:block">
      <div className="absolute right-0 top-0 w-[340px] text-right">
        <p className="text-right text-3xl font-bold leading-tight text-white">
          {displayText1}
          {showCursor1 && (
            <span className="inline-block w-1 animate-pulse border-r-4 border-white"></span>
          )}
        </p>
      </div>

      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-100">
        <div className="absolute inset-0 animate-pulse rounded-full bg-blue-500/20 blur-3xl"></div>
        <img
          src={illustrationSrc}
          alt=""
          className="relative w-[250px] animate-[float_3s_ease-in-out_infinite] opacity-100 transition-transform duration-700 hover:scale-105"
        />
      </div>

      <div className="absolute bottom-0 left-0 w-[280px]">
        <p className="text-left text-3xl font-bold leading-tight text-white">
          {displayText2}
          {showCursor2 && (
            <span className="inline-block w-1 animate-pulse border-r-4 border-white"></span>
          )}
        </p>
      </div>
    </div>
  )
}
