import type { KeyboardEvent } from 'react'
import { LOCATIONS } from '../data/locations'

type Props = {
  selected?: string
  closed: string[]
  onSelect: (locationId: string) => void
  onInfo: (locationId: string) => void
}

// Carte illustrée (public/village.jpg, 864 x 1222). Chaque lieu est une zone cliquable posée sur l'image :
// `poly` = contour du bâtiment, `c` = centre (croix « fermé »), `i` = position du bouton règles.
type Spot = { poly: string; c: [number, number]; i: [number, number] }

const SPOTS: Record<string, Spot> = {
  mairie: { poly: '262,30 330,20 600,40 610,280 370,310 262,250', c: [435, 170], i: [575, 60] },
  casino: { poly: '0,210 150,150 285,235 290,480 160,490 160,385 15,385 0,380', c: [145, 330], i: [255, 175] },
  taverne: { poly: '590,260 700,130 864,110 864,520 640,510 590,420', c: [745, 330], i: [835, 140] },
  poste_garde: { poly: '15,390 160,390 160,560 300,560 300,820 0,820 0,600 15,600', c: [140, 650], i: [275, 585] },
  planque: { poly: '590,600 700,505 840,520 840,820 590,820', c: [715, 680], i: [830, 540] },
  cimetiere: { poly: '0,840 230,820 420,880 420,1010 240,1100 0,1100', c: [190, 970], i: [395, 850] },
  maison: { poly: '575,830 800,820 864,900 864,1100 575,1100', c: [715, 970], i: [830, 850] },
}

export default function VillageMap({ selected, closed, onSelect, onInfo }: Props) {
  const keyHandler = (id: string, enabled: boolean) => (e: KeyboardEvent) => {
    if (enabled && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault()
      onSelect(id)
    }
  }

  return (
    <svg
      viewBox="0 0 864 1222"
      className="w-full select-none rounded-2xl border border-amber-800/40 bg-stone-950"
      role="group"
      aria-label="Carte du village : choisis où passer la nuit"
    >
      <defs>
        <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="8" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      <image href="/village.jpg" x="0" y="0" width="864" height="1222" preserveAspectRatio="xMidYMid slice" />

      {/* Assombrit le reste du village quand un lieu est choisi */}
      {selected && <rect width="864" height="1222" fill="rgba(2,6,23,0.35)" pointerEvents="none" />}

      {LOCATIONS.map((l) => {
        const s = SPOTS[l.id]
        if (!s) return null
        const isClosed = closed.includes(l.id)
        const isSelected = selected === l.id
        const [cx, cy] = s.c
        return (
          <g key={l.id}>
            <g
              role="button"
              tabIndex={isClosed ? -1 : 0}
              aria-label={`${l.name}${isClosed ? ' (fermé)' : ''}`}
              aria-pressed={isSelected}
              aria-disabled={isClosed}
              onClick={() => !isClosed && onSelect(l.id)}
              onKeyDown={keyHandler(l.id, !isClosed)}
              style={{ cursor: isClosed ? 'not-allowed' : 'pointer', outline: 'none' }}
            >
              <polygon
                points={s.poly}
                fill={isClosed ? 'rgba(0,0,0,0.6)' : isSelected ? 'rgba(251,191,36,0.22)' : 'rgba(255,255,255,0.001)'}
                stroke={isSelected ? '#fbbf24' : 'none'}
                strokeWidth="7"
                strokeLinejoin="round"
                filter={isSelected ? 'url(#glow)' : undefined}
                className={isSelected ? 'animate-pulse' : undefined}
              />
              {isClosed && (
                <>
                  <line x1={cx - 50} y1={cy - 50} x2={cx + 50} y2={cy + 50} stroke="#ef4444" strokeWidth="14" strokeLinecap="round" />
                  <line x1={cx + 50} y1={cy - 50} x2={cx - 50} y2={cy + 50} stroke="#ef4444" strokeWidth="14" strokeLinecap="round" />
                  <text x={cx} y={cy + 100} textAnchor="middle" fontSize="38" fontWeight="800" fill="#f87171" stroke="#0c0a09" strokeWidth="6" paintOrder="stroke">FERMÉ</text>
                </>
              )}
            </g>
            {/* bouton règles (n'effectue pas de choix) */}
            <g
              role="button"
              tabIndex={0}
              aria-label={`Lire les règles : ${l.name}`}
              onClick={(e) => { e.stopPropagation(); onInfo(l.id) }}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onInfo(l.id) } }}
              style={{ cursor: 'pointer', outline: 'none' }}
            >
              <circle cx={s.i[0]} cy={s.i[1]} r="30" fill="#1c1917" fillOpacity="0.85" stroke="#f59e0b" strokeWidth="3" />
              <text x={s.i[0]} y={s.i[1] + 11} textAnchor="middle" fontSize="32" fontWeight="700" fill="#fbbf24">i</text>
            </g>
          </g>
        )
      })}
    </svg>
  )
}
