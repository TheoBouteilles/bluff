import { Link } from 'react-router-dom'
import { Drama, Play, ScrollText } from 'lucide-react'
import { Screen, styles } from '../components/ui'
import { getLastRoom } from '../lib/api'

export default function Home() {
  const last = getLastRoom()
  return (
    <Screen>
      <div className="mt-14 mb-6 text-center">
        <Drama className="mx-auto text-amber-500" size={64} strokeWidth={1.5} />
        <h1 className="mt-4 text-5xl font-bold tracking-wide text-amber-100">Bluff</h1>
        <p className="mt-2 text-stone-400">Dans cette taverne, tout le monde cache quelque chose.</p>
      </div>
      {last && (
        <Link to={`/salon/${last}`} className={`${styles.secondary} flex items-center justify-center gap-2`}>
          <Play size={18} /> Reprendre la partie {last}
        </Link>
      )}
      <Link to="/creer" className={styles.primary}>Créer une partie</Link>
      <Link to="/rejoindre" className={styles.secondary}>Rejoindre une partie</Link>
      <Link to="/roles" className={`${styles.ghost} flex items-center justify-center gap-2`}>
        <ScrollText size={18} /> Voir les rôles
      </Link>
    </Screen>
  )
}