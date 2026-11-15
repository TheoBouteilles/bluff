import type { ReactNode } from 'react'
import { Px } from './Px'
import type { GameLocation } from '../data/locations'
import { VILLAGE_SPOTS } from '../data/villageSpots'

type Props = {
  loc: GameLocation
  mode?: 'day' | 'night'
  validated?: boolean
  children?: ReactNode // actions possibles
}

// Vignette : le bâtiment découpé dans la carte du village (repère x4 de villageSpots)
function Vignette({ id, mode }: { id: string; mode: 'day' | 'night' }) {
  const spot = VILLAGE_SPOTS[id]
  if (!spot) return null
  const pts = spot.poly.split(' ').map((p) => p.split(',').map(Number))
  const xs = pts.map((p) => p[0])
  const ys = pts.map((p) => p[1])
  const x0 = Math.min(...xs), y0 = Math.min(...ys)
  const w = Math.max(...xs) - x0, h = Math.max(...ys) - y0
  return (
    <svg viewBox={`${x0} ${y0} ${w} ${h}`} preserveAspectRatio="xMidYMid meet" className="block h-40 w-full" aria-hidden>
      <image href={`/px/village2/base_${mode}.png`} x="0" y="0" width="864" height="1224" style={{ imageRendering: 'pixelated' }} />
    </svg>
  )
}

// Fiche lieu façon ticket papier rétro (même famille que les cartes de rôle)
export default function LocationCard({ loc, mode = 'night', validated = false, children }: Props) {
  return (
    <div className="animate-pop" style={{ filter: 'drop-shadow(4px 4px 0 var(--color-ink))' }}>
      <div className="px-ticket border-3 border-ink bg-paper text-ink" style={{ ['--notch-y' as string]: '202px' }}>
        <div className="flex items-center justify-between gap-3 border-b-3 border-ink bg-ink px-4 py-2 text-paper">
          <p className="flex items-center gap-2 font-pixel text-[11px] uppercase tracking-[0.2em]">
            <Px name={mode === 'night' ? 'moon' : 'sun'} scale={1} /> Fiche lieu
          </p>
          <span className={`border-2 px-2 py-0.5 font-pixel text-[10px] uppercase tracking-wider ${loc.visibleCrossing ? 'border-gold text-gold' : 'border-mist-d text-mist'}`}>
            {loc.visibleCrossing ? 'Lieu visible' : 'Lieu discret'}
          </span>
        </div>

        <div className="relative border-b-3 border-ink bg-night">
          <Vignette id={loc.id} mode={mode} />
          {validated && (
            <span className="absolute right-3 bottom-2 flex rotate-[-6deg] items-center gap-1.5 border-3 border-moss bg-paper px-2 py-1 font-pixel text-[12px] uppercase tracking-wider text-moss">
              <Px name="check" scale={2} /> Validé
            </span>
          )}
        </div>

        <div className="flex items-start gap-3 px-4 pt-4 pb-3">
          <loc.icon className="mt-1 shrink-0 text-sea" size={26} strokeWidth={2.5} />
          <div>
            <h2 className="font-display text-3xl font-bold leading-none">{loc.name}</h2>
            <p className="mt-2 font-sans text-sm italic text-ink/60">{loc.description}</p>
            <p className="mt-1 font-sans text-xs text-ink/60">
              {loc.visibleCrossing ? 'Tu verras qui s’y trouve, et ils te verront.' : 'Personne ne te voit, et tu ne vois personne.'}
            </p>
          </div>
        </div>

        {children && (
          <>
            <div className="mx-4 border-t-2 border-dashed border-ink/25" />
            <div className="px-4 py-4">
              <p className="mb-2 font-pixel text-[11px] uppercase tracking-wider text-sea">Actions possibles</p>
              <div className={validated ? 'pointer-events-none opacity-60' : ''}>{children}</div>
            </div>
          </>
        )}

        <details key={loc.id} className="group border-t-3 border-ink bg-paper-2">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 font-pixel text-[11px] uppercase tracking-wide text-ink [&::-webkit-details-marker]:hidden">
            <span>Règles : {loc.name}</span>
            <span className="text-sea transition-transform group-open:rotate-90">▸</span>
          </summary>
          <ul className="list-disc space-y-1 border-t-2 border-dashed border-ink/25 px-4 py-3 pl-8 font-sans text-sm text-ink/80">
            {loc.rules().map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </details>
      </div>
    </div>
  )
}
