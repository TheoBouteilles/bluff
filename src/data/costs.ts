// Coûts des lieux. Valeurs par défaut ; elles sont remplacées par les réglages du salon
// (voir useRoomSettings, qui appelle applySettingsToCosts). Alignées sur la fonction SQL « game_param » (0023).
export const COSTS = {
  posteGarde: 2, // avec un seul Saboteur dans la partie
  posteGardeMulti: 1, // avec 2 Saboteurs ou plus
  planque: 2,
  rumeur3: 2, // rumeur sur un groupe de 3
  rumeur2: 3, // rumeur sur un groupe de 2 (plus précise, donc plus chère)
  don: 1,
  mairie: 2, // trucage du vote
  casinoMax: 3,
  casinoWinPct: 60,
  cimetiere: 1, // choisir une tombe
  tombCount: 3,
  mairieBoost: 1, // voix ajoutées contre un joueur, ou retirées contre soi
  rumeurSoloOnly: 1, // 1 = avec un seul Saboteur, rumeur sur 3 joueurs uniquement
  rumeurSmall: 3, // prix de cette rumeur
  saboteursSetting: 0, // réglage « Nombre de Saboteurs » (0 = automatique)
}

export function applySettingsToCosts(s: Record<string, number>) {
  const pick = (k: string, fallback: number) => (typeof s[k] === 'number' ? s[k] : fallback)
  COSTS.posteGarde = pick('poste_garde_cost', COSTS.posteGarde)
  COSTS.posteGardeMulti = pick('poste_garde_cost_multi', COSTS.posteGardeMulti)
  COSTS.planque = pick('planque_cost', COSTS.planque)
  COSTS.rumeur3 = pick('rumeur3_cost', COSTS.rumeur3)
  COSTS.rumeur2 = pick('rumeur2_cost', COSTS.rumeur2)
  COSTS.don = pick('don_cost', COSTS.don)
  COSTS.mairie = pick('mairie_cost', COSTS.mairie)
  COSTS.casinoMax = pick('casino_max', COSTS.casinoMax)
  COSTS.casinoWinPct = pick('casino_win_pct', COSTS.casinoWinPct)
  COSTS.cimetiere = pick('cemetery_cost', COSTS.cimetiere)
  COSTS.tombCount = pick('tomb_count', COSTS.tombCount)
  COSTS.mairieBoost = pick('mairie_boost', COSTS.mairieBoost)
  COSTS.rumeurSoloOnly = pick('rumeur_solo_only', COSTS.rumeurSoloOnly)
  COSTS.rumeurSmall = pick('rumeur_small_cost', COSTS.rumeurSmall)
  COSTS.saboteursSetting = pick('saboteurs_count', COSTS.saboteursSetting)
}

/** Nombre de Saboteurs distribués, comme start_game : réglage du salon, sinon 1 jusqu'à 5 joueurs, 2 au-delà. */
export const saboteurTotal = (playerCount: number) =>
  COSTS.saboteursSetting > 0 ? Math.min(COSTS.saboteursSetting, playerCount - 1) : playerCount <= 5 ? 1 : 2

/** Avec un seul Saboteur, la rumeur vise toujours 3 joueurs (SQL : rumeur_small). */
export const rumeurThreeOnly = (saboteurs: number) => COSTS.rumeurSoloOnly === 1 && saboteurs === 1

export const rumeurCost = (groupSize: number, saboteurs: number) =>
  rumeurThreeOnly(saboteurs) ? COSTS.rumeurSmall : groupSize === 3 ? COSTS.rumeur3 : COSTS.rumeur2

/** Prix du Poste de garde selon le nombre de Saboteurs (SQL : poste_cost). */
export const posteCost = (saboteurs: number) => (saboteurs >= 2 ? COSTS.posteGardeMulti : COSTS.posteGarde)

/** « 1 jeton », « 2 jetons » */
export const jetons = (n: number) => `${n} jeton${n > 1 ? 's' : ''}`
