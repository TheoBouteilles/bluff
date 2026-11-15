import { useState } from 'react'
import type { ReactNode } from 'react'
import { useAudioSettings } from '../hooks/useAudio'
import { playSfx, setAudioSettings } from '../lib/audio'
import { Px } from './Px'
import { Label } from './ui'

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={`min-w-16 border-2 px-3 py-1.5 font-pixel text-[11px] uppercase tracking-wide ${
        on ? 'border-ink bg-paper text-ink' : 'border-night-3 bg-night text-mist-d'
      }`}
    >
      {on ? 'On' : 'Off'}
    </button>
  )
}

function Line({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b-2 border-dashed border-night-3 py-3 last:border-0">
      <div>
        <p className="font-pixel text-[12px] uppercase tracking-wide text-paper">{title}</p>
        {hint && <p className="font-sans text-[11px] text-mist-d">{hint}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    </div>
  )
}

function Volume({ value, onChange, disabled, label }: { value: number; onChange: (v: number) => void; disabled: boolean; label: string }) {
  return (
    <input
      type="range" min={0} max={1} step={0.05} value={value} disabled={disabled} aria-label={label}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-24 accent-gold disabled:opacity-30"
    />
  )
}

// Bouton « ♪ » qui ouvre les options son (réglages propres à cet appareil)
export default function SoundButton({ variant = 'icon' }: { variant?: 'icon' | 'link' }) {
  const [open, setOpen] = useState(false)
  const s = useAudioSettings()

  return (
    <>
      {variant === 'icon' ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Options son"
          title="Son"
          className="flex items-center justify-center border-2 border-night-3 bg-night p-1.5 hover:border-gold"
        >
          <Px name={s.music || s.sfx ? 'sound_on' : 'sound_off'} scale={2} />
        </button>
      ) : (
        <button type="button" onClick={() => setOpen(true)}
          className="inline-flex items-center justify-center gap-2 px-3 py-2 font-pixel text-[12px] uppercase tracking-wide text-sand underline decoration-2 underline-offset-4 hover:text-paper">
          <Px name={s.music || s.sfx ? 'sound_on' : 'sound_off'} scale={1} /> Son
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/70 p-4 sm:items-center" onClick={() => setOpen(false)}>
          <div className="px-frame w-full max-w-md p-4" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Options son">
            <div className="mb-1 flex items-center justify-between">
              <h2 className="font-display text-xl font-bold uppercase tracking-wider text-paper">Options son</h2>
              <button type="button" onClick={() => setOpen(false)} className="font-pixel text-[11px] uppercase text-mist hover:text-paper">Fermer ✕</button>
            </div>

            <Line title="Musique" hint="Ambiance de chaque phase">
              <Volume label="Volume de la musique" value={s.musicVol} disabled={!s.music} onChange={(v) => setAudioSettings({ musicVol: v })} />
              <Toggle label="Musique" on={s.music} onChange={(v) => setAudioSettings({ music: v })} />
            </Line>
            <Line title="Bruitages" hint="Sélections et événements">
              <Volume label="Volume des bruitages" value={s.sfxVol} disabled={!s.sfx} onChange={(v) => setAudioSettings({ sfxVol: v })} />
              <Toggle label="Bruitages" on={s.sfx} onChange={(v) => { setAudioSettings({ sfx: v }); if (v) playSfx('validate') }} />
            </Line>
            <Line title="Vibrations" hint="Sur les téléphones compatibles">
              <Toggle label="Vibrations" on={s.vibrate} onChange={(v) => { setAudioSettings({ vibrate: v }); if (v) playSfx('validate') }} />
            </Line>

            <Label className="mt-3 leading-relaxed">
              À table, active la musique sur un seul téléphone. Les actions secrètes de la nuit ont toutes le même son.
            </Label>
          </div>
        </div>
      )}
    </>
  )
}
