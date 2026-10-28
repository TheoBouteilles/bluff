// Coûts et paramètres des lieux : doivent rester alignés avec la fonction SQL « game_param » (supabase/migrations/0004_phase3b.sql)
export const COSTS = {
  posteGarde: 2,
  planque: 2,
  rumeur3: 1, // rumeur sur un groupe de 3
  rumeur2: 2, // rumeur sur un groupe de 2 (plus précise, donc plus chère)
  don: 1,
  casinoMax: 3,
  casinoWinPct: 50,
}

export const rumeurCost = (groupSize: number) => (groupSize === 3 ? COSTS.rumeur3 : COSTS.rumeur2)
