import { useSearchParams } from 'react-router-dom'
import BackLink from '../components/BackLink'
import RulesPanel from '../components/RulesPanel'
import { Screen, TitleBar } from '../components/ui'
import { useRoom } from '../hooks/useRoom'
import { useRoomSettings } from '../hooks/useRoomSettings'

export default function Rules() {
  const code = (useSearchParams()[0].get('salon') ?? '').toUpperCase()
  const { room } = useRoom(code)
  const cfg = useRoomSettings(room?.id)
  const back = code ? `/salon/${code}` : '/'
  return (
    <Screen>
      {/* Barre collée en haut : le bouton retour reste visible pendant le défilement */}
      <div className="sticky top-0 z-30 -mt-2 bg-night py-2">
        <TitleBar title="Règles du jeu" left={<BackLink to={back} />} />
      </div>
      <RulesPanel settings={cfg.settings} />
    </Screen>
  )
}
