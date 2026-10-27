import { Link } from 'react-router-dom'
import { Screen, styles } from '../components/ui'

export default function GameStub() {
  return (
    <Screen>
      <div className="text-center mt-24">
        <div className="text-6xl">🎬</div>
        <h1 className="mt-4 text-3xl font-bold">Partie lancée !</h1>
        <p className="mt-2 text-slate-400">La distribution des rôles arrive en phase 2.</p>
      </div>
      <Link to="/" className={styles.secondary}>Retour à l’accueil</Link>
    </Screen>
  )
}