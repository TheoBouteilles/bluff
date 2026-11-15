export type TeamId = 'villageois' | 'saboteurs' | 'solitaires'

export type Role = {
  id: string
  name: string
  team: TeamId
  description: string
  power: string
  victory: string
}

export const TEAMS: { id: TeamId; label: string; text: string }[] = [
  { id: 'villageois', label: 'Villageois', text: 'text-[#7fb3e0]' },
  { id: 'saboteurs', label: 'Saboteurs', text: 'text-[#e8847c]' },
  { id: 'solitaires', label: 'Solitaires', text: 'text-[#8fd6c2]' },
]

// Les rôles spéciaux (Mécène, Enquêteur, Caméléon…) ont été abandonnés : la partie se joue
// Villageois contre Saboteurs, avec en option 1 ou 2 Solitaires quand il y a assez de joueurs.
export const SOLO_ROLES: Role[] = [
  {
    id: 'capitaliste', name: 'Le Capitaliste', team: 'solitaires',
    description: 'Stratège cupide qui ne pense qu’à sa fortune.',
    power: 'Aucun pouvoir : il joue les lieux comme tout le monde et peut mentir sur son camp pour se faire offrir des jetons. Il peut être tué la nuit et passe pour innocent aux rumeurs.',
    victory: 'Détenir l’objectif de jetons (10 par défaut) à un moment de la partie. Sa victoire personnelle est alors acquise, même s’il meurt ensuite.',
  },
  {
    id: 'opportuniste', name: 'L’Opportuniste', team: 'solitaires',
    description: 'Girouette politique qui roule pour le camp gagnant.',
    power: 'Parie en secret sur un camp (Villageois ou Saboteurs). Premier choix gratuit, puis chaque changement coûte des jetons, la nuit seulement. Il peut être tué la nuit et passe pour innocent aux rumeurs.',
    victory: 'Être en vie à la fin de la partie et avoir parié sur le camp vainqueur.',
  },
]

export const TEAM_STYLE: Record<TeamId, { label: string; text: string; border: string }> = {
  villageois: { label: 'Villageois', text: 'text-[#7fb3e0]', border: 'border-sea' },
  saboteurs: { label: 'Saboteurs', text: 'text-[#e8847c]', border: 'border-blood' },
  solitaires: { label: 'Solitaire', text: 'text-[#8fd6c2]', border: 'border-moss' },
}

// Les deux camps principaux
export const SIMPLE_ROLES: Role[] = [
  {
    id: 'villageois_simple',
    name: 'Villageois',
    team: 'villageois',
    description: 'Un habitant du village, sans pouvoir particulier.',
    power: 'Aucun pouvoir : tes armes sont ton alibi, tes jetons et ton sens de l’observation.',
    victory: 'Éliminer tous les Saboteurs.',
  },
  {
    id: 'saboteur_simple',
    name: 'Saboteur',
    team: 'saboteurs',
    description: 'Tu te fonds dans le village pour mieux le détruire.',
    power: 'Tu connais tes complices. Tu tues sans payer là où vous êtes en nombre, et tu peux saboter un lieu depuis la Planque.',
    victory: 'Devenir aussi nombreux que les autres joueurs vivants.',
  },
]

// Rôles jouables, affichés dans le menu Rôles
export const ROLES: Role[] = [...SIMPLE_ROLES, ...SOLO_ROLES]

export const getRole = (id: string): Role | undefined => ROLES.find((r) => r.id === id)