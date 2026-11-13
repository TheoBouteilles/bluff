import type { KeyboardEvent } from 'react'
import { LOCATIONS } from '../data/locations'
import { VILLAGE_SIZE, VILLAGE_SPOTS } from '../data/villageSpots'

type Props = {
  selected?: string
  closed?: string[]
  mode?: 'day' | 'night'
  readonly?: boolean // carte décorative (ex. rapport d'aube) : pas de clic, pas de bouton règles
  onSelect?: (locationId: string) => void
  onInfo?: (locationId: string) => void
  marks?: Record<string, { count: number; validated: boolean }> // alliés Saboteurs par lieu (plein = validé, pâle = indécis)
}

// Carte du village en pixel art (public/px/village/<mode>_<frame>.png, 144 x 204 agrandie x6).
// Deux images alternent pour animer flammes, fenêtres et fontaine. Zones cliquables : src/data/villageSpots.ts (généré).
export default function VillageMap({ selected, closed = [], mode = 'night', readonly = false, onSelect, onInfo, marks = {} }: Props) {
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
      <image href={`/px/village/${mode}_0.png`} x="0" y="0" width={VW} height={VH} style={{ imageRendering: 'pixelated' }} />
      <image href={`/px/village/${mode}_1.png`} x="0" y="0" width={VW} height={VH} className="village-flicker" style={{ imageRendering: 'pixelated' }} />

      {/* Assombrit le reste du village quand un lieu est choisi */}
      {selected && <rect width={VW} height={VH} fill="rgba(5,8,14,0.45)" pointerEvents="none" />}

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
              {/* le lieu choisi est « découpé » dans le voile sombre */}
              {isSelected && <image href={`/px/village/${mode}_0.png`} x="0" y="0" width={VW} height={VH} clipPath={`url(#clip-${l.id})`} style={{ imageRendering: 'pixelated' }} />}
              <clipPath id={`clip-${l.id}`}><polygon points={s.poly} /></clipPath>
              <polygon
                points={s.poly}
                fill={isClosed ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.001)'}
                stroke={isSelected ? '#e6c25a' : 'none'}
                strokeWidth="6"
                strokeDasharray={isSelected ? '24 12' : undefined}
                className={isSelected ? 'village-march' : undefined}
              />
              {isSelected && (
                <text x={cx} y={Number(s.poly.split(' ')[0].split(',')[1]) + 4} textAnchor="middle" fontSize="54" fill="#e6c25a" stroke="#1b1410" strokeWidth="8" paintOrder="stroke" className="village-arrow" fontFamily="Silkscreen, monospace">▼</text>
              )}
              {isClosed && (
                <>
                  <line x1={cx - 50} y1={cy - 50} x2={cx + 50} y2={cy + 50} stroke="#a84a44" strokeWidth="18" />
                  <line x1={cx + 50} y1={cy - 50} x2={cx - 50} y2={cy + 50} stroke="#a84a44" strokeWidth="18" />
                  <text x={cx} y={cy + 100} textAnchor="middle" fontSize="36" fill="#f0b4ae" stroke="#1b1410" strokeWidth="8" paintOrder="stroke" fontFamily="Silkscreen, monospace">FERMÉ</text>
                </>
              )}
            </g>

            {/* étiquette */}
            <g pointerEvents="none">
              <rect x={lx - lw / 2} y={ly - 28} width={lw} height={40} fill={isSelected ? '#e6c25a' : '#f1e6cc'} stroke="#1b1410" strokeWidth="5" />
              <text x={lx} y={ly + 2} textAnchor="middle" fontSize="26" fill="#1b1410" fontFamily="Silkscreen, monospace">{label.toUpperCase()}</text>
            </g>

            {marks[l.id] && (
              <g pointerEvents="none">
                <rect x={cx - 34} y={cy - 104} width="68" height="68" fill="#6e2b27" fillOpacity={marks[l.id].validated ? 0.95 : 0.6} stroke="#e8847c" strokeWidth="5" strokeDasharray={marks[l.id].validated ? undefined : '12 8'} />
                <text x={cx} y={cy - 56} textAnchor="middle" fontSize="38" opacity={marks[l.id].validated ? 1 : 0.65}>💀</text>
                {marks[l.id].count > 1 && <text x={cx + 44} y={cy - 92} textAnchor="middle" fontSize="30" fill="#f0b4ae" stroke="#1b1410" strokeWidth="6" paintOrder="stroke" fontFamily="Silkscreen, monospace">×{marks[l.id].count}</text>}
              </g>
            )}

            {/* bouton règles (n'effectue pas de choix) */}
            {!readonly && onInfo && (
              <g
                role="button"
                tabIndex={0}
                aria-label={`Lire les règles : ${l.name}`}
                onClick={(e) => { e.stopPropagation(); onInfo(l.id) }}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onInfo(l.id) } }}
                style={{ cursor: 'pointer', outline: 'none' }}
              >
                <rect x={s.i[0] - 24} y={s.i[1] - 24} width="48" height="48" fill="#182230" stroke="#1b1410" strokeWidth="5" />
                <rect x={s.i[0] - 19} y={s.i[1] - 19} width="38" height="38" fill="none" stroke="#e6c25a" strokeWidth="3" />
                <text x={s.i[0]} y={s.i[1] + 11} textAnchor="middle" fontSize="30" fill="#e6c25a" fontFamily="Silkscreen, monospace">i</text>
              </g>
            )}
          </g>
        )
      })}
    </svg>
  )
}
