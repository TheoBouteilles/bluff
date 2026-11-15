import type { CSSProperties } from 'react'
import { ACCESSORIES, AVATARS, TUNICS } from '../data/avatars'
import type { Look } from '../data/avatars'

// Taille native (px) de chaque icône de public/px/icons
const ICON_SIZE: Record<string, [number, number]> = {
  coin: [12, 12], crown: [12, 8], ghost: [12, 12], moon: [12, 12], sun: [12, 12], skull: [12, 9], check: [12, 9], lock: [10, 9],
  team_villageois: [32, 32], team_saboteurs: [32, 32], team_solitaires: [32, 32],
  team_villageois_s: [12, 12], team_saboteurs_s: [12, 12], team_solitaires_s: [12, 12],
  sound_on: [12, 12], sound_off: [12, 12], book: [12, 10],
}

// Icône pixel art agrandie sans flou
export function Px({ name, scale = 2, className = '', title }: { name: string; scale?: number; className?: string; title?: string }) {
  const [w, h] = ICON_SIZE[name] ?? [12, 12]
  return <img src={`/px/icons/${name}.png`} width={w * scale} height={h * scale} alt={title ?? ''} title={title} className={`px-img inline-block shrink-0 ${className}`} draggable={false} />
}

type AvatarProps = {
  index: number
  look?: Look | null // tenue et accessoire du profil (calques public/px/looks)
  kind?: 'face' | 'body'
  scale?: number
  className?: string
  ring?: boolean
  animate?: boolean
  style?: CSSProperties
}

// Avatar : visage 16x16 (menus) ou bonhomme 16x24 animé (2 images, carte et listes), avec ses calques
export function Avatar({ index, look, kind = 'face', scale = 3, className = '', ring = false, animate = true, style }: AvatarProps) {
  const a = AVATARS[index] ?? AVATARS[0]
  const t = look?.t && TUNICS[look.t]?.color ? look.t : 0
  const acc = look?.a && look.a > 0 && look.a < ACCESSORIES.length ? look.a : 0
  if (kind === 'face') {
    const size = 16 * scale
    const base = <img src={`/px/avatars/${a.id}_face.png`} width={size} height={size} alt={a.name} className={`px-img block ${ring || acc ? '' : className}`} draggable={false} style={ring || acc ? undefined : style} />
    const img = acc ? (
      <span className={ring ? '' : className} style={{ position: 'relative', display: 'inline-block', width: size, height: size, verticalAlign: 'middle', ...(ring ? {} : style) }}>
        {base}
        <img src={`/px/looks/acc_${acc}_face.png`} width={size} height={size} alt="" className="px-img absolute top-0 left-0 block" draggable={false} />
      </span>
    ) : base
    if (!ring) return img
    return (
      <span className={`inline-flex items-center justify-center border-2 bg-night-3 ${className}`} style={{ borderColor: a.color, padding: scale, ...style }}>
        {img}
      </span>
    )
  }
  // Bande de 2 images : on fait défiler l'image dans une fenêtre de la taille d'une frame ; les calques suivent
  const strip = (src: string, layer = false) => (
    <img
      src={src}
      width={32 * scale}
      height={24 * scale}
      alt=""
      draggable={false}
      className={`px-img block max-w-none ${layer ? 'absolute top-0 left-0' : ''} ${animate ? 'animate-bob' : ''}`}
      style={style}
    />
  )
  return (
    <span role="img" aria-label={a.name} className={`relative inline-block shrink-0 overflow-hidden ${className}`} style={{ width: 16 * scale, height: 24 * scale }}>
      {strip(`/px/avatars/${a.id}_body.png`)}
      {t > 0 && strip(`/px/looks/tunic_${t}_body.png`, true)}
      {acc > 0 && strip(`/px/looks/acc_${acc}_body.png`, true)}
    </span>
  )
}
