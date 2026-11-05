import { Link, useSearchParams } from 'react-router-dom'
import RulesPanel from '../components/RulesPanel'
import { Screen } from '../components/ui'
import { useRoom } from '../hooks/useRoom'
import { useRoomSettings } from '../hooks/useRoomSettings'

export default function Rules() {
  const code = (useSearchParams()[0].get('salon') ?? '').toUpperCase()
  const { room } = useRoom(code)
  const cfg = useRoomSettings(room?.id)
  return (
    <Screen>
      <h1 className="font-display text-2xl font-bold text-amber-100">Règles du jeu</h1>
      <RulesPanel settings={cfg.settings} />
      <Link to={code ? `/salon/${code}` : '/'} className="text-center text-sm text-stone-400 hover:text-white">← Retour</Link>
    </Screen>
  )
}
