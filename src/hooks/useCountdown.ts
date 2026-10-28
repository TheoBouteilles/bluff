import { useEffect, useState } from 'react'

// Secondes restantes avant une échéance (0 si dépassée ou absente)
export function useCountdown(endsAt: string | null): number {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(id)
  }, [])

  if (!endsAt) return 0
  return Math.max(0, Math.ceil((new Date(endsAt).getTime() - now) / 1000))
}