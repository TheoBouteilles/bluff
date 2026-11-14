/*
 * Audio de Bluff : tout est synthétisé avec la Web Audio API (chiptune 8 bits).
 * Aucun fichier, aucune licence. Réglages par appareil (localStorage).
 *
 * Règle de jeu : un son ne doit jamais trahir une action secrète. Toutes les actions de nuit
 * utilisent le même son « validate » ; seuls les événements publics ont leurs propres sons.
 */

export type AudioSettings = { music: boolean; musicVol: number; sfx: boolean; sfxVol: number; vibrate: boolean }
export type Sfx = 'tap' | 'validate' | 'cancel' | 'error' | 'reveal' | 'night' | 'dawn' | 'death' | 'vote' | 'runoff' | 'eliminate' | 'nobody' | 'trophy'
export type Theme = 'lobby' | 'night' | 'day' | 'vote' | 'win_villageois' | 'win_saboteurs'

const KEY = 'bluff:audio'
// Musique coupée par défaut : autour d'une table, un seul téléphone devrait la jouer
const DEFAULTS: AudioSettings = { music: false, musicVol: 0.5, sfx: true, sfxVol: 0.7, vibrate: true }

function loadSettings(): AudioSettings {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS }
  } catch {
    return { ...DEFAULTS }
  }
}

let settings = loadSettings()
const listeners = new Set<() => void>()

export const getAudioSettings = () => settings
export function subscribeAudio(fn: () => void) {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}
export function setAudioSettings(patch: Partial<AudioSettings>) {
  settings = { ...settings, ...patch }
  try { localStorage.setItem(KEY, JSON.stringify(settings)) } catch { /* stockage indisponible */ }
  applyVolumes()
  if (settings.music) startMusic()
  else stopMusic()
  listeners.forEach((fn) => fn())
}

// ---------------------------------------------------------------------------
// Contexte audio (créé au premier geste de l'utilisateur, règle des navigateurs mobiles)
// ---------------------------------------------------------------------------
let ctx: AudioContext | null = null
let sfxBus: GainNode
let musicBus: GainNode
let noiseBuf: AudioBuffer

function ensure(): AudioContext | null {
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return null
    ctx = new AC()
    sfxBus = ctx.createGain()
    musicBus = ctx.createGain()
    sfxBus.connect(ctx.destination)
    musicBus.connect(ctx.destination)
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
    const d = noiseBuf.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
    applyVolumes()
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => undefined)
  return ctx
}

function applyVolumes() {
  if (!ctx) return
  sfxBus.gain.value = settings.sfx ? settings.sfxVol * 0.6 : 0
  musicBus.gain.value = settings.music ? settings.musicVol * 0.35 : 0
}

// Appelé à chaque appui (main.tsx) : débloque l'audio et relance la musique voulue
export function unlockAudio() {
  if (!ensure()) return
  if (settings.music && !timer) startMusic()
}

// ---------------------------------------------------------------------------
// Briques de synthèse
// ---------------------------------------------------------------------------
const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12)

type ToneOpts = { type?: OscillatorType; vol?: number; slideTo?: number; attack?: number; bus?: GainNode; vibrato?: number }
function tone(freq: number, start: number, dur: number, o: ToneOpts = {}) {
  if (!ctx) return
  const osc = ctx.createOscillator()
  const g = ctx.createGain()
  osc.type = o.type ?? 'square'
  osc.frequency.setValueAtTime(freq, start)
  if (o.slideTo) osc.frequency.exponentialRampToValueAtTime(o.slideTo, start + dur)
  if (o.vibrato) {
    const lfo = ctx.createOscillator()
    const lg = ctx.createGain()
    lfo.frequency.value = 6
    lg.gain.value = o.vibrato
    lfo.connect(lg).connect(osc.frequency)
    lfo.start(start)
    lfo.stop(start + dur + 0.05)
  }
  const vol = o.vol ?? 0.2
  const attack = o.attack ?? 0.005
  g.gain.setValueAtTime(0.0001, start)
  g.gain.exponentialRampToValueAtTime(vol, start + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur)
  osc.connect(g).connect(o.bus ?? sfxBus)
  osc.start(start)
  osc.stop(start + dur + 0.05)
}

type NoiseOpts = { vol?: number; filter?: BiquadFilterType; freq?: number; slideTo?: number; bus?: GainNode; attack?: number }
function noise(start: number, dur: number, o: NoiseOpts = {}) {
  if (!ctx) return
  const src = ctx.createBufferSource()
  src.buffer = noiseBuf
  src.loop = true
  const f = ctx.createBiquadFilter()
  f.type = o.filter ?? 'lowpass'
  f.frequency.setValueAtTime(o.freq ?? 1200, start)
  if (o.slideTo) f.frequency.exponentialRampToValueAtTime(o.slideTo, start + dur)
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, start)
  g.gain.exponentialRampToValueAtTime(o.vol ?? 0.2, start + (o.attack ?? 0.005))
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur)
  src.connect(f).connect(g).connect(o.bus ?? sfxBus)
  src.start(start)
  src.stop(start + dur + 0.05)
}

// Cloche : partiels inharmoniques à longue décroissance
function bell(freq: number, start: number, dur = 1.6, vol = 0.18, bus?: GainNode) {
  ;[1, 2.4, 3.9, 5.4].forEach((m, i) => tone(freq * m, start, dur / (1 + i * 0.6), { type: 'sine', vol: vol / (1 + i), bus }))
}

// ---------------------------------------------------------------------------
// Bruitages
// ---------------------------------------------------------------------------
const VIBRATIONS: Partial<Record<Sfx, number[]>> = {
  validate: [25], cancel: [15], error: [70, 40, 70], death: [180, 90, 180], eliminate: [250], trophy: [30, 40, 30, 40, 60],
}

export function playSfx(name: Sfx) {
  if (settings.vibrate && VIBRATIONS[name] && 'vibrate' in navigator) {
    try { navigator.vibrate(VIBRATIONS[name]!) } catch { /* non supporté */ }
  }
  if (!settings.sfx) return
  const c = ensure()
  if (!c) return
  const t = c.currentTime + 0.01
  switch (name) {
    case 'tap':
      tone(1046, t, 0.035, { vol: 0.05 })
      break
    case 'validate':
      ;[76, 79, 84].forEach((n, i) => tone(hz(n), t + i * 0.07, 0.12, { vol: 0.12 }))
      break
    case 'cancel':
      tone(660, t, 0.14, { vol: 0.1, slideTo: 330 })
      break
    case 'error':
      tone(150, t, 0.12, { vol: 0.15 })
      tone(150, t + 0.16, 0.16, { vol: 0.15 })
      break
    case 'reveal':
      noise(t, 0.4, { filter: 'bandpass', freq: 400, slideTo: 3000, vol: 0.12, attack: 0.15 })
      ;[60, 64, 67, 72].forEach((n) => tone(hz(n), t + 0.25, 0.7, { type: 'triangle', vol: 0.09, attack: 0.02 }))
      break
    case 'night':
      bell(hz(60), t, 2.2)
      tone(380, t + 0.9, 1.6, { type: 'triangle', vol: 0.12, slideTo: 620, attack: 0.25, vibrato: 12 })
      tone(620, t + 2.5, 0.8, { type: 'triangle', vol: 0.08, slideTo: 420, vibrato: 12 })
      break
    case 'dawn': {
      const seg: [number, number, number][] = [[600, 900, 0.12], [900, 750, 0.1], [750, 1150, 0.18], [1150, 820, 0.45]]
      let s = t
      for (const [a, b, d] of seg) { tone(a, s, d, { vol: 0.09, slideTo: b }); s += d * 0.9 }
      break
    }
    case 'death':
      ;[0, 1.1, 2.2].forEach((dt) => bell(hz(43), t + dt, 1.8, 0.22))
      break
    case 'vote':
      for (let i = 0; i < 10; i++) noise(t + i * 0.09 * (1 - i * 0.04), 0.06, { freq: 900, vol: 0.12 + i * 0.01 })
      tone(90, t + 0.8, 0.35, { type: 'sine', vol: 0.3, slideTo: 45 })
      break
    case 'runoff':
      tone(110, t, 2.4, { type: 'sine', vol: 0.25 })
      tone(110 * 1.37, t, 1.8, { type: 'sine', vol: 0.12 })
      tone(110 * 2.71, t, 1.2, { type: 'sine', vol: 0.06 })
      noise(t, 0.5, { freq: 600, vol: 0.12 })
      break
    case 'eliminate':
      for (let i = 0; i < 14; i++) noise(t + i * 0.06, 0.05, { freq: 800, vol: 0.1 + i * 0.008 })
      noise(t + 0.9, 0.3, { freq: 300, vol: 0.35 })
      tone(320, t + 0.9, 0.6, { vol: 0.12, slideTo: 50 })
      break
    case 'nobody':
      tone(hz(67), t, 0.15, { type: 'triangle', vol: 0.12 })
      tone(hz(62), t + 0.18, 0.3, { type: 'triangle', vol: 0.12 })
      break
    case 'trophy':
      ;[72, 76, 79, 84].forEach((n, i) => tone(hz(n), t + i * 0.08, 0.18, { vol: 0.1 }))
      ;[96, 100, 103].forEach((n, i) => tone(hz(n), t + 0.4 + i * 0.06, 0.25, { type: 'triangle', vol: 0.06 }))
      break
  }
}

// ---------------------------------------------------------------------------
// Musique : petit séquenceur (croches), une boucle par phase
// ---------------------------------------------------------------------------
type N = number | null
type Song = {
  bpm: number
  lead: N[]
  bass: N[]
  drums?: string // k = grosse caisse, s = caisse claire, h = charleston, - = rien
  leadType?: OscillatorType
  bassType?: OscillatorType
  leadVol?: number
  loop?: boolean
  ambience?: 'night' | 'day'
}

const _ = null
const SONGS: Record<Theme, Song> = {
  // Taverne enjouée (do majeur)
  lobby: {
    bpm: 132, leadType: 'square', bassType: 'triangle', leadVol: 0.07,
    lead: [67, 72, 76, 72, 74, 71, 67, 71, 72, 76, 79, 76, 77, 74, 71, 67,
           69, 72, 77, 72, 76, 72, 67, 72, 74, 71, 67, 71, 72, _, 72, _],
    bass: [48, _, 55, _, 43, _, 55, _, 48, _, 55, _, 43, _, 50, _,
           41, _, 53, _, 48, _, 55, _, 43, _, 50, _, 48, _, 48, _],
    drums: 'k-h-s-h-k-h-s-h-k-h-s-h-k-h-s-hk-h-s-h-k-h-s-h-k-h-s-h-k-s-s-s',
  },
  // Nuit mystérieuse (la mineur), grillons et hibou
  night: {
    bpm: 72, leadType: 'triangle', bassType: 'triangle', leadVol: 0.08, ambience: 'night',
    lead: [69, _, _, 72, _, _, 76, _, 74, _, _, 72, _, _, 71, _,
           69, _, _, 64, _, _, 67, _, 65, _, _, 64, _, _, _, _],
    bass: [45, _, _, _, _, _, _, _, 41, _, _, _, _, _, _, _,
           43, _, _, _, _, _, _, _, 40, _, _, _, _, _, _, _],
  },
  // Place du marché (fa majeur), légère tension
  day: {
    bpm: 108, leadType: 'square', bassType: 'triangle', leadVol: 0.06, ambience: 'day',
    lead: [72, _, 69, _, 70, 72, 74, _, 72, _, 69, _, 65, _, _, _,
           67, _, 70, _, 69, 67, 65, _, 64, _, 67, _, 65, _, _, _],
    bass: [41, _, 48, _, 41, _, 48, _, 46, _, 53, _, 46, _, 53, _,
           48, _, 55, _, 48, _, 55, _, 41, _, 48, _, 41, _, 41, _],
    drums: 'k---h---k---h---k---h---k-k-h---',
  },
  // Vote : ostinato en ré mineur, tambour
  vote: {
    bpm: 116, leadType: 'square', bassType: 'sawtooth', leadVol: 0.05,
    lead: [_, _, _, _, 74, _, 72, _, _, _, _, _, 69, _, 70, _,
           _, _, _, _, 74, _, 76, _, 77, _, 76, _, 74, _, _, _],
    bass: [38, 38, 41, 38, 38, 38, 43, 38, 38, 38, 41, 38, 36, 36, 37, 37,
           38, 38, 41, 38, 38, 38, 43, 38, 38, 38, 45, 38, 37, 37, 37, 37],
    drums: 'k-s-k-s-k-s-kkskk-s-k-s-k-s-ksss',
  },
  // Fanfare des Villageois (jouée une fois)
  win_villageois: {
    bpm: 140, leadType: 'square', bassType: 'triangle', leadVol: 0.09, loop: false,
    lead: [67, 67, 67, 72, _, _, 76, _, 79, _, 76, 79, 84, _, _, _],
    bass: [48, _, 48, _, 43, _, 48, _, 43, _, 48, _, 36, _, _, _],
    drums: 's-s-s-k---s---k-s-k-----',
  },
  // Thème sombre des Saboteurs (joué une fois)
  win_saboteurs: {
    bpm: 96, leadType: 'sawtooth', bassType: 'triangle', leadVol: 0.06, loop: false,
    lead: [62, _, 65, _, 69, _, 68, _, 65, _, 62, _, 61, _, _, _],
    bass: [38, _, _, _, 34, _, _, _, 33, _, _, _, 26, _, _, _],
    drums: 'k-------k-------k---k---k-------',
  },
}

let wanted: Theme | null = null
let playingTheme: Theme | null = null
let timer: ReturnType<typeof setInterval> | null = null
let step = 0
let nextTime = 0

export function setMusic(theme: Theme | null) {
  if (theme === wanted) return
  wanted = theme
  stopMusic()
  if (settings.music) startMusic()
}

function startMusic() {
  if (!wanted || !settings.music) return
  const c = ensure()
  if (!c || c.state !== 'running') return // sera relancée au prochain appui (unlockAudio)
  if (timer && playingTheme === wanted) return
  stopMusic()
  playingTheme = wanted
  step = 0
  nextTime = c.currentTime + 0.1
  timer = setInterval(schedule, 30)
}

function stopMusic() {
  if (timer) clearInterval(timer)
  timer = null
  playingTheme = null
}

function schedule() {
  if (!ctx || !playingTheme) return
  const song = SONGS[playingTheme]
  const len = Math.max(song.lead.length, song.bass.length)
  const dt = 60 / song.bpm / 2 // croche
  while (nextTime < ctx.currentTime + 0.15) {
    const i = step % len
    if (song.loop === false && step >= len) { stopMusic(); return }
    const l = song.lead[i]
    if (l != null) tone(hz(l), nextTime, dt * 0.9, { type: song.leadType, vol: song.leadVol ?? 0.07, bus: musicBus })
    const b = song.bass[i]
    if (b != null) tone(hz(b), nextTime, dt * (song.bassType === 'sawtooth' ? 0.6 : 1.6), { type: song.bassType, vol: 0.12, bus: musicBus })
    const d = song.drums?.[i % song.drums.length]
    if (d === 'k') tone(120, nextTime, 0.12, { type: 'sine', vol: 0.3, slideTo: 45, bus: musicBus })
    if (d === 's') noise(nextTime, 0.08, { freq: 2500, filter: 'highpass', vol: 0.08, bus: musicBus })
    if (d === 'h') noise(nextTime, 0.03, { freq: 7000, filter: 'highpass', vol: 0.03, bus: musicBus })
    if (song.ambience === 'night') nightAmbience(nextTime)
    if (song.ambience === 'day' && Math.random() < 0.02) birdChirp(nextTime)
    nextTime += dt
    step++
  }
}

function nightAmbience(t: number) {
  if (Math.random() < 0.18) { // grillons
    for (let k = 0; k < 3; k++) tone(4300 + Math.random() * 300, t + k * 0.045, 0.03, { type: 'sine', vol: 0.025, bus: musicBus })
  }
  if (Math.random() < 0.012) { // hibou
    tone(hz(64), t, 0.35, { type: 'sine', vol: 0.06, attack: 0.08, bus: musicBus })
    tone(hz(62), t + 0.45, 0.6, { type: 'sine', vol: 0.05, attack: 0.08, bus: musicBus })
  }
}

function birdChirp(t: number) {
  const f = 2200 + Math.random() * 1200
  tone(f, t, 0.06, { type: 'sine', vol: 0.03, slideTo: f * 1.4, bus: musicBus })
  tone(f * 1.1, t + 0.09, 0.08, { type: 'sine', vol: 0.03, slideTo: f * 0.9, bus: musicBus })
}
