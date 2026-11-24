// Réglages modifiables par l'hôte dans le salon. Bornes et valeurs par défaut : alignées sur
// supabase/migrations/0023_reglages_parties_tests.sql (dernières versions de game_param et setting_bounds).
export type SettingDef = {
  key: string
  label: string
  hint?: string
  min: number
  max: number
  step?: number
  unit?: string
  default: number
  format?: (n: number) => string
  showIf?: (s: (key: string) => number) => boolean // masqué quand le réglage ne s'applique pas
}

export type SettingGroup = { title: string; settings: SettingDef[] }

const yesNo = (n: number) => (n === 1 ? 'Oui' : 'Non')

export const SETTING_GROUPS: SettingGroup[] = [
  {
    title: 'Camps et Solitaires',
    settings: [
      {
        key: 'saboteurs_count', label: 'Nombre de Saboteurs', min: 0, max: 4, default: 0,
        hint: '0 = automatique (1 jusqu’à 5 joueurs, 2 à partir de 6)',
        format: (n) => (n === 0 ? 'Auto' : String(n)),
      },
      { key: 'solitaires_on', label: 'Solitaires', min: 0, max: 1, default: 1, format: yesNo, hint: 'Capitaliste et Opportuniste, à la place de Villageois' },
      { key: 'solitaire1_min_players', label: '1 Solitaire à partir de', min: 4, max: 10, unit: ' j.', default: 7, showIf: (s) => s('solitaires_on') === 1 },
      { key: 'solitaire2_min_players', label: '2 Solitaires à partir de', min: 4, max: 10, unit: ' j.', default: 8, showIf: (s) => s('solitaires_on') === 1 },
      { key: 'capitaliste_goal', label: 'Capitaliste : objectif (jetons)', min: 3, max: 30, default: 10, hint: 'Victoire acquise dès qu’il détient ce nombre de jetons', showIf: (s) => s('solitaires_on') === 1 },
      { key: 'opportuniste_switch_cost', label: 'Opportuniste : changer de camp (jetons)', min: 0, max: 9, default: 2, hint: 'Le premier choix est gratuit', showIf: (s) => s('solitaires_on') === 1 },
    ],
  },
  {
    title: 'Jetons',
    settings: [
      { key: 'tokens_start_villager', label: 'Départ Villageois et Solitaires', min: 0, max: 10, default: 1 },
      { key: 'tokens_start_saboteur_solo', label: 'Départ Saboteur seul', min: 0, max: 10, default: 3, hint: 'Quand il n’y a qu’un Saboteur' },
      { key: 'tokens_start_saboteur', label: 'Départ par Saboteur (à plusieurs)', min: 0, max: 10, default: 2, hint: 'Quand il y a 2 Saboteurs ou plus' },
      { key: 'tokens_income_villager', label: 'Gain par nuit (Villageois, Solitaires)', min: 0, max: 5, default: 1, hint: 'À partir de la nuit 2' },
      { key: 'tokens_income_saboteur', label: 'Gain par nuit Saboteur', min: 0, max: 5, default: 1 },
    ],
  },
  {
    title: 'Meurtres',
    settings: [
      { key: 'kill_majority_pct', label: 'Saboteurs plus nombreux', min: 0, max: 100, step: 10, unit: '%', default: 100, hint: 'Chance de meurtre dans un lieu' },
      { key: 'kill_tie_pct', label: 'Égalité Saboteurs / autres', min: 0, max: 100, step: 10, unit: '%', default: 60 },
      { key: 'kill_minority_pct', label: 'Saboteurs moins nombreux', min: 0, max: 100, step: 10, unit: '%', default: 0, hint: 'Au moins un Saboteur présent' },
      { key: 'death_reveals_location', label: 'Annoncer le lieu du meurtre', min: 0, max: 1, default: 0, format: yesNo },
      { key: 'planque_kill_first', label: 'Planque : meurtre avant sabotage', min: 0, max: 1, default: 1, format: yesNo, hint: 'Oui : si le Saboteur tue le seul intrus de la Planque, son sabotage réussit' },
    ],
  },
  {
    title: 'Lieux et prix',
    settings: [
      { key: 'casino_max', label: 'Casino : mise maximale', min: 0, max: 9, default: 3 },
      { key: 'casino_win_pct', label: 'Casino : chance de gagner', min: 0, max: 100, step: 10, unit: '%', default: 60 },
      { key: 'casino_sabotage_steal', label: 'Casino saboté : le Saboteur empoche', min: 0, max: 1, default: 1, format: yesNo, hint: 'La moitié des mises jouées (arrondie au supérieur)' },
      { key: 'don_cost', label: 'Taverne : cadeau', min: 0, max: 9, default: 1 },
      { key: 'rumeur3_cost', label: 'Taverne : rumeur sur 3 joueurs', min: 0, max: 9, default: 2 },
      { key: 'rumeur2_cost', label: 'Taverne : rumeur sur 2 joueurs', min: 0, max: 9, default: 3 },
      { key: 'rumeur_solo_only', label: 'Un seul Saboteur : rumeur sur 3 joueurs', min: 0, max: 1, default: 1, format: yesNo, hint: 'Oui : avec un seul Saboteur dans la partie, la rumeur vise toujours 3 joueurs' },
      { key: 'rumeur_small_cost', label: 'Prix de cette rumeur', min: 0, max: 9, default: 3, showIf: (s) => s('rumeur_solo_only') === 1 },
      { key: 'poste_garde_cost', label: 'Poste de garde (1 Saboteur)', min: 0, max: 9, default: 2 },
      { key: 'poste_garde_cost_multi', label: 'Poste de garde (2 Saboteurs ou plus)', min: 0, max: 9, default: 1 },
      { key: 'planque_cost', label: 'Planque : sabotage', min: 0, max: 9, default: 2 },
      { key: 'mairie_cost', label: 'Mairie : trucage', min: 0, max: 9, default: 2 },
      { key: 'mairie_boost', label: 'Mairie : voix ajoutées ou retirées', min: 1, max: 3, default: 1, hint: '+ contre un joueur, ou − contre soi' },
      { key: 'cemetery_cost', label: 'Cimetière', min: 0, max: 9, default: 1 },
      { key: 'cemetery_named', label: 'Cimetière : fantôme choisi par son nom', min: 0, max: 1, default: 1, format: yesNo, hint: 'Non : tombes numérotées' },
      { key: 'tomb_count', label: 'Nombre de tombes', min: 2, max: 6, default: 3, showIf: (s) => s('cemetery_named') === 0 },
    ],
  },
  {
    title: 'Fantômes et Saboteurs',
    settings: [
      { key: 'ghost_haunt_on', label: 'Fantôme Saboteur : hanter un lieu', min: 0, max: 1, default: 1, format: yesNo, hint: 'Chance de meurtre augmentée si un Saboteur vivant passe la nuit dans le lieu hanté' },
      { key: 'ghost_haunt_bonus_pct', label: 'Bonus par fantôme', min: 0, max: 100, step: 5, unit: '%', default: 25, showIf: (s) => s('ghost_haunt_on') === 1 },
      { key: 'saboteur_vision', label: 'Saboteurs : voir les lieux des alliés', min: 0, max: 1, default: 1, format: yesNo },
    ],
  },
  {
    title: 'Vote et victoire',
    settings: [
      {
        key: 'vote_runoff_max', label: 'Revotes en cas d’égalité', min: 0, max: 9, default: 2,
        hint: 'Puis tirage au sort. 0 = égalité, personne n’est éliminé',
      },
      {
        key: 'sudden_death_on', label: 'Mort subite à égalité', min: 0, max: 1, default: 1, format: yesNo,
        hint: 'Oui : à égalité Saboteurs / autres, la partie continue un vote. Non : les Saboteurs gagnent',
      },
    ],
  },
  {
    title: 'Minuteurs',
    settings: [
      { key: 'timers_on', label: 'Minuteurs actifs', min: 0, max: 1, default: 0, format: yesNo, hint: 'Non : l’hôte passe à la suite quand tous ont validé' },
      { key: 'night_seconds', label: 'Durée de la nuit', min: 30, max: 600, step: 15, unit: ' s', default: 120, showIf: (s) => s('timers_on') === 1 },
      { key: 'day_seconds', label: 'Durée du débat', min: 30, max: 900, step: 30, unit: ' s', default: 300, showIf: (s) => s('timers_on') === 1 },
      { key: 'vote_seconds', label: 'Durée du vote', min: 30, max: 600, step: 15, unit: ' s', default: 90, showIf: (s) => s('timers_on') === 1 },
    ],
  },
]

export const DEFAULT_SETTINGS: Record<string, number> = Object.fromEntries(
  SETTING_GROUPS.flatMap((g) => g.settings.map((s) => [s.key, s.default])),
)
