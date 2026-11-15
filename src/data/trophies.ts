// Trophées : les identifiants doivent correspondre à record_game_stats (migration 0017_stats.sql)
export type Trophy = { id: string; name: string; emoji: string; description: string }

export const TROPHIES: Trophy[] = [
  { id: 'premiere_partie', name: 'Bienvenue au village', emoji: '🏡', description: 'Jouer sa première partie.' },
  { id: 'veteran', name: 'Vétéran', emoji: '🎖️', description: 'Jouer 10 parties.' },
  { id: 'pilier', name: 'Pilier du village', emoji: '🏛️', description: 'Jouer 50 parties.' },
  { id: 'increvable', name: 'Increvable', emoji: '🛡️', description: 'Être en vie à la fin de 5 parties.' },
  { id: 'mauvais_endroit', name: 'Mauvais endroit, mauvais moment', emoji: '🪦', description: 'Être tué dès la première nuit.' },
  { id: 'bouc_emissaire', name: 'Bouc émissaire', emoji: '🐐', description: 'Être éliminé au vote alors qu’on était innocent.' },
  { id: 'fin_limier', name: 'Fin limier', emoji: '🔎', description: 'Voter contre un Saboteur 3 manches de suite.' },
  { id: 'loup_solitaire', name: 'Loup solitaire', emoji: '🐺', description: 'Gagner en étant le dernier Saboteur en vie.' },
  { id: 'massacre', name: 'Massacre', emoji: '🔪', description: 'En Saboteur, 3 meurtres dans une même partie.' },
  { id: 'jackpot', name: 'Jackpot', emoji: '🎰', description: 'Gagner au Casino avec la mise maximale.' },
  { id: 'ruine', name: 'Ruiné', emoji: '💸', description: 'Perdre 3 mises de suite au Casino.' },
  { id: 'maire_vereux', name: 'Maire véreux', emoji: '🎩', description: 'Truquer la Mairie et faire éliminer sa cible.' },
  { id: 'main_dans_le_sac', name: 'Pris la main dans le sac', emoji: '🫣', description: 'Rater un trucage à la Mairie.' },
  { id: 'pere_noel', name: 'Père Noël', emoji: '🎁', description: 'Offrir 5 cadeaux à la Taverne (toutes parties).' },
  { id: 'serrurier', name: 'Serrurier', emoji: '🔒', description: 'Réussir 3 sabotages depuis la Planque (toutes parties).' },
  { id: 'medium', name: 'Médium', emoji: '🔮', description: 'Recevoir au Cimetière un indice qui désigne un vrai Saboteur.' },
  { id: 'fantome_rancunier', name: 'Fantôme rancunier', emoji: '👻', description: 'En fantôme, désigner le bon Saboteur comme suspect.' },
]

export const getTrophy = (id: string): Trophy | undefined => TROPHIES.find((t) => t.id === id)
