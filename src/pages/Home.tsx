import { Link } from 'react-router-dom'
import { Avatar, Px } from '../components/Px'
import SoundButton from '../components/SoundOptions'
import { useMusic } from '../hooks/useAudio'
import { useProfile } from '../hooks/useProfile'
import { useTips } from '../hooks/useTips'
import { Screen, styles } from '../components/ui'
import { AVATARS } from '../data/avatars'
import { getLastRoom } from '../lib/api'
import { useInstall } from '../lib/pwa'

export default function Home() {
  const last = getLastRoom()
  const { account, profile } = useProfile()
  const { tutorialSeen } = useTips()
  const install = useInstall()
  useMusic('lobby')

  return (
    <Screen>
      {/* Barre du haut : son (icône) et profil (avatar si connecté, sinon « Se connecter ») */}
      <div className="flex items-center justify-end gap-2">
        <SoundButton />
        {account.guest ? (
          <Link to="/profil" className="border-2 border-night-3 bg-night px-3 py-2 font-pixel text-[11px] uppercase tracking-wider text-paper hover:border-gold">
            Se connecter
          </Link>
        ) : (
          <Link to="/profil" aria-label="Mon profil" title="Mon profil" className="hover:opacity-90">
            <Avatar index={profile?.avatar ?? 0} look={profile?.look} scale={2} ring />
          </Link>
        )}
      </div>

      <div className="mt-4 text-center">
        {/* Ronde d'avatars qui se balancent */}
        <div className="mb-4 flex items-end justify-center gap-1">
          {[0, 4, 9, 7, 5].map((i, k) => (
            <Avatar key={i} index={i} kind="body" scale={3} style={{ animationDelay: `${k * 180}ms` }} />
          ))}
        </div>
        <h1 className="font-display text-6xl font-bold uppercase tracking-widest text-paper [text-shadow:4px_4px_0_var(--color-ink)]">Bluff</h1>
        <p className="mt-3 font-sans text-sm text-sand">Dans ce village, tout le monde cache quelque chose.</p>
      </div>

      {/* Jouer */}
      <div className="px-frame mt-4 flex flex-col gap-3 p-4">
        {last && (
          <Link to={`/salon/${last}`} className={styles.secondary}>
            ▸ Reprendre la partie {last}
          </Link>
        )}
        <Link to="/creer" className={styles.primary}>Créer une partie</Link>
        <Link to="/rejoindre" className={styles.secondary}>Rejoindre une partie</Link>
      </div>

      {/* Apprendre */}
      {!tutorialSeen && (
        <Link to="/tutoriel" className="animate-pop border-2 border-gold bg-gold/10 p-3 text-center font-sans text-sm text-paper">
          <span className="block font-pixel text-[11px] uppercase tracking-[0.2em] text-gold">Première fois ?</span>
          Découvre le jeu en 2 minutes ▸
        </Link>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Link to="/tutoriel" className={styles.secondary}>Comment jouer</Link>
        <Link to="/regles" className={styles.secondary}>
          <Px name="book" scale={2} /> Règles
        </Link>
      </div>

      {/* Application installable : bouton (Android, ordinateur) ou consigne (iPhone) */}
      {install.canInstall && (
        <button type="button" onClick={install.install} className={`${styles.ghost} w-full`}>
          <Px name="check" scale={2} /> Installer l’application
        </button>
      )}
      {install.iosHint && (
        <p className="text-center font-sans text-xs text-mist-d">
          Astuce : sur iPhone, touche <span className="text-paper">Partager</span> puis <span className="text-paper">Sur l’écran d’accueil</span> pour jouer en plein écran.
        </p>
      )}

      <p className="mt-2 text-center font-pixel text-[10px] uppercase tracking-widest text-mist-d">
        <Px name="moon" scale={1} className="mr-2 align-middle" />{AVATARS.length} avatars · 4 à 10 joueurs · autour d’une table
      </p>
      <Link to="/confidentialite" className="text-center font-pixel text-[10px] uppercase tracking-widest text-mist-d underline decoration-1 underline-offset-4 hover:text-paper">
        Confidentialité
      </Link>
    </Screen>
  )
}
