import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Px } from './Px'

/*
 * Système d'interface pixel art.
 * Les noms exportés (styles, inputClass, panelClass, Screen, Button, TokenBadge) sont conservés
 * pour que les écrans existants continuent de fonctionner sans modification.
 */

const base =
  'px-frame px-press inline-flex items-center justify-center gap-2 px-4 py-3 font-pixel text-[13px] uppercase tracking-wide text-center disabled:opacity-40 disabled:cursor-not-allowed'

export const styles = {
  primary: `${base} !bg-paper text-ink [box-shadow:inset_0_0_0_2px_#fff8e6,4px_4px_0_0_var(--color-ink)] hover:!bg-white`,
  secondary: `${base} text-paper hover:!bg-night-3`,
  danger: `${base} !bg-blood text-paper [box-shadow:inset_0_0_0_2px_#c9736b,4px_4px_0_0_var(--color-ink)]`,
  ghost: 'inline-flex items-center justify-center gap-2 px-3 py-2 font-pixel text-[12px] uppercase tracking-wide text-sand underline decoration-2 underline-offset-4 hover:text-paper disabled:opacity-40',
}

export const inputClass =
  'w-full px-inset bg-paper px-4 py-3 font-sans text-lg text-ink placeholder:text-ink/40 outline-none focus:[box-shadow:inset_3px_3px_0_0_rgb(0_0_0/0.35),0_0_0_3px_var(--color-gold)]'

export const panelClass = 'px-frame'

export function Screen({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-dvh flex flex-col items-center px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] px-scan">
      <div className="w-full max-w-md flex flex-col gap-4">{children}</div>
    </main>
  )
}

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof styles }) {
  return <button {...props} className={`${styles[variant]} ${className}`} />
}

// Barre de titre façon « ◂ RETOUR | TITRE »
export function TitleBar({ title, left, right }: { title: ReactNode; left?: ReactNode; right?: ReactNode }) {
  return (
    <div className="px-frame flex items-center gap-3 px-3 py-2">
      {left}
      <h1 className="font-display text-xl font-bold uppercase tracking-wider text-paper">{title}</h1>
      <span className="ml-auto flex items-center gap-2">{right}</span>
    </div>
  )
}

// Onglets : l'actif est en crème, les autres en nuit
export function Tabs<T extends string>({ value, items, onChange }: { value: T; items: { id: T; label: ReactNode }[]; onChange: (id: T) => void }) {
  return (
    <div className="px-frame flex gap-2 p-2" role="tablist">
      {items.map((it) => (
        <button
          key={it.id}
          role="tab"
          aria-selected={value === it.id}
          onClick={() => onChange(it.id)}
          className={`flex-1 border-2 px-2 py-2 font-pixel text-[11px] uppercase tracking-wide transition-colors ${
            value === it.id ? 'border-ink bg-paper text-ink' : 'border-night-3 bg-night text-mist hover:text-paper'
          }`}
        >
          {it.label}
        </button>
      ))}
    </div>
  )
}

// Petit titre de section en capitales pixel
export function Label({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <p className={`font-pixel text-[10px] uppercase tracking-[0.2em] text-mist-d ${className}`}>{children}</p>
}

// Jeton d'or ; la clé relance l'animation de brillance à chaque changement de valeur
export function TokenBadge({ count }: { count: number }) {
  return (
    <span key={count} className="inline-flex animate-shine items-center gap-1.5 border-2 border-ink bg-night px-2 py-0.5 font-display text-xl font-bold text-gold">
      <Px name="coin" scale={2} />
      {count}
    </span>
  )
}

// Encadré d'information (jaune) ou d'alerte (rouge)
export function Note({ tone = 'info', children }: { tone?: 'info' | 'danger' | 'ok'; children: ReactNode }) {
  const t = {
    info: 'border-gold bg-gold/10 text-gold',
    danger: 'border-blood bg-blood/15 text-[#f0b4ae]',
    ok: 'border-moss bg-moss/20 text-[#bfe9dc]',
  }[tone]
  return <div className={`border-2 px-3 py-2 font-sans text-sm ${t}`}>{children}</div>
}
