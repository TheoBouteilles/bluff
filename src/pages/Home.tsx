import { Link } from 'react-router-dom'
import { Avatar, Px } from '../components/Px'
import { Screen, styles } from '../components/ui'
import { AVATARS } from '../data/avatars'
import { getLastRoom } from '../lib/api'

export default function Home() {
  const last = getLastRoom()
  return (
    <Screen>
      <div className="mt-10 text-center">
        {/* Ronde d'avatars qui se balancent */}
        <div className="mb-4 flex items-end justify-center gap-1">
          {[0, 4, 9, 7, 5].map((i, k) => (
            <Avatar key={i} index={i} kind="body" scale={3} style={{ animationDelay: `${k * 180}ms` }} />
          ))}
        </div>
        <h1 className="font-display text-6xl font-bold uppercase tracking-widest text-paper [text-shadow:4px_4px_0_var(--color-ink)]">Bluff</h1>
        <p className="mt-3 font-sans text-sm text-sand">Dans ce village, tout le monde cache quelque chose.</p>
      </div>

      <div className="px-frame mt-4 flex flex-col gap-3 p-4">
        {last && (
          <Link to={`/salon/${last}`} className={styles.secondary}>
            ▸ Reprendre la partie {last}
          </Link>
        )}
        <Link to="/creer" className={styles.primary}>Créer une partie</Link>
        <Link to="/rejoindre" className={styles.secondary}>Rejoindre une partie</Link>
        <Link to="/roles" className={styles.ghost}>Voir les rôles</Link>
      </div>

      <p className="mt-2 text-center font-pixel text-[10px] uppercase tracking-widest text-mist-d">
        <Px name="moon" scale={1} className="mr-2 align-middle" />{AVATARS.length} avatars · 4 à 10 joueurs · autour d’une table
      </p>
    </Screen>
  )
}
