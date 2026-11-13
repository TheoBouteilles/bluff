import { Minus, Plus } from 'lucide-react'
import { SETTING_GROUPS } from '../data/settings'
import type { SettingDef } from '../data/settings'
import { panelClass } from './ui'

type Props = {
  settings: Record<string, number>
  editable: boolean
  onChange: (key: string, value: number) => void
  onReset: () => void
}

const stepBtn =
  'flex h-8 w-8 items-center justify-center border border-night-3 bg-night text-paper transition hover:border-gold disabled:opacity-30 disabled:cursor-not-allowed'

function Row({ def, value, editable, onChange }: { def: SettingDef; value: number; editable: boolean; onChange: (v: number) => void }) {
  const step = def.step ?? 1
  const shown = def.format ? def.format(value) : `${value}${def.unit ?? ''}`
  const changed = value !== def.default
  return (
    <li className="flex items-center justify-between gap-3 py-1.5">
      <div className="min-w-0">
        <p className={changed ? 'text-paper' : 'text-paper'}>{def.label}</p>
        {def.hint && <p className="text-xs text-mist-d">{def.hint}</p>}
      </div>
      {editable ? (
        <div className="flex shrink-0 items-center gap-2">
          <button type="button" className={stepBtn} disabled={value <= def.min} onClick={() => onChange(Math.max(def.min, value - step))} aria-label={`Diminuer ${def.label}`}>
            <Minus size={14} />
          </button>
          <span className="w-14 text-center font-semibold text-gold">{shown}</span>
          <button type="button" className={stepBtn} disabled={value >= def.max} onClick={() => onChange(Math.min(def.max, value + step))} aria-label={`Augmenter ${def.label}`}>
            <Plus size={14} />
          </button>
        </div>
      ) : (
        <span className="shrink-0 font-semibold text-gold">{shown}</span>
      )}
    </li>
  )
}

export default function SettingsPanel({ settings, editable, onChange, onReset }: Props) {
  return (
    <details className={`${panelClass} p-4`}>
      <summary className="cursor-pointer text-lg font-bold text-paper">
        Réglages de la partie {!editable && <span className="text-sm font-normal text-mist-d">(choisis par l’hôte)</span>}
      </summary>
      <div className="mt-3 flex flex-col gap-4">
        {SETTING_GROUPS.map((g) => (
          <div key={g.title}>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-mist-d">{g.title}</h3>
            <ul className="mt-1 divide-y divide-night-3">
              {g.settings.map((def) => (
                <Row key={def.key} def={def} value={settings[def.key] ?? def.default} editable={editable} onChange={(v) => onChange(def.key, v)} />
              ))}
            </ul>
          </div>
        ))}
        {editable && (
          <button type="button" onClick={onReset} className="text-sm text-mist-d underline hover:text-paper">
            Rétablir les valeurs par défaut
          </button>
        )}
      </div>
    </details>
  )
}
