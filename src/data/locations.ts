import { Beer, Dices, Eye, Home, Landmark, Skull } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type LocationId = 'casino' | 'taverne' | 'planque' | 'poste_garde' | 'mairie' | 'maison'

export type GameLocation = {
  id: LocationId
  name: string
  icon: LucideIcon
  description: string
  visibleCrossing: boolean // doit correspondre à la table SQL « locations »
  rules: string[] // règles détaillées, affichées au moment du choix
}

export const LOCATIONS: GameLocation[] = [
  { id: 'casino', name: 'Casino', icon: Dices, description: 'Tenter sa chance pour gagner des jetons.', visibleCrossing: true,
    rules: [
      'Tu peux miser de 1 à 3 jetons (ou ne pas miser).',
      'Une chance sur deux : tu gagnes le double de ta mise, ou tu la perds.',
      'Les joueurs présents au Casino se voient entre eux à l’aube.',
    ] },
  { id: 'taverne', name: 'Taverne', icon: Beer, description: 'Échanger des jetons et acheter des rumeurs.', visibleCrossing: true,
    rules: [
      'Cadeau : offre 1 jeton à un joueur. Il reste secret et n’est reçu que si le receveur est aussi à la Taverne cette nuit. Sinon le cadeau échoue, ton jeton est conservé et tu l’apprends à l’aube.',
      'Rumeur : choisis 2 ou 3 joueurs et apprends si au moins un Saboteur se cache parmi eux (1 jeton pour 3 joueurs, 2 jetons pour 2). Le Caméléon passe pour un innocent.',
      'Les joueurs présents à la Taverne se voient entre eux à l’aube.',
    ] },
  { id: 'planque', name: 'La Planque', icon: Skull, description: 'Un repaire obscur où l’on prépare de mauvais coups.', visibleCrossing: true,
    rules: [
      'Réservé aux Saboteurs pour agir : 2 jetons pour fermer le Casino, la Taverne ou le Poste de Garde la nuit suivante.',
      'Le sabotage échoue (jetons perdus) si un joueur hors Saboteurs est aussi à la Planque. Tous se voient alors à l’aube.',
      'Un lieu saboté est annoncé publiquement à l’aube.',
    ] },
  { id: 'poste_garde', name: 'Poste de Garde', icon: Eye, description: 'Surveiller les allées et venues des autres.', visibleCrossing: false,
    rules: [
      'Pour 2 jetons, tu apprends où un joueur de ton choix a passé la nuit.',
      'Lieu discret : personne ne te voit et tu ne vois personne.',
    ] },
  { id: 'mairie', name: 'Mairie', icon: Landmark, description: 'Tenter de truquer le vote du jour.', visibleCrossing: true,
    rules: [
      'Pour 2 jetons, tu truques le vote de la journée qui suit : soit +2 voix contre un joueur de ton choix, soit tes propres voix reçues sont annulées.',
      'Le trucage échoue (jetons perdus) si au moins deux joueurs sont à la Mairie cette nuit. Ils se voient alors à l’aube et l’échec leur est annoncé.',
      'Le trucage réussi reste secret : seul le total des voix est public.',
    ] },
  { id: 'maison', name: 'Rester chez soi', icon: Home, description: 'Un alibi tranquille, sans effet.', visibleCrossing: false,
    rules: [
      'Aucun effet, aucun risque : personne ne te voit.',
      'Tu ne peux alors pas être surpris ailleurs, mais tu ne fais rien de la nuit.',
    ] },
]