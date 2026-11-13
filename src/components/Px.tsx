import type { CSSProperties } from 'react'
import { AVATARS } from '../data/avatars'

// Taille native (px) de chaque icône de public/px/icons
const ICON_SIZE: Record<string, [number, number]> = {
  coin: [12, 12], crown: [12, 8], ghost: [12, 12], moon: [12, 12], sun: [12, 12], skull: [12, 9], check: [12, 9], lock: [10, 9],
  team_villageois: [24, 24], team_saboteurs: [24, 24], team_solitaires: [24, 24],
}

// Icône pixel art agrandie sans flou
export function Px({ name, scale = 2, className = '', title }: { name: string; scale?: number; className?: string; title?: string }) {
  const [w, h] = ICON_SIZE[name] ?? [12, 12]
  return <img src={`/px/icons/${name}.png`} width={w * scale} height={h * scale} alt={title ?? ''} title={title} className={`px-img inline-block shrink-0 ${className}`} draggable={false} />
}

type AvatarProps = { index: number; kind?: 'face' | 'body'; scale?: number; className?: string; ring?: boolean; animate?: boolean; style?: CSSProperties }

// Avatar : visage 16x16 (menus) ou bonhomme 16x24 animé (2 images, carte et listes)
export function Avatar({ index, kind = 'face', scale = 3, className = '', ring = false, animate = true, style }: AvatarProps) {
  const a = AVATARS[index] ?? AVATARS[0]
  if (kind === 'face') {
    const img = <img src={`/px/avatars/${a.id}_face.png`} width={16 * scale} height={16 * scale} alt={a.name} className={`px-img block ${ring ? '' : className}`} draggable={false} style={ring ? undefined : style} />
    if (!ring) return img
    return (
      <span className={`inline-flex items-center justify-center border-2 bg-night-3 ${className}`} style={{ borderColor: a.color, padding: scale, ...style }}>
        {img}
      </span>
    )
  }
  // Bande de 2 images : on fait défiler l'image dans une fenêtre de la taille d'une frame
  return (
    <span role="img" aria-label={a.name} className={`inline-block shrink-0 overflow-hidden ${className}`} style={{ width: 16 * scale, height: 24 * scale }}>
      <img
        src={`/px/avatars/${a.id}_body.png`}
        width={32 * scale}
        height={24 * scale}
        alt=""
        draggable={false}
        className={`px-img block max-w-none ${animate ? 'animate-bob' : ''}`}
        style={style}
      />
    </span>
  )
}
