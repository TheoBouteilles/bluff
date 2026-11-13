import type { KeyboardEvent } from 'react'
import { LOCATIONS } from '../data/locations'
import { VILLAGE_SIZE, VILLAGE_SPOTS } from '../data/villageSpots'
import VillageLife from './VillageLife'

type Props = {
  selected?: string
  closed?: string[]
  mode?: 'day' | 'night'
  readonly?: boolean // carte décorative (ex. rapport d'aube) : pas de clic
  onSelect?: (locationId: string) => void
  marks?: Record<string, { count: number; validated: boolean }> // alliés Saboteurs par lieu (plein = validé, pâle = indécis)
}

// Carte du village en pixel art : décor fixe public/px/village2/base_<mode>.png (216 x 306 agrandie x4)
// + couche vivante (VillageLife). Zones cliquables : src/data/villageSpots.ts (généré par tools/px/village2.py).
export default function VillageMap({ selected, closed = [], mode = 'night', readonly = false, onSelect, marks = {} }: Props) {
  const { w: VW, h: VH } = VILLAGE_SIZE
  const keyHandler = (id: string, enabled: boolean) => (e: KeyboardEvent) => {
    if (enabled && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault()
      onSelect?.(id)
    }
  }
  const short: Record<string, string> = { poste_garde: 'Tour de guet', maison: 'Chez soi' }

  return (
    <svg
      viewBox={`0 0 ${VW} ${VH}`}
      className="px-frame w-full select-none !p-0"
      style={{ imageRendering: 'pixelated' }}
      role="group"
      aria-label={readonly ? 'Carte du village' : 'Carte du village : choisis où passer la nuit'}
      shapeRendering="crispEdges"
    >
      <image href={`/px/village2/base_${mode}.png`} x="0" y="0" width={VW} height={VH} style={{ imageRendering: 'pixelated' }} />
      <VillageLife mode={mode} />

      {/* Assombrit le reste du village quand un lieu est choisi (le lieu reste éclairé grâce au masque) */}
      {selected && VILLAGE_SPOTS[selected] && (
        <>
          <mask id="vm-sel">
            <rect width={VW} height={VH} fill="white" />
            <polygon points={VILLAGE_SPOTS[selected].poly} fill="black" />
          </mask>
          <rect width={VW} height={VH} fill="rgba(5,8,14,0.5)" mask="url(#vm-sel)" pointerEvents="none" />
        </>
      )}

      {LOCATIONS.map((l) => {
        const s = VILLAGE_SPOTS[l.id]
        if (!s) return null
        const isClosed = closed.includes(l.id)
        const isSelected = selected === l.id
        const interactive = !readonly && !isClosed
        const [cx, cy] = s.c
        const [lx, ly] = s.l
        const label = short[l.id] ?? l.name
        const lw = label.length * 19 + 28
        return (
          <g key={l.id}>
            <g
              role={readonly ? undefined : 'button'}
              tabIndex={interactive ? 0 : -1}
              aria-label={readonly ? undefined : `${l.name}${isClosed ? ' (fermé)' : ''}`}
              aria-pressed={readonly ? undefined : isSelected}
              aria-disabled={readonly ? undefined : isClosed}
              onClick={() => interactive && onSelect?.(l.id)}
              onKeyDown={keyHandler(l.id, interactive)}
              style={{ cursor: readonly ? 'default' : isClosed ? 'not-allowed' : 'pointer', outline: 'none' }}
            >
              <polygon
                points={s.poly}
                fill={isClosed ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.001)'}
                stroke={isSelected ? '#e6c25a' : 'none'}
                strokeWidth="6"
                strokeDasharray={isSelected ? '24 12' : undefined}
                className={isSelected ? 'village-march' : undefined}
              />
              {isSelected && (
                <text x={cx} y={Number(s.poly.split(' ')[0].split(',')[1]) + 4} textAnchor="middle" fontSize="54" fill="#e6c25a" stroke="#1b1410" strokeWidth="8" paintOrder="stroke" className="village-arrow" fontFamily="'Bluff Pixel', monospace">▼</text>
              )}
              {isClosed && (
                <>
                  <line x1={cx - 50} y1={cy - 50} x2={cx + 50} y2={cy + 50} stroke="#a84a44" strokeWidth="18" />
                  <line x1={cx + 50} y1={cy - 50} x2={cx - 50} y2={cy + 50} stroke="#a84a44" strokeWidth="18" />
                  <text x={cx} y={cy + 100} textAnchor="middle" fontSize="36" fill="#f0b4ae" stroke="#1b1410" strokeWidth="8" paintOrder="stroke" fontFamily="'Bluff Pixel', monospace">FERMÉ</text>
                </>
              )}
            </g>

            {/* étiquette */}
            <g pointerEvents="none">
              <rect x={lx - lw / 2} y={ly - 28} width={lw} height={40} fill={isSelected ? '#e6c25a' : '#f1e6cc'} stroke="#1b1410" strokeWidth="5" />
              <text x={lx} y={ly + 2} textAnchor="middle" fontSize="26" fill="#1b1410" fontFamily="'Bluff Pixel', monospace">{label.toUpperCase()}</text>
            </g>

            {marks[l.id] && (
              <g pointerEvents="none">
                <rect x={cx - 34} y={cy - 104} width="68" height="68" fill="#6e2b27" fillOpacity={marks[l.id].validated ? 0.95 : 0.6} stroke="#e8847c" strokeWidth="5" strokeDasharray={marks[l.id].validated ? undefined : '12 8'} />
                <text x={cx} y={cy - 56} textAnchor="middle" fontSize="38" opacity={marks[l.id].validated ? 1 : 0.65}>💀</text>
                {marks[l.id].count > 1 && <text x={cx + 44} y={cy - 92} textAnchor="middle" fontSize="30" fill="#f0b4ae" stroke="#1b1410" strokeWidth="6" paintOrder="stroke" fontFamily="'Bluff Pixel', monospace">×{marks[l.id].count}</text>}
              </g>
            )}

          </g>
        )
      })}
    </svg>
  )
}
