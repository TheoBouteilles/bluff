// Les sprites sont générés par tools/px/build.py dans public/px/avatars/<id>_face.png et <id>_body.png
export const AVATARS = [
  { id: 'renard', name: 'Renard', emoji: '🦊', color: '#e8893a' },
  { id: 'pieuvre', name: 'Pieuvre', emoji: '🐙', color: '#d65aa0' },
  { id: 'hibou', name: 'Hibou', emoji: '🦉', color: '#a8763e' },
  { id: 'grenouille', name: 'Grenouille', emoji: '🐸', color: '#4caf50' },
  { id: 'loup', name: 'Loup', emoji: '🐺', color: '#7d8a99' },
  { id: 'licorne', name: 'Licorne', emoji: '🦄', color: '#b46ad6' },
  { id: 'tigre', name: 'Tigre', emoji: '🐯', color: '#e9a23b' },
  { id: 'dauphin', name: 'Dauphin', emoji: '🐬', color: '#4aa8d8' },
  { id: 'raton', name: 'Raton', emoji: '🦝', color: '#8f8a84' },
  { id: 'dragon', name: 'Dragon', emoji: '🐲', color: '#c93b3b' },
]

// Apparence personnalisée (profil) : calques générés par tools/px/build_looks.py dans public/px/looks/.
// Indices alignés sur tools/px/looks.py et clean_look() en SQL (migration 0021).
export type Look = { t?: number; a?: number }

export const TUNICS = [
  { name: 'Naturelle', color: null },
  { name: 'Rouge', color: '#b03a3a' },
  { name: 'Bleue', color: '#3a6fb0' },
  { name: 'Verte', color: '#3f8f4f' },
  { name: 'Violette', color: '#7a4aa8' },
  { name: 'Dorée', color: '#d9a93a' },
  { name: 'Noire', color: '#33333d' },
  { name: 'Blanche', color: '#e8e2d4' },
] as const

export const ACCESSORIES = ['Aucun', 'Chapeau', 'Chapeau pointu', 'Couronne', 'Bandeau', 'Lunettes', 'Fleur'] as const
