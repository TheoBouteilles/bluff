import { Beer, Dices, Eye, Ghost, Home, Landmark, Skull } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { COSTS, jetons } from './costs'

export type LocationId = 'casino' | 'taverne' | 'planque' | 'poste_garde' | 'mairie' | 'cimetiere' | 'maison'

export type GameLocation = {
  id: LocationId
  name: string
  icon: LucideIcon
  description: string
  visibleCrossing: boolean // doit correspondre à la table SQL « locations »
  rules: () => string[] // règles détaillées (avec les prix réels du salon, voir COSTS), affichées au moment du choix
}

export const LOCATIONS: GameLocation[] = [
  { id: 'casino', name: 'Casino', icon: Dices, description: 'Tenter sa chance pour gagner des jetons.', visibleCrossing: true,
    rules: () => [
      `Tu peux miser de 1 à ${jetons(COSTS.casinoMax)} (ou ne pas miser).`,
      `${COSTS.casinoWinPct === 50 ? 'Une chance sur deux' : `${COSTS.casinoWinPct} % de chance`} : tu gagnes le double de ta mise, sinon tu la perds.`,
      'Les joueurs présents au Casino se voient entre eux à l’aube.',
    ] },
  { id: 'taverne', name: 'Taverne', icon: Beer, description: 'Offrir des jetons et acheter des rumeurs.', visibleCrossing: true,
    rules: () => [
      `Cadeau : offre ${jetons(COSTS.don)} à un joueur, en secret. Il n’est reçu que si le receveur est aussi à la Taverne cette nuit ; sinon le cadeau échoue, tu gardes ton jeton et tu l’apprends à l’aube.`,
      `Rumeur : choisis 2 ou 3 joueurs et apprends si au moins un Saboteur se cache parmi eux (${jetons(COSTS.rumeur3)} pour 3 joueurs, ${jetons(COSTS.rumeur2)} pour 2).${COSTS.rumeurSoloOnly === 1 ? ` S’il n’y a qu’un seul Saboteur dans la partie, il faut cibler exactement 3 joueurs, pour ${jetons(COSTS.rumeurSmall)}.` : ''} Les Solitaires passent pour innocents.`,
      'Les joueurs présents à la Taverne se voient entre eux à l’aube.',
    ] },
  { id: 'planque', name: 'La Planque', icon: Skull, description: 'Un repaire obscur où l’on prépare de mauvais coups.', visibleCrossing: true,
    rules: () => [
      `Seuls les Saboteurs peuvent y agir : pour ${jetons(COSTS.planque)}, ils sabotent un lieu en secret, dès cette nuit. Personne ne sait qu’il a été saboté.`,
      'Casino saboté : toutes les mises sont perdues (selon les réglages, le Saboteur empoche la moitié des mises jouées). Taverne ou Poste de garde sabotés : les informations données sont fausses. Mairie sabotée : celui qui truque reçoit une voix contre lui.',
      'Le sabotage échoue (jetons perdus) si un non-Saboteur reste en vie à la Planque. Par défaut, le meurtre de la Planque est résolu avant : si l’intrus est tué, le sabotage réussit.',
      'Plusieurs Saboteurs à la Planque : chacun peut saboter un lieu différent ; si deux visent le même lieu, seul le premier paie.',
    ] },
  { id: 'poste_garde', name: 'Poste de garde', icon: Eye, description: 'Surveiller les allées et venues des autres.', visibleCrossing: false,
    rules: () => [
      `Pour ${jetons(COSTS.posteGarde)} (${jetons(COSTS.posteGardeMulti)} quand il y a 2 Saboteurs ou plus), tu apprends où un joueur de ton choix a passé la nuit.`,
      'Lieu discret : personne ne te voit et tu ne vois personne.',
    ] },
  { id: 'mairie', name: 'Mairie', icon: Landmark, description: 'Tenter de truquer le vote du jour.', visibleCrossing: true,
    rules: () => [
      `Pour ${jetons(COSTS.mairie)}, tu truques le vote du lendemain : soit +${COSTS.mairieBoost} voix contre un joueur de ton choix, soit ${COSTS.mairieBoost} voix de moins contre toi. Le trucage ne compte qu’au premier dépouillement, pas lors des revotes.`,
      'Le trucage échoue (jetons perdus) si au moins deux joueurs sont à la Mairie cette nuit. Ils se voient alors à l’aube et l’échec leur est annoncé.',
      'Un trucage réussi reste secret : seul le total des voix est public.',
    ] },
  { id: 'cimetiere', name: 'Cimetière', icon: Ghost, description: 'Interroger les fantômes.', visibleCrossing: true,
    rules: () => [
      'Le Cimetière n’ouvre qu’après le premier mort de la partie.',
      'Tombes nominatives (réglage par défaut) : tu choisis par son nom le fantôme à interroger (les Saboteurs éliminés ne parlent pas) et il te confie son suspect.',
      'Sinon, tombes numérotées : chaque fantôme a choisi une tombe en secret ; si tu choisis la même, il te confie son suspect.',
      `Interroger coûte ${jetons(COSTS.cimetiere)}. Tu peux aussi y aller sans interroger personne : c’est gratuit, mais tu n’apprends rien. Un fantôme peut mentir.`,
      'Les joueurs présents au Cimetière se voient à l’aube. Attention : on peut y être tué comme ailleurs.',
    ] },
  { id: 'maison', name: 'Rester chez soi', icon: Home, description: 'Un alibi tranquille, sans effet.', visibleCrossing: false,
    rules: () => [
      'Aucun effet, aucun risque : personne ne te voit et personne ne peut te tuer.',
      'Tu ne peux pas rester chez toi deux nuits de suite.',
    ] },
]