import BackLink from '../components/BackLink'
import { Px } from '../components/Px'
import { Screen, TitleBar } from '../components/ui'
import { ROLES, TEAMS, TEAM_STYLE } from '../data/roles'

export default function RolesList() {
  return (
    <Screen>
      <TitleBar title="Les rôles" left={<BackLink />} />
      {TEAMS.map((t) => (
        <section key={t.id} className="flex flex-col gap-3">
          <h2 className={`flex items-center gap-2 font-display text-xl font-bold uppercase tracking-wider ${TEAM_STYLE[t.id].text}`}>
            <Px name={`team_${t.id}`} scale={1} /> {t.label}
          </h2>
          {t.id === 'solitaires' && (
            <p className="-mt-1 font-sans text-sm text-mist-d">
              Activés par l’hôte dans les réglages : 1 Solitaire à partir de 7 joueurs, 2 à partir de 8 (seuils réglables). Leur victoire est personnelle.
            </p>
          )}
          {ROLES.filter((r) => r.team === t.id).map((r) => (
            <article key={r.id} className={`px-frame border-l-8 p-4 ${TEAM_STYLE[t.id].border}`}>
              <h3 className="font-display text-lg font-bold text-paper">{r.name}</h3>
              <p className="font-sans text-sm italic text-mist-d">{r.description}</p>
              <p className="mt-2 font-sans text-sm"><span className="font-pixel text-[10px] uppercase tracking-wider text-gold">Pouvoir </span>{r.power}</p>
              <p className="mt-1 font-sans text-sm"><span className="font-pixel text-[10px] uppercase tracking-wider text-gold">Victoire </span>{r.victory}</p>
            </article>
          ))}
        </section>
      ))}
    </Screen>
  )
}
