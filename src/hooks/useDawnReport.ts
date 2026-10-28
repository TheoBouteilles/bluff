import { useEffect, useState } from 'react'
import { getDawnReport } from '../lib/api'
import type { DawnReport } from '../lib/api'

export function useDawnReport(
  roomId: string | undefined,
  round: number,
  enabled: boolean,
  playerId: string | undefined,
) {
  const [report, setReport] = useState<DawnReport | null>(null)

  useEffect(() => {
    if (!enabled || !roomId || !playerId || round < 1) {
      setReport(null)
      return
    }
    let cancelled = false
    getDawnReport(roomId, round, playerId)
      .then((r) => { if (!cancelled) setReport(r) })
      .catch(() => { if (!cancelled) setReport(null) })
    return () => { cancelled = true }
  }, [roomId, round, enabled, playerId])

  return report
}