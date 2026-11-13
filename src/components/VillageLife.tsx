import type { CSSProperties } from 'react'
import { VILLAGE_FX, VILLAGE_LIFE } from '../data/villageLife'
import type { LifeItem } from '../data/villageLife'

/*
 * Couche « vivante » de la carte : sprites en bandes d'images (eau, drapeaux, feuillage, animaux)
 * + effets en SVG (fumées, lucioles, feuilles au vent, ombres de nuages).
 * Tout est en CSS (index.css, classes vl-*) ; prefers-reduced-motion fige tout sur la 1re image.
 */
const SCALE = 4

function Strip({ it, mode }: { it: LifeItem; mode: 'day' | 'night' }) {
  const strip = (
    <svg x={0} y={0} width={it.w * SCALE} height={it.h * SCALE} viewBox={`0 0 ${it.w} ${it.h}`} overflow="hidden">
      <image
        href={`/px/village2/sprites/${it.sprite}_${mode}.png`}
        width={it.w * it.frames}
        height={it.h}
        className="vl-strip"
        style={{ ['--n' as string]: it.frames, ['--sw' as string]: `${-it.w * it.frames}px`, animationDuration: `${it.dur}ms`, imageRendering: 'pixelated' } as CSSProperties}
      />
    </svg>
  )
  const vars = {
    ['--dx' as string]: `${it.dx ?? 0}px`,
    ['--fw' as string]: `${it.w * SCALE}px`,
    ['--tx' as string]: `${it.tx ?? 0}px`,
    ['--ty' as string]: `${it.ty ?? 0}px`,
    animationDuration: `${it.period ?? 10000}ms`,
    animationDelay: `${it.delay ?? 0}ms`,
  } as CSSProperties
  if (!it.anim) return <g transform={`translate(${it.x} ${it.y})`}>{strip}</g>
  return (
    <g transform={`translate(${it.x} ${it.y})`}>
      <g className={`vl-${it.anim}`} style={vars}>
        <g className={it.anim === 'walk' ? 'vl-flip' : undefined} style={vars}>{strip}</g>
      </g>
    </g>
  )
}

export default function VillageLife({ mode }: { mode: 'day' | 'night' }) {
  const items = VILLAGE_LIFE.filter((it) => it.modes === 'both' || it.modes === mode)
  return (
    <g pointerEvents="none" aria-hidden="true">
      {mode === 'night' && (
        <>
          <defs>
            <radialGradient id="vl-glow">
              <stop offset="0%" stopColor="#ffc35a" stopOpacity="0.45" />
              <stop offset="55%" stopColor="#ff9a3a" stopOpacity="0.14" />
              <stop offset="100%" stopColor="#ff9a3a" stopOpacity="0" />
            </radialGradient>
          </defs>
          {VILLAGE_FX.glow.map(([x, y], i) => (
            <circle key={`g${i}`} cx={x} cy={y} r={70} fill="url(#vl-glow)" className="vl-glow" style={{ animationDelay: `${-i * 350}ms` }} />
          ))}
        </>
      )}
      {mode === 'day' && (
        <g className="vl-clouds">
          <ellipse cx={-200} cy={260} rx={170} ry={70} fill="rgba(20,40,10,0.13)" />
          <ellipse cx={-620} cy={820} rx={210} ry={80} fill="rgba(20,40,10,0.11)" />
        </g>
      )}
      {items.map((it, i) => <Strip key={i} it={it} mode={mode} />)}
      {/* fumées de cheminée, poussées par le vent */}
      {VILLAGE_FX.smoke.map(([x, y], i) =>
        [0, 1, 2, 3].map((k) => (
          <rect key={`s${i}-${k}`} x={x - 6} y={y - 6} width={12} height={12} className="vl-smoke" fill={mode === 'day' ? '#d9d4cc' : '#4a5468'} style={{ animationDelay: `${-k * 900 - i * 400}ms` }} />
        )),
      )}
      {mode === 'night' &&
        VILLAGE_FX.fireflies.map(([x, y], i) => (
          <rect key={`f${i}`} x={x} y={y} width={4} height={4} fill="#fff19a" className="vl-firefly" style={{ animationDelay: `${-i * 730}ms`, animationDuration: `${3200 + (i % 4) * 700}ms` }} />
        ))}
      {mode === 'day' &&
        VILLAGE_FX.leaves.map(([x, y], i) => (
          <rect key={`l${i}`} x={x - 20} y={y} width={8} height={4} fill={['#78b25a', '#c39a49', '#589648'][i % 3]} className="vl-leaf" style={{ animationDelay: `${-i * 4100}ms` }} />
        ))}
    </g>
  )
}
