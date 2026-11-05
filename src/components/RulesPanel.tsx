import { LOCATIONS } from '../data/locations'
import { DEFAULT_SETTINGS } from '../data/settings'
import { panelClass } from './ui'

type Props = { settings: Record<string, number> }

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className={`${panelClass} p-4`}>
      <h2 className="font-display text-lg font-bold text-amber-100">{title}</h2>
      <div className="mt-2 flex flex-col gap-2 text-sm text-stone-300">{children}</div>
    </section>
  )
}

const List = ({ items }: { items: string[] }) => (
  <ul className="list-disc space-y-1 pl-5">
    {items.map((i) => <li key={i}>{i}</li>)}
  </ul>
)

// Toutes les règles du jeu, avec les valeurs réelles des réglages du salon
export default function RulesPanel({ settings }: Props) {
  const s = (k: string) => settings[k] ?? DEFAULT_SETTINGS[k]
  const j = (n: number) => `${n} jeton${n > 1 ? 's' : ''}`
  const small = s('rumeur_small_max_players')
  const costs: Record<string, string> = {
    casino: `Mise de 0 à ${s('casino_max')} jetons, ${s('casino_win_pct')} % de chance de gagner le double.`,
    taverne: `Cadeau : ${j(s('don_cost'))}. Rumeur sur 3 joueurs : ${j(s('rumeur3_cost'))}, sur 2 joueurs : ${j(s('rumeur2_cost'))}.${small > 0 ? ` Jusqu’à ${small} joueurs : exactement 3 cibles, ${j(s('rumeur_small_cost'))}.` : ''}`,
    planque: `Saboteurs : ${j(s('planque_cost'))} pour saboter un lieu en secret, la même nuit.`,
    poste_garde: `Enquête sur un joueur : ${j(s('poste_garde_cost'))}.`,
    mairie: `Trucage : ${j(s('mairie_cost'))} (+${s('mairie_boost')} voix contre un joueur, ou voix reçues annulées).`,
    cimetiere: `Choisir une tombe : ${j(s('cemetery_cost'))} (${s('tomb_count')} tombes). Ouvert après le premier mort.`,
  }
  const nbSab = s('saboteurs_count')
  return (
    <div className="flex flex-col gap-3">
      <Section title="But du jeu">
        <p>
          Des Saboteurs se cachent parmi les Villageois. Les Villageois gagnent en éliminant tous les Saboteurs ;
          les Saboteurs gagnent quand ils sont aussi nombreux que les autres joueurs vivants.
        </p>
        <p>
          Nombre de Saboteurs : {nbSab === 0 ? '1 jusqu’à 5 joueurs, 2 à partir de 6.' : `${nbSab}.`}
        </p>
      </Section>

      <Section title="Déroulement d’une manche">
        <List items={[
          'Nuit : chacun choisit en secret un lieu (et son action), puis VALIDE. Un bouton « Retour » permet de modifier tant que la nuit n’est pas résolue.',
          'Aube et débat : on découvre les résultats privés et l’éventuelle victime. Les joueurs discutent à voix haute.',
          'Vote : chacun vote (ou s’abstient) puis valide. Le plus voté est éliminé et son camp est révélé.',
          s('timers_on') === 1
            ? `Minuteurs actifs : nuit ${s('night_seconds')} s, débat ${s('day_seconds')} s, vote ${s('vote_seconds')} s. Le temps écoulé fait passer à la suite.`
            : 'Pas de minuteur : l’hôte passe à la phase suivante, mais seulement quand tous les joueurs ont validé (nuit et vote).',
        ]} />
      </Section>

      <Section title="Jetons">
        <List items={[
          `Départ : ${j(s('tokens_start_villager'))} par Villageois ; Saboteur seul : ${j(s('tokens_start_saboteur_solo'))} ; à plusieurs : ${j(s('tokens_start_saboteur'))} chacun.`,
          `Gain chaque nuit à partir de la nuit 2 : ${s('tokens_income_villager')} (Villageois), ${s('tokens_income_saboteur')} (Saboteur).`,
        ]} />
      </Section>

      <Section title="Les lieux">
        <div className="flex flex-col gap-3">
          {LOCATIONS.map((l) => (
            <div key={l.id} className="rounded-lg border border-amber-900/40 bg-stone-950/50 p-3">
              <p className="flex items-center gap-2 font-semibold text-amber-100">
                <l.icon size={18} className="text-amber-500" /> {l.name}
              </p>
              <p className="mt-1 text-stone-400">{l.description}</p>
              {costs[l.id] && <p className="mt-1 text-amber-300">{costs[l.id]}</p>}
              <List items={l.rules} />
            </div>
          ))}
        </div>
      </Section>

      <Section title="Meurtres">
        <List items={[
          'Dans chaque lieu, si des Saboteurs s’y trouvent, un meurtre peut avoir lieu (un mort maximum par lieu et par nuit). Les Saboteurs ne paient rien.',
          `Saboteurs plus nombreux que les autres : ${s('kill_majority_pct')} % de chance. À égalité : ${s('kill_tie_pct')} %. Moins nombreux : ${s('kill_minority_pct')} %.`,
          s('death_reveals_location') === 1 ? 'L’annonce de la mort indique le lieu du meurtre.' : 'L’annonce de la mort donne seulement le nom de la victime, pas le lieu.',
          'Rester chez soi protège, mais pas deux nuits de suite.',
        ]} />
      </Section>

      <Section title="Vote et égalités">
        <List items={[
          'Les voix sont publiques après le dépouillement, les votes individuels restent secrets.',
          s('vote_runoff_max') > 0
            ? `En cas d’égalité, on revote entre les ex æquo (jusqu’à ${s('vote_runoff_max')} fois), puis tirage au sort.`
            : 'En cas d’égalité, personne n’est éliminé.',
        ]} />
      </Section>

      <Section title="Fantômes et cimetière">
        <List items={[
          'Un joueur éliminé devient fantôme : il ne vote plus ni ne joue, et ne parle plus à la table.',
          'Chaque nuit il observe gratuitement un joueur vivant (il saura où il est allé), choisit une tombe (définitive) et désigne un suspect, qu’il peut mentir.',
          'Un vivant qui choisit la même tombe au Cimetière reçoit le suspect du fantôme.',
        ]} />
      </Section>

      <Section title="Victoire">
        <List items={[
          'Villageois : tous les Saboteurs sont éliminés.',
          s('sudden_death_on') === 1
            ? 'Mort subite : si Saboteurs et autres sont à égalité, la partie continue. Si aucun Saboteur n’est éliminé au vote suivant, les Saboteurs gagnent.'
            : 'À égalité de nombre, les Saboteurs gagnent immédiatement.',
          'S’il ne reste qu’un Saboteur et un seul autre joueur, le Saboteur gagne aussitôt.',
          'Saboteurs plus nombreux que les autres : victoire immédiate.',
        ]} />
      </Section>
    </div>
  )
}
