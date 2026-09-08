'use client'

import { useEffect, useRef, useState } from 'react'

interface FadeInProps {
  children: React.ReactNode
  className?: string
  delay?: number   // ms, for stagger
  direction?: 'up' | 'left' | 'right' | 'none'
}

export default function FadeIn({ children, className = '', delay = 0, direction = 'up' }: FadeInProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect() } },
      { threshold: 0.12 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const translate = {
    up: 'translate-y-6',
    left: '-translate-x-6',
    right: 'translate-x-6',
    none: '',
  }[direction]

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${
        visible ? 'opacity-100 translate-y-0 translate-x-0' : `opacity-0 ${translate}`
      } ${className}`}
      style={{ transitionDelay: visible ? `${delay}ms` : '0ms' }}
    >
      {children}
    </div>
  )
}
