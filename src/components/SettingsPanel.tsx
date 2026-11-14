import { Minus, Plus } from 'lucide-react'
import { SETTING_GROUPS } from '../data/settings'
import type { SettingDef } from '../data/settings'

type Props = {
  settings: Record<string, number>
  editable: boolean
  onChange: (key: string, value: number) => void
  onReset: () => void
}

const stepBtn =
  'flex h-8 w-8 items-center justify-center border-2 border-night-3 bg-night text-paper transition hover:border-gold disabled:opacity-30 disabled:cursor-not-allowed'

function Row({ def, value, editable, onChange }: { def: SettingDef; value: number; editable: boolean; onChange: (v: number) => void }) {
  const step = def.step ?? 1
  const shown = def.format ? def.format(value) : `${value}${def.unit ?? ''}`
  const changed = value !== def.default
  return (
    <li className="flex items-center justify-between gap-3 py-2">
      <div className="min-w-0">
        <p className="font-sans text-sm text-paper">
          {def.label}
          {changed && <span className="ml-1 text-gold" title="Modifié">•</span>}
        </p>
        {def.hint && <p className="font-sans text-[11px] leading-snug text-mist-d">{def.hint}</p>}
      </div>
      {editable ? (
        <div className="flex shrink-0 items-center gap-1.5">
          <button type="button" className={stepBtn} disabled={value <= def.min} onClick={() => onChange(Math.max(def.min, value - step))} aria-label={`Diminuer ${def.label}`}>
            <Minus size={14} />
          </button>
          <span className={`w-16 text-center font-display text-lg ${changed ? 'text-gold' : 'text-paper'}`}>{shown}</span>
          <button type="button" className={stepBtn} disabled={value >= def.max} onClick={() => onChange(Math.min(def.max, value + step))} aria-label={`Augmenter ${def.label}`}>
            <Plus size={14} />
          </button>
        </div>
      ) : (
        <span className={`shrink-0 font-display text-lg ${changed ? 'text-gold' : 'text-paper'}`}>{shown}</span>
      )}
    </li>
  )
}

// Réglages rangés par section repliable ; un réglage qui ne s'applique pas (option coupée) est masqué
export default function SettingsPanel({ settings, editable, onChange, onReset }: Props) {
  const val = (key: string) => settings[key] ?? SETTING_GROUPS.flatMap((g) => g.settings).find((d) => d.key === key)?.default ?? 0
  const changedIn = (defs: SettingDef[]) => defs.filter((d) => val(d.key) !== d.default).length
  const totalChanged = SETTING_GROUPS.reduce((n, g) => n + changedIn(g.settings), 0)

  return (
    <details className="px-frame p-4">
      <summary className="flex cursor-pointer items-center justify-between gap-2">
        <span className="font-display text-xl font-bold uppercase tracking-wider text-paper">Réglages de la partie</span>
        <span className="font-pixel text-[10px] uppercase tracking-wider text-mist-d">
          {totalChanged > 0 ? `${totalChanged} modifié${totalChanged > 1 ? 's' : ''}` : 'Par défaut'}
          {!editable && ' · choisis par l’hôte'}
        </span>
      </summary>

      <div className="mt-3 flex flex-col gap-2">
        {SETTING_GROUPS.map((g) => {
          const visible = g.settings.filter((d) => !d.showIf || d.showIf(val))
          const n = changedIn(g.settings)
          return (
            <details key={g.title} className="group border-2 border-night-3 bg-night">
              <summary className="flex cursor-pointer items-center justify-between gap-2 px-3 py-2">
                <span className="font-pixel text-[12px] uppercase tracking-wide text-sand">
                  <span className="mr-2 inline-block transition-transform group-open:rotate-90">▸</span>{g.title}
                </span>
                {n > 0 && <span className="font-pixel text-[10px] uppercase text-gold">{n} modifié{n > 1 ? 's' : ''}</span>}
              </summary>
              <ul className="divide-y-2 divide-dashed divide-night-3 px-3 pb-2">
                {visible.map((def) => (
                  <Row key={def.key} def={def} value={val(def.key)} editable={editable} onChange={(v) => onChange(def.key, v)} />
                ))}
              </ul>
            </details>
          )
        })}
        {editable && totalChanged > 0 && (
          <button type="button" onClick={onReset} className="mt-1 font-pixel text-[11px] uppercase tracking-wide text-mist-d underline decoration-2 underline-offset-4 hover:text-paper">
            Rétablir les valeurs par défaut
          </button>
        )}
      </div>
    </details>
  )
}
