import { Beer, Dices, Eye, Ghost, Home, Landmark, Skull } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type LocationId = 'casino' | 'taverne' | 'planque' | 'poste_garde' | 'mairie' | 'cimetiere' | 'maison'

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
      'Rumeur : choisis 2 ou 3 joueurs et apprends si au moins un Saboteur se cache parmi eux (2 jetons pour 3 joueurs, 3 jetons pour 2). Dans une petite partie (5 joueurs ou moins), il faut cibler exactement 3 joueurs, pour 4 jetons. Le Caméléon passe pour un innocent.',
      'Les joueurs présents à la Taverne se voient entre eux à l’aube.',
    ] },
  { id: 'planque', name: 'La Planque', icon: Skull, description: 'Un repaire obscur où l’on prépare de mauvais coups.', visibleCrossing: true,
    rules: [
      'Réservé aux Saboteurs pour agir : 2 jetons pour saboter en secret un lieu, la même nuit. Personne ne sait que c’est saboté.',
      'Casino saboté : toutes les mises sont perdues (et le Saboteur empoche ce que les joueurs auraient gagné, selon les réglages). Taverne ou Poste de Garde sabotés : les informations données sont fausses. Mairie sabotée : celui qui truque reçoit une voix contre lui.',
      'Le meurtre de la Planque est résolu d’abord (réglage par défaut) : le sabotage réussit s’il ne reste aucun joueur hors Saboteurs vivant à la Planque. Sinon, jetons perdus.',
      'Plusieurs Saboteurs à la Planque : chacun peut saboter un lieu différent ; si deux visent le même lieu, seul le premier paie.',
    ] },
  { id: 'poste_garde', name: 'Poste de Garde', icon: Eye, description: 'Surveiller les allées et venues des autres.', visibleCrossing: false,
    rules: [
      'Pour 2 jetons, tu apprends où un joueur de ton choix a passé la nuit.',
      'Lieu discret : personne ne te voit et tu ne vois personne.',
    ] },
  { id: 'mairie', name: 'Mairie', icon: Landmark, description: 'Tenter de truquer le vote du jour.', visibleCrossing: true,
    rules: [
      'Pour 2 jetons, tu truques le vote de la journée qui suit : soit +1 voix contre un joueur de ton choix, soit tes propres voix reçues sont annulées.',
      'Le trucage échoue (jetons perdus) si au moins deux joueurs sont à la Mairie cette nuit. Ils se voient alors à l’aube et l’échec leur est annoncé.',
      'Le trucage réussi reste secret : seul le total des voix est public.',
    ] },
  { id: 'cimetiere', name: 'Cimetière', icon: Ghost, description: 'Interroger les fantômes sur leur tombe.', visibleCrossing: true,
    rules: [
      'Le Cimetière n’ouvre qu’à partir du premier mort de la partie.',
      'Tombes nominatives (réglage par défaut) : tu choisis le fantôme à interroger par son nom (les Saboteurs éliminés ne parlent pas) et il te confie son suspect.',
      'Sinon, tombes numérotées : chaque fantôme a choisi une tombe en secret ; si tu choisis la même, il te confie son suspect.',
      'Interroger coûte 1 jeton. Tu peux aussi venir sans choisir : c’est gratuit, mais tu n’apprends rien. Un fantôme peut mentir.',
      'Les joueurs présents au Cimetière se voient à l’aube. Attention : c’est un lieu comme les autres pour les meurtres.',
    ] },
  { id: 'maison', name: 'Rester chez soi', icon: Home, description: 'Un alibi tranquille, sans effet.', visibleCrossing: false,
    rules: [
      'Aucun effet, aucun risque : personne ne te voit et personne ne peut te tuer.',
      'Tu ne fais rien de la nuit, et tu ne peux pas rester chez toi deux nuits de suite.',
    ] },
]