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
  { id: 'villageois', label: 'Villageois (Gentils)', text: 'text-blue-400' },
  { id: 'saboteurs', label: 'Saboteurs (Méchants)', text: 'text-red-500' },
  { id: 'solitaires', label: 'Solitaires', text: 'text-emerald-500' },
]

const V = 'Victoire des Villageois.'
const S = 'Éliminer ou égaliser le nombre de Villageois.'

export const ROLES: Role[] = [
  { id: 'mecene', name: 'Le Mécène', team: 'villageois', description: 'Pilier bienveillant de la communauté.', power: 'Distribue 1 ou 2 jetons supplémentaires à d’autres joueurs pendant la phase secrète.', victory: V },
  { id: 'enqueteur', name: 'L’Enquêteur', team: 'villageois', description: 'Joueur perspicace traquant les indices.', power: 'Dépense 1 jeton pour obtenir une information partielle sur l’alignement d’un joueur.', victory: V },
  { id: 'garde_du_corps', name: 'Le Garde du Corps', team: 'villageois', description: 'Protecteur discret du groupe.', power: 'Protège un joueur ciblé contre un vote ou une action malveillante pendant le tour.', victory: V },
  { id: 'juge', name: 'Le Juge intègre', team: 'villageois', description: 'Arbitre à forte influence lors des jugements.', power: 'Bénéficie d’un double vote (permanent ou activable sous condition de ressources).', victory: V },
  { id: 'temoin', name: 'Le Témoin aveugle', team: 'villageois', description: 'Citoyen observateur mais manque parfois de discernement.', power: 'Apprend à chaque fin de tour combien de pouvoirs ont été activés au total.', victory: V },
  { id: 'saboteur', name: 'Le Saboteur de l’ombre', team: 'saboteurs', description: 'Saboteur principal du groupe.', power: 'Dépense des jetons pour bloquer le vote d’un joueur adverse pendant le débat.', victory: S },
  { id: 'corrupteur', name: 'Le Corrupteur', team: 'saboteurs', description: 'Maître chanteur influençant le flux de ressources.', power: 'Intercepte ou détruit un jeton transféré, ou force un joueur à céder une ressource.', victory: S },
  { id: 'cameleon', name: 'Le Caméléon', team: 'saboteurs', description: 'Espion capable de faire illusion.', power: 'Apparaît comme un simple Villageois innocent lors des enquêtes.', victory: S },
  { id: 'intercepteur', name: 'L’Intercepteur', team: 'saboteurs', description: 'Saboteur opportuniste à l’affût des transactions.', power: 'Choisit secrètement quel joueur le Mécène va financer. S’il devine juste, il intercepte les jetons à sa place.', victory: S },
  { id: 'capitaliste', name: 'Le Capitaliste', team: 'solitaires', description: 'Stratège cupide cherchant à accumuler des richesses.', power: 'Aucun pouvoir direct utile : doit mentir et faire croire qu’il détient un pouvoir clé pour amasser des jetons.', victory: 'Accumuler au moins 10 jetons avant la fin de la partie.' },
  { id: 'opportuniste', name: 'L’Opportuniste', team: 'solitaires', description: 'Caméléon politique cherchant le camp gagnant.', power: 'Dépense des jetons pour tenter de changer d’équipe en cours de partie.', victory: 'Survivre jusqu’à la fin et faire partie du camp vainqueur.' },
]

export const TEAM_STYLE: Record<TeamId, { label: string; text: string; border: string }> = {
  villageois: { label: 'Villageois', text: 'text-blue-400', border: 'border-blue-500' },
  saboteurs: { label: 'Saboteurs', text: 'text-red-500', border: 'border-red-600' },
  solitaires: { label: 'Solitaire', text: 'text-emerald-500', border: 'border-emerald-600' },
}

// Rôles de la version simplifiée (hors liste publique des rôles)
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
    power: 'Tu connais tes complices. Tu pourras saboter un lieu depuis la Planque (2 jetons).',
    victory: 'Éliminer les Villageois ou égaliser leur nombre.',
  },
]

export const getRole = (id: string): Role | undefined =>
  [...ROLES, ...SIMPLE_ROLES].find((r) => r.id === id)