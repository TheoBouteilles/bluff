import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import BackLink from '../components/BackLink'
import { Avatar, Px } from '../components/Px'
import VillageMap from '../components/VillageMap'
import { Button, Screen, TitleBar, TokenBadge, styles } from '../components/ui'
import { LOCATIONS } from '../data/locations'
import { SIMPLE_ROLES, SOLO_ROLES } from '../data/roles'
import { markTutorialSeen } from '../hooks/useTips'

// Tutoriel pas à pas (« Comment jouer ? ») : les bases en une dizaine d'écrans, avec les vrais éléments du jeu
type Step = { title: string; body: ReactNode }

const P = ({ children }: { children: ReactNode }) => <p className="font-sans text-sm leading-relaxed text-mist">{children}</p>
const B = ({ children }: { children: ReactNode }) => <strong className="text-paper">{children}</strong>

const STEPS: Step[] = [
  {
    title: 'Bienvenue au village',
    body: (
      <>
        <div className="flex items-end justify-center gap-1 py-2">
          {[0, 4, 9, 7, 5, 2].map((i, k) => <Avatar key={i} index={i} kind="body" scale={3} style={{ animationDelay: `${k * 150}ms` }} />)}
        </div>
        <P>Bluff se joue <B>à 4 à 10, autour d’une table</B>, chacun avec son téléphone. Des <B>Saboteurs</B> se cachent parmi les <B>Villageois</B>.</P>
        <P>La nuit, chacun choisit en secret où aller. Le jour, on débat à voix haute… et on <B>bluffe</B>.</P>
      </>
    ),
  },
  {
    title: 'Ton rôle, en secret',
    body: (
      <>
        <div className="grid grid-cols-2 gap-2">
          {SIMPLE_ROLES.map((r) => (
            <div key={r.id} className={`flex flex-col items-center gap-1 border-2 p-3 text-center ${r.team === 'saboteurs' ? 'border-blood bg-blood-d' : 'border-sea bg-paper text-ink'}`}>
              <Px name={`team_${r.team}`} scale={2} className="animate-float" />
              <span className="font-display text-xl font-bold">{r.name}</span>
            </div>
          ))}
        </div>
        <P>Au début, tu <B>maintiens un bouton</B> pour voir ton rôle. Ne montre jamais ton écran !</P>
        <P><span className="text-[#7fb3e0]">Villageois</span> : démasquer les Saboteurs. <span className="text-[#e8847c]">Saboteurs</span> : ils se connaissent entre eux et doivent devenir aussi nombreux que les autres.</P>
      </>
    ),
  },
  {
    title: 'Les jetons',
    body: (
      <>
        <div className="flex justify-center gap-3 py-2"><TokenBadge count={1} /><TokenBadge count={3} /></div>
        <P>Chacun commence avec quelques <B>jetons</B> (les Saboteurs un peu plus) et en gagne <B>1 par nuit</B> à partir de la deuxième.</P>
        <P>Ils servent à agir dans les lieux : enquêter, acheter une rumeur, truquer un vote, parier au casino…</P>
      </>
    ),
  },
  {
    title: 'La nuit : choisis un lieu',
    body: (
      <>
        <div className="pointer-events-none mx-auto max-w-[260px]"><VillageMap mode="night" readonly selected="taverne" /></div>
        <P>Touche un bâtiment, choisis ton action, puis <B>valide</B>. Tant que la nuit n’est pas résolue, tu peux changer d’avis.</P>
        <P>Dans la plupart des lieux, les présents <B>se voient à l’aube</B>. Le Poste de garde et la maison sont discrets.</P>
      </>
    ),
  },
  {
    title: 'Les lieux',
    body: (
      <ul className="flex flex-col gap-2">
        {LOCATIONS.map((l) => (
          <li key={l.id} className="flex items-start gap-2 border-2 border-night-3 bg-night p-2">
            <l.icon size={18} className="mt-0.5 shrink-0 text-gold" />
            <span className="font-sans text-sm"><B>{l.name}</B> <span className="text-mist">— {l.description}</span></span>
          </li>
        ))}
      </ul>
    ),
  },
  {
    title: 'Les meurtres',
    body: (
      <>
        <div className="flex justify-center py-2"><Px name="skull" scale={4} className="animate-float" /></div>
        <P>Dans chaque lieu, si les <B>Saboteurs sont plus nombreux</B> que les autres présents, l’un des non-Saboteurs meurt. À égalité, il y a de bonnes chances (60 % par défaut). Un mort au plus par lieu.</P>
        <P>Rester <B>chez soi</B> protège… mais pas deux nuits de suite. Les Saboteurs, eux, ne paient rien pour tuer.</P>
      </>
    ),
  },
  {
    title: 'L’aube et le débat',
    body: (
      <>
        <div className="flex justify-center py-2"><Px name="sun" scale={4} className="animate-float" /></div>
        <P>À l’aube, chacun lit son <B>rapport privé</B> : qui il a croisé, le résultat de ses actions. On annonce aussi les morts.</P>
        <P>Puis on <B>débat à voix haute</B> : raconte ta nuit (vraie ou inventée), accuse, défends-toi. C’est là que tout se joue !</P>
      </>
    ),
  },
  {
    title: 'Le vote',
    body: (
      <>
        <P>Chacun vote <B>en secret</B> (ou s’abstient). Le plus voté est éliminé et seul son <B>camp</B> est révélé.</P>
        <P>En cas d’égalité, on revote entre les ex æquo. L’hôte passe à la suite quand tout le monde a validé.</P>
      </>
    ),
  },
  {
    title: 'Les fantômes',
    body: (
      <>
        <div className="flex justify-center py-2"><Px name="ghost" scale={4} className="animate-float" /></div>
        <P>Les morts deviennent <B>fantômes</B> : ils ne votent plus et <B>ne parlent plus à la table</B>.</P>
        <P>Chaque nuit, ils observent un vivant et désignent un suspect. Les vivants peuvent les interroger au <B>Cimetière</B>. Un fantôme Saboteur, lui, <B>hante un lieu</B> pour aider ses alliés à tuer.</P>
      </>
    ),
  },
  {
    title: 'Qui gagne ?',
    body: (
      <>
        <P><span className="text-[#7fb3e0]">Villageois</span> : quand il ne reste plus aucun Saboteur.</P>
        <P><span className="text-[#e8847c]">Saboteurs</span> : quand ils sont aussi nombreux que les autres (avec une dernière chance au vote).</P>
        <P>À partir de 7 joueurs, des <span className="text-[#8fd6c2]">Solitaires</span> peuvent jouer leur propre partie : le {SOLO_ROLES[0].name} (fortune) et l’{SOLO_ROLES[1].name.replace(/^L’/, '')} (miser sur le bon camp).</P>
      </>
    ),
  },
]

export default function Tutorial() {
  const [i, setI] = useState(0)
  const last = i === STEPS.length - 1
  const step = STEPS[i]

  useEffect(() => { markTutorialSeen() }, [])
  useEffect(() => { window.scrollTo({ top: 0 }) }, [i])

  return (
    <Screen>
      <div className="sticky top-0 z-30 -mt-2 bg-night py-2">
        <TitleBar title="Comment jouer" left={<BackLink to="/" />} right={<span className="font-pixel text-[11px] text-mist-d">{i + 1}/{STEPS.length}</span>} />
      </div>

      <section className="px-frame flex flex-col gap-3 p-4" key={i}>
        <h2 className="animate-pop font-display text-2xl font-bold uppercase tracking-wider text-paper">{step.title}</h2>
        {step.body}
      </section>

      {/* Progression */}
      <div className="flex justify-center gap-1.5" aria-hidden>
        {STEPS.map((_, k) => (
          <button key={k} type="button" onClick={() => setI(k)} className={`h-2.5 w-2.5 border-2 border-ink ${k === i ? 'bg-gold' : k < i ? 'bg-sand' : 'bg-night-3'}`} />
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Button variant="secondary" disabled={i === 0} onClick={() => setI(i - 1)}>◂ Précédent</Button>
        {last
          ? <Link to="/creer" className={styles.primary}>Créer une partie</Link>
          : <Button onClick={() => setI(i + 1)}>Suivant ▸</Button>}
      </div>
      {last && <Link to="/regles" className={`${styles.ghost} w-full`}>Toutes les règles détaillées</Link>}
    </Screen>
  )
}
