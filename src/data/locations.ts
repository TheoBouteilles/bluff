import { Beer, Dices, Eye, Home, Skull } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type LocationId = 'casino' | 'taverne' | 'planque' | 'poste_garde' | 'maison'

export type GameLocation = {
  id: LocationId
  name: string
  icon: LucideIcon
  description: string
  visibleCrossing: boolean // doit correspondre à la table SQL « locations »
}

export const LOCATIONS: GameLocation[] = [
  { id: 'casino', name: 'Casino', icon: Dices, description: 'Tenter sa chance pour gagner des jetons.', visibleCrossing: true },
  { id: 'taverne', name: 'Taverne', icon: Beer, description: 'Échanger des jetons et acheter des rumeurs.', visibleCrossing: true },
  { id: 'planque', name: 'La Planque', icon: Skull, description: 'Un repaire obscur où l’on prépare de mauvais coups.', visibleCrossing: true },
  { id: 'poste_garde', name: 'Poste de Garde', icon: Eye, description: 'Surveiller les allées et venues des autres.', visibleCrossing: false },
  { id: 'maison', name: 'Rester chez soi', icon: Home, description: 'Un alibi tranquille, sans effet.', visibleCrossing: false },
]