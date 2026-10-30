// Réglages modifiables par l'hôte dans le salon. Bornes et valeurs par défaut : alignées sur
// supabase/migrations/0009_reglages.sql (fonctions game_param et setting_bounds).
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
}

export type SettingGroup = { title: string; settings: SettingDef[] }

const yesNo = (n: number) => (n === 1 ? 'Oui' : 'Non')

export const SETTING_GROUPS: SettingGroup[] = [
  {
    title: 'Camps',
    settings: [
      {
        key: 'saboteurs_count', label: 'Nombre de Saboteurs', min: 0, max: 4, default: 0,
        hint: '0 = automatique (1 jusqu’à 5 joueurs, 2 à partir de 6)',
        format: (n) => (n === 0 ? 'Auto' : String(n)),
      },
    ],
  },
  {
    title: 'Jetons',
    settings: [
      { key: 'tokens_start_villager', label: 'Départ Villageois', min: 0, max: 10, default: 1 },
      { key: 'tokens_start_saboteur', label: 'Départ Saboteur', min: 0, max: 10, default: 2 },
      { key: 'tokens_income_villager', label: 'Gain par nuit Villageois', min: 0, max: 5, default: 1, hint: 'À partir de la nuit 2' },
      { key: 'tokens_income_saboteur', label: 'Gain par nuit Saboteur', min: 0, max: 5, default: 1 },
    ],
  },
  {
    title: 'Meurtres (par lieu et par nuit)',
    settings: [
      { key: 'kill_majority_pct', label: 'Saboteurs plus nombreux', min: 0, max: 100, step: 10, unit: '%', default: 100, hint: 'Chance qu’un Villageois meure' },
      { key: 'kill_tie_pct', label: 'Égalité Saboteurs / Villageois', min: 0, max: 100, step: 10, unit: '%', default: 50 },
      { key: 'kill_minority_pct', label: 'Saboteurs moins nombreux', min: 0, max: 100, step: 10, unit: '%', default: 0, hint: 'Au moins un Saboteur présent' },
      { key: 'death_reveals_location', label: 'Annoncer le lieu du meurtre', min: 0, max: 1, default: 0, format: yesNo },
    ],
  },
  {
    title: 'Coûts des lieux (jetons)',
    settings: [
      { key: 'poste_garde_cost', label: 'Poste de garde', min: 0, max: 9, default: 2 },
      { key: 'planque_cost', label: 'Planque (sabotage)', min: 0, max: 9, default: 2 },
      { key: 'rumeur3_cost', label: 'Rumeur sur 3 joueurs', min: 0, max: 9, default: 1 },
      { key: 'rumeur2_cost', label: 'Rumeur sur 2 joueurs', min: 0, max: 9, default: 2 },
      { key: 'don_cost', label: 'Cadeau (taverne)', min: 0, max: 9, default: 1 },
      { key: 'mairie_cost', label: 'Mairie (trucage)', min: 0, max: 9, default: 2 },
    ],
  },
  {
    title: 'Casino',
    settings: [
      { key: 'casino_max', label: 'Mise maximale', min: 0, max: 9, default: 3 },
      { key: 'casino_win_pct', label: 'Chance de gagner', min: 0, max: 100, step: 10, unit: '%', default: 50 },
    ],
  },
  {
    title: 'Vote',
    settings: [
      {
        key: 'vote_runoff_max', label: 'Revotes en cas d’égalité', min: 0, max: 9, default: 3,
        hint: 'Après le dernier revote : tirage au sort. 0 = égalité, personne n’est éliminé',
      },
    ],
  },
]

export const DEFAULT_SETTINGS: Record<string, number> = Object.fromEntries(
  SETTING_GROUPS.flatMap((g) => g.settings.map((s) => [s.key, s.default])),
)
