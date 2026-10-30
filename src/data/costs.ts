// Coûts des lieux. Valeurs par défaut ; elles sont remplacées par les réglages du salon
// (voir useRoomSettings, qui appelle applySettingsToCosts). Alignées sur la fonction SQL « game_param ».
export const COSTS = {
  posteGarde: 2,
  planque: 2,
  rumeur3: 1, // rumeur sur un groupe de 3
  rumeur2: 2, // rumeur sur un groupe de 2 (plus précise, donc plus chère)
  don: 1,
  mairie: 2, // trucage du vote
  casinoMax: 3,
  casinoWinPct: 50,
}

export function applySettingsToCosts(s: Record<string, number>) {
  const pick = (k: string, fallback: number) => (typeof s[k] === 'number' ? s[k] : fallback)
  COSTS.posteGarde = pick('poste_garde_cost', COSTS.posteGarde)
  COSTS.planque = pick('planque_cost', COSTS.planque)
  COSTS.rumeur3 = pick('rumeur3_cost', COSTS.rumeur3)
  COSTS.rumeur2 = pick('rumeur2_cost', COSTS.rumeur2)
  COSTS.don = pick('don_cost', COSTS.don)
  COSTS.mairie = pick('mairie_cost', COSTS.mairie)
  COSTS.casinoMax = pick('casino_max', COSTS.casinoMax)
  COSTS.casinoWinPct = pick('casino_win_pct', COSTS.casinoWinPct)
}

export const rumeurCost = (groupSize: number) => (groupSize === 3 ? COSTS.rumeur3 : COSTS.rumeur2)
