import { Link } from 'react-router-dom'
import { Screen, styles } from '../components/ui'
import { getLastRoom } from '../lib/api'

export default function Home() {
  const last = getLastRoom()
  return (
    <Screen>
      <div className="text-center mt-16 mb-8">
        <div className="text-6xl">🎭</div>
        <h1 className="text-4xl font-bold mt-3">Bluff</h1>
        <p className="text-slate-400 mt-2">Le jeu où tout le monde cache quelque chose.</p>
      </div>
      {last && (
        <Link to={`/salon/${last}`} className={styles.secondary}>
          Reprendre la partie {last}
        </Link>
      )}
      <Link to="/creer" className={styles.primary}>Créer une partie</Link>
      <Link to="/rejoindre" className={styles.secondary}>Rejoindre une partie</Link>
      <Link to="/roles" className={styles.ghost}>Voir les rôles</Link>
    </Screen>
  )
}