import type { KeyboardEvent } from 'react'
import { LOCATIONS } from '../data/locations'

type Props = {
  selected?: string
  closed: string[]
  onSelect: (locationId: string) => void
  onInfo: (locationId: string) => void
}

type Spot = { x: number; y: number; body: string; roof: string; emoji: string }

// Position et couleurs de chaque bâtiment sur la carte (viewBox 360 x 450)
const SPOTS: Record<string, Spot> = {
  mairie: { x: 180, y: 78, body: '#d6d3d1', roof: '#92400e', emoji: '🏛' },
  casino: { x: 72, y: 188, body: '#7c2d12', roof: '#f59e0b', emoji: '🎰' },
  taverne: { x: 288, y: 188, body: '#78350f', roof: '#b45309', emoji: '🍺' },
  poste_garde: { x: 72, y: 318, body: '#44403c', roof: '#1e3a8a', emoji: '👁' },
  planque: { x: 288, y: 318, body: '#1c1917', roof: '#7f1d1d', emoji: '💀' },
  maison: { x: 180, y: 392, body: '#57534e', roof: '#78350f', emoji: '🏠' },
}

const CENTER = { x: 180, y: 252 }
const TREES = [
  [20, 60], [338, 70], [26, 252], [334, 252], [22, 410], [340, 420], [120, 150], [244, 150], [118, 340], [246, 345],
]

export default function VillageMap({ selected, closed, onSelect, onInfo }: Props) {
  const keyHandler = (id: string, enabled: boolean) => (e: KeyboardEvent) => {
    if (enabled && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault()
      onSelect(id)
    }
  }

  return (
    <svg
      viewBox="0 0 360 462"
      className="w-full select-none rounded-2xl border border-amber-800/40 bg-stone-950"
      role="group"
      aria-label="Carte du village : choisis où passer la nuit"
    >
      <defs>
        <radialGradient id="ground" cx="50%" cy="55%" r="70%">
          <stop offset="0%" stopColor="#292524" />
          <stop offset="100%" stopColor="#0c0a09" />
        </radialGradient>
      </defs>
      <rect width="360" height="462" fill="url(#ground)" />

      {/* Chemins */}
      {Object.values(SPOTS).map((s, i) => (
        <line
          key={i}
          x1={CENTER.x}
          y1={CENTER.y}
          x2={s.x}
          y2={s.y}
          stroke="#78350f"
          strokeOpacity="0.55"
          strokeWidth="10"
          strokeLinecap="round"
        />
      ))}

      {/* Arbres */}
      {TREES.map(([x, y], i) => (
        <g key={i} opacity="0.7">
          <circle cx={x} cy={y} r="13" fill="#14532d" />
          <circle cx={x - 4} cy={y - 4} r="7" fill="#166534" />
        </g>
      ))}

      {/* Fontaine */}
      <circle cx={CENTER.x} cy={CENTER.y} r="26" fill="#1c1917" stroke="#b45309" strokeWidth="3" />
      <circle cx={CENTER.x} cy={CENTER.y} r="16" fill="#0c4a6e" />
      <text x={CENTER.x} y={CENTER.y + 6} textAnchor="middle" fontSize="16">⛲</text>

      {/* Bâtiments */}
      {LOCATIONS.map((l) => {
        const s = SPOTS[l.id]
        if (!s) return null
        const isClosed = closed.includes(l.id)
        const isSelected = selected === l.id
        return (
          <g key={l.id} transform={`translate(${s.x} ${s.y})`}>
            <g
              role="button"
              tabIndex={isClosed ? -1 : 0}
              aria-label={`${l.name}${isClosed ? ' (fermé)' : ''}`}
              aria-pressed={isSelected}
              aria-disabled={isClosed}
              onClick={() => !isClosed && onSelect(l.id)}
              onKeyDown={keyHandler(l.id, !isClosed)}
              style={{ cursor: isClosed ? 'not-allowed' : 'pointer', outline: 'none' }}
              opacity={isClosed ? 0.45 : 1}
            >
              {isSelected && (
                <rect
                  x="-46" y="-52" width="92" height="106" rx="14"
                  fill="rgba(245,158,11,0.12)" stroke="#f59e0b" strokeWidth="3"
                  className="animate-pulse"
                />
              )}
              {/* corps */}
              <rect x="-32" y="-14" width="64" height="40" rx="3" fill={s.body} stroke="#0c0a09" strokeWidth="2" />
              {/* toit */}
              <polygon points="-38,-14 0,-44 38,-14" fill={s.roof} stroke="#0c0a09" strokeWidth="2" />
              {/* porte et fenêtres */}
              <rect x="-6" y="8" width="12" height="18" rx="2" fill="#0c0a09" />
              <rect x="-25" y="-6" width="11" height="11" rx="2" fill="#fde68a" fillOpacity="0.85" />
              <rect x="14" y="-6" width="11" height="11" rx="2" fill="#fde68a" fillOpacity="0.85" />
              <text x="0" y="-20" textAnchor="middle" fontSize="17">{s.emoji}</text>
              {/* nom */}
              <text x="0" y="46" textAnchor="middle" fontSize="12" fontWeight="700" fill="#fef3c7">{l.name}</text>
              {/* hit area */}
              <rect x="-46" y="-52" width="92" height="106" fill="transparent" />
              {isClosed && (
                <>
                  <line x1="-30" y1="-30" x2="30" y2="30" stroke="#ef4444" strokeWidth="5" strokeLinecap="round" />
                  <line x1="30" y1="-30" x2="-30" y2="30" stroke="#ef4444" strokeWidth="5" strokeLinecap="round" />
                </>
              )}
            </g>
            {isClosed && (
              <text x="0" y="60" textAnchor="middle" fontSize="10" fontWeight="700" fill="#f87171">FERMÉ</text>
            )}
            {/* bouton règles (n'effectue pas de choix) */}
            <g
              role="button"
              tabIndex={0}
              aria-label={`Lire les règles : ${l.name}`}
              onClick={(e) => { e.stopPropagation(); onInfo(l.id) }}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onInfo(l.id) } }}
              style={{ cursor: 'pointer', outline: 'none' }}
            >
              <circle cx="40" cy="-42" r="13" fill="#1c1917" stroke="#f59e0b" strokeWidth="1.5" />
              <text x="40" y="-37" textAnchor="middle" fontSize="13" fontWeight="700" fill="#fbbf24">i</text>
            </g>
          </g>
        )
      })}
    </svg>
  )
}
