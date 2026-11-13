"""Couche de vie de la carte v2 : petites bandes d'images (sprites) + manifeste src/data/villageLife.ts.
Chaque sprite est rendu avec la palette de jour et de nuit : public/px/village2/sprites/<nom>_<day|night>.png"""
import math, json
from canvas import Canvas
from pal2 import K, COLOR_DAY, COLOR_NIGHT
from px import ROOT
import village2 as V
from PIL import Image

INK = K('ink')
S = 4
SPRITES = {}


def strip(name, frames):
    """frames : liste de Canvas de même taille -> enregistre la bande pour les deux palettes."""
    fw, fh = frames[0].w, frames[0].h
    SPRITES[name] = (fw, fh, len(frames), frames)


def outlined(c):
    c.outline(INK)
    return c


# ---------------------------------------------------------------- fontaine (l'eau coule, rien ne clignote)
def fountain():
    fr = []
    for f in range(4):
        c = Canvas(28, 30)
        cx, cy = 14, 22                      # centre du bassin dans la bande
        c.disc(cx, cy, 12, K('water', 1), 6); c.disc(cx, cy - 1, 11, K('water', 2), 5)
        # ondes qui s'élargissent
        for k in range(2):
            rr = 3 + ((f + k * 2) % 4) * 2.2
            for a in range(0, 360, 12):
                x = cx + rr * math.cos(math.radians(a)); y = cy + rr * 0.5 * math.sin(math.radians(a))
                c.set(int(round(x)), int(round(y)), K('water', 4 if k == 0 else 3))
        # socle et vasque
        c.rect(cx - 1, cy - 8, 3, 8, K('stone', 3)); c.vline(cx + 1, cy - 8, cy - 1, K('stone', 2)); c.vline(cx - 1, cy - 8, cy - 1, K('stone', 4))
        c.disc(cx, cy - 9, 4, K('stone', 3), 1); c.hline(cx - 4, cx + 4, cy - 10, K('stone', 4)); c.hline(cx - 3, cx + 3, cy - 8, K('stone', 1))
        c.hline(cx - 3, cx + 3, cy - 10, K('water', 3))
        # jet central (tirets qui montent) et retombées en arc (tirets qui descendent)
        for y in range(cy - 19, cy - 10):
            c.set(cx, y, K('water', 5 if (y + f) % 4 < 2 else 3))
        c.set(cx - 1, cy - 19, K('water', 4)); c.set(cx + 1, cy - 19, K('water', 4)); c.set(cx, cy - 20, K('water', 5))
        for side in (-1, 1):
            for t in range(14):
                x = cx + side * (1 + t * 0.62); y = cy - 19 + (t * t) * 0.075 + t * 0.15
                if (t - f) % 4 < 2:
                    c.set(int(round(x)), int(round(y)), K('water', 4 if t < 7 else 3))
            # éclaboussure à l'arrivée
            ex = cx + side * 9
            c.set(ex + (side if f % 2 else 0), cy - 2 - (f % 2), K('water', 5))
        fr.append(c)
    strip('fountain', fr)


# ---------------------------------------------------------------- drapeaux
def flag(name, ramp, emblem):
    fr = []
    for f in range(4):
        c = Canvas(12, 9)
        for x in range(1, 12):
            off = int(round(math.sin((x * 0.7) - f * math.pi / 2) * 1.2 * (x / 11)))
            for y in range(1, 7):
                k = 3 if y < 3 else (2 if y < 5 else 1)
                k += 1 if math.sin((x * 0.7) - f * math.pi / 2) > 0.5 else 0
                if x > 9 and y in (3, 4) and False:
                    continue
                c.set(x, y + off, K(ramp, min(k, 4)))
            if emblem and 4 <= x <= 6:
                c.set(x, 3 + off, K('gold', 3)); c.set(x, 4 + off, K('gold', 2))
        c.vline(0, 0, 8, K('iron', 2))
        fr.append(outlined(c))
    strip(name, fr)


# ---------------------------------------------------------------- feuillage au vent
def canopy():
    def base():
        c = Canvas(20, 16)
        c.disc(10, 9, 9, K('leaf', 1), 6); c.disc(9, 8, 8, K('leaf', 2), 5); c.disc(8, 7, 6, K('leaf', 3), 4); c.disc(7, 6, 3, K('leaf', 4), 2)
        for (x, y) in ((5, 4), (12, 5), (14, 9), (6, 10), (10, 3)):
            c.set(x, y, K('leaf', 5)); c.set(x + 1, y + 1, K('leaf', 2))
        return c
    fr = []
    for shift in (0, 1, 0, -1):
        b = base(); c = Canvas(20, 16)
        for y in range(16):
            s = shift if y < 7 else (shift // 2 if y < 11 else 0)
            for x in range(20):
                k = b.get(x - s, y)
                if k != '.':
                    c.set(x, y, k)
        fr.append(outlined(c))
    strip('canopy', fr)


def tuft():
    fr = []
    for s in (0, 1, 0, -1):
        c = Canvas(7, 6)
        for i, x in enumerate((1, 3, 5)):
            h = (4, 5, 3)[i]
            for y in range(h):
                lean = s if y >= h - 2 else 0
                c.set(x + lean, 5 - y, K('grass', 4 if y == h - 1 else 3))
        fr.append(c)
    strip('tuft', fr)


# ---------------------------------------------------------------- flammes
def flame(name, w, h):
    fr = []
    for f in range(4):
        c = Canvas(w, h)
        cx = w // 2
        for y in range(h):
            t = y / (h - 1)
            hw = (1 - t) * (w / 2) * (0.7 + 0.3 * math.sin(f * 1.7 + y))
            sway = int(round(math.sin(f * math.pi / 2 + t * 2) * (1 - t) * 0.8)) if t < 0.6 else 0
            for x in range(w):
                d = abs(x - cx - sway)
                if d <= hw:
                    k = 3 if d < hw * 0.35 and t > 0.3 else (2 if d < hw * 0.7 else 1)
                    c.set(x, h - 1 - y, K('flame', k))
        fr.append(c)
    strip(name, fr)


# ---------------------------------------------------------------- animaux
def chicken():
    fr = []
    for f in range(2):
        c = Canvas(8, 8)
        c.disc(3, 4, 2, K('bone', 3), 2); c.set(1, 3, K('bone', 3)); c.set(0, 2, K('bone', 3))   # queue
        c.rect(5, 1, 2, 3, K('bone', 3)); c.set(5, 0, K('red', 3)); c.set(6, 0, K('red', 3))      # tête + crête
        c.set(7, 2, K('gold', 3)); c.set(6, 2, INK)
        c.set(3, 4, K('bone', 2)); c.set(4, 5, K('bone', 2))
        legs = ((2, 4), (4, 3))[f]
        c.set(legs[0] + 1, 7, K('gold', 2)); c.set(legs[1] + 1, 7, K('gold', 2)); c.set(legs[0] + 1, 6, K('gold', 1)); c.set(legs[1] + 1, 6, K('gold', 1))
        fr.append(outlined(c))
    strip('chicken', fr)


def cat():
    fr = []
    for f in range(4):
        c = Canvas(10, 9)
        c.rect(2, 3, 4, 5, K('dirt', 1)); c.rect(2, 1, 4, 3, K('dirt', 1)); c.set(2, 0, K('dirt', 1)); c.set(5, 0, K('dirt', 1))
        c.set(3, 2, K('gold', 3)); c.set(5, 2, K('gold', 3)); c.set(4, 3, K('flower', 3))
        c.set(3, 6, K('dirt', 3)); c.set(4, 5, K('dirt', 2))
        tail = [((6, 7), (7, 6), (8, 5), (8, 4)), ((6, 7), (7, 6), (8, 6), (9, 5)), ((6, 7), (7, 7), (8, 6), (9, 6)), ((6, 7), (7, 6), (8, 6), (9, 5))][f]
        for (x, y) in tail:
            c.set(x, y, K('dirt', 1))
        fr.append(outlined(c))
    strip('cat', fr)


def crow():
    fr = []
    for f in range(4):
        c = Canvas(8, 7)
        c.rect(2, 2, 4, 3, K('iron', 1)); c.rect(1, 4, 2, 1, K('iron', 1))
        head = (5, 1) if f != 2 else (5, 0)
        c.rect(head[0], head[1], 2, 2, K('iron', 1)); c.set(head[0] + 1, head[1], K('flower', 1) if f != 3 else K('iron', 3))
        c.set(head[0] + 2, head[1] + 1, K('gold', 2))
        if f == 2:  # croasse : bec ouvert
            c.set(head[0] + 2, head[1], K('gold', 2))
        c.set(3, 5, K('gold', 1)); c.set(4, 5, K('gold', 1))
        c.set(3, 2, K('iron', 3))
        fr.append(outlined(c))
    strip('crow', fr)


def bird():
    fr = []
    for f in range(2):
        c = Canvas(9, 5)
        c.rect(3, 2, 3, 2, K('stone', 1)); c.set(6, 2, K('gold', 3))
        if f == 0:
            c.line(0, 0, 3, 2, K('stone', 1)); c.line(8, 0, 5, 2, K('stone', 1))
        else:
            c.line(0, 4, 3, 2, K('stone', 1)); c.line(8, 4, 5, 2, K('stone', 1))
        fr.append(c)
    strip('bird', fr)


def butterfly():
    fr = []
    for f in range(2):
        c = Canvas(5, 4)
        col = K('flower', 1)
        c.set(2, 1, INK); c.set(2, 2, INK)
        if f == 0:
            c.rect(0, 0, 2, 2, col); c.rect(3, 0, 2, 2, col); c.set(0, 2, col); c.set(4, 2, col)
        else:
            c.set(1, 1, col); c.set(3, 1, col); c.set(1, 2, col); c.set(3, 2, col)
        fr.append(c)
    strip('butterfly', fr)


def bat():
    fr = []
    for f in range(2):
        c = Canvas(9, 5)
        c.rect(3, 1, 3, 3, K('iron', 0)); c.set(3, 0, K('iron', 0)); c.set(5, 0, K('iron', 0)); c.set(3, 2, K('red', 4)); c.set(5, 2, K('red', 4))
        if f == 0:
            c.line(0, 0, 2, 2, K('iron', 1)); c.line(8, 0, 6, 2, K('iron', 1)); c.hline(1, 2, 1, K('iron', 1)); c.hline(6, 7, 1, K('iron', 1))
        else:
            c.line(0, 4, 2, 2, K('iron', 1)); c.line(8, 4, 6, 2, K('iron', 1)); c.hline(1, 2, 3, K('iron', 1)); c.hline(6, 7, 3, K('iron', 1))
        fr.append(c)
    strip('bat', fr)


def rat():
    fr = []
    for f in range(2):
        c = Canvas(9, 4)
        c.rect(3, 1, 4, 2, K('stone', 2)); c.rect(6, 0, 2, 2, K('stone', 2)); c.set(7, 0, K('flower', 3)); c.set(8, 1, K('flower', 3))
        c.line(0, 1 + f, 2, 2, K('flower', 3))
        c.set(4, 3, K('stone', 1)); c.set(6 - f, 3, K('stone', 1))
        fr.append(outlined(c))
    strip('rat', fr)


def wisp():
    fr = []
    for f in range(4):
        c = Canvas(5, 7)
        c.disc(2, 2, 2, K('water', 4), 2); c.set(2, 2, K('water', 5))
        for y in range(4, 7):
            c.set(2 + int(round(math.sin(f * math.pi / 2 + y) * 1)), y, K('water', 4 if y < 6 else 3))
        fr.append(c)
    strip('wisp', fr)


# ---------------------------------------------------------------- manifeste
def build(save):
    fountain(); flag('flag_blue', 'blue', True); flag('flag_red', 'red', False); canopy(); tuft()
    flame('flame_small', 3, 4); flame('flame_big', 7, 7)
    chicken(); cat(); crow(); bird(); butterfly(); bat(); rat(); wisp()
    for name, (fw, fh, n, frames) in SPRITES.items():
        for mode, pal in (('day', COLOR_DAY), ('night', COLOR_NIGHT)):
            im = Image.new('RGBA', (fw * n, fh), (0, 0, 0, 0))
            for i, fc in enumerate(frames):
                im.paste(fc.render(pal), (i * fw, 0))
            save(im, f'village2/sprites/{name}_{mode}.png')

    P = lambda x, y: [x * S, y * S]
    items = []
    def add(sprite, x, y, dur, modes='both', anim=None, **kw):
        fw, fh, n, _ = SPRITES[sprite]
        d = dict(sprite=sprite, x=x * S, y=y * S, w=fw, h=fh, frames=n, dur=dur, modes=modes)
        if anim: d['anim'] = anim
        d.update(kw); items.append(d)

    add('fountain', 108 - 14, 158 - 22, 520)
    add('flag_blue', 108, 0, 900)
    add('flag_red', 31, 105, 820)
    import random
    r = random.Random(3)
    # Touffes d'herbe animées : uniquement sur de l'herbe dégagée de la carte de base
    # (jamais sur un bâtiment, un chemin, un arbre ou sa couronne animée),
    # et ajoutées AVANT les couronnes d'arbres pour être dessinées dessous.
    base = Image.open(ROOT / 'public/px/village2/base_day.png').convert('RGB')
    bw, bh = base.size  # image de base en pixels art (x1)
    grass = {tuple(int(COLOR_DAY[K('grass', i)].lstrip('#')[j:j + 2], 16) for j in (0, 2, 4)) for i in range(5)}
    crowns = [(x - 12, y - 22, x + 12, y + 2) for (x, y) in V.TREES_ROUND]
    def clear(tx, ty):
        if tx < 1 or ty < 1 or tx + 8 > bw or ty + 7 > bh: return False
        if any(a <= tx + 7 and tx <= c and b <= ty + 6 and ty <= d for (a, b, c, d) in crowns): return False
        return all(base.getpixel((xx, yy)) in grass for xx in range(tx - 1, tx + 8) for yy in range(ty - 1, ty + 7))
    def spot(x, y):
        for rad in range(0, 24):
            for dx in range(-rad, rad + 1):
                for dy in (-rad, rad) if abs(dx) != rad else range(-rad, rad + 1):
                    if clear(x + dx, y + dy): return (x + dx, y + dy)
        return None
    tufts = [(30, 140), (70, 200), (150, 120), (190, 120), (120, 230), (100, 215), (140, 270), (8, 200), (210, 160), (60, 110),
             (196, 112), (128, 300), (40, 300), (88, 300), (6, 80), (130, 90)]
    placed = []
    for (x, y) in tufts:
        p2 = spot(x, y)
        if p2 and all(abs(p2[0] - a) > 8 or abs(p2[1] - b) > 7 for (a, b) in placed):
            placed.append(p2)
    print('touffes placées :', len(placed), '/', len(tufts))
    for (x, y) in placed:
        add('tuft', x, y, 1800 + r.randint(0, 900))
    for (x, y) in V.TREES_ROUND:
        add('canopy', x - 10, y - 20, 2600 + (x * 37 % 900))
    for (lx, ly) in V.LANTERNS:
        add('flame_small', lx + 1, ly - 9, 420, 'night')
    for lx in (8 + 19, 8 + 36):
        add('flame_small', lx - 1, 85, 460, 'night')
    add('flame_big', 8, 175, 480)
    # animaux
    add('chicken', 168, 292, 360, 'day', anim='walk', dx=96, period=11000)
    add('chicken', 98, 186, 380, 'day', anim='walk', dx=60, period=8000, delay=-3000)
    add('cat', 186, 258, 900)
    add('crow', 104, 245, 1400)
    add('bird', -12, 60, 260, 'day', anim='fly', tx=980, ty=320, period=16000)
    add('bird', -20, 70, 240, 'day', anim='fly', tx=980, ty=320, period=16000, delay=-600)
    add('butterfly', 150, 268, 200, 'day', anim='flutter', period=9000)
    add('butterfly', 60, 140, 220, 'day', anim='flutter', period=11000, delay=-4000)
    add('butterfly', 130, 200, 210, 'day', anim='flutter', period=10000, delay=-7000)
    add('bat', 20, 110, 160, 'night', anim='bat', period=9000)
    add('bat', 60, 200, 150, 'night', anim='bat', period=11000, delay=-5000)
    add('rat', 196, 192, 180, 'night', anim='walk', dx=48, period=7000)
    for i, (x, y) in enumerate(((36, 232), (60, 250), (78, 236), (28, 262))):
        add('wisp', x, y, 600, 'night', anim='wisp', period=5200, delay=-i * 1300)

    extra = {
        'smoke': [P(199, 28), P(189, 212)],
        'fireflies': [P(x, y) for (x, y) in ((150, 276), (176, 280), (196, 270), (120, 214), (90, 120), (140, 108), (40, 290), (70, 270), (200, 140), (24, 150))],
        'leaves': [P(0, 60), P(0, 180), P(0, 250)],
        'glow': [P(lx + 2, ly - 7) for (lx, ly) in V.LANTERNS] + [P(11, 179), P(180, 88), P(27, 87), P(44, 87)],
    }
    ts = ['// Fichier généré par tools/px/village_life.py : ne pas modifier à la main.',
          '// Sprites animés de la carte (repère 864 x 1224, x4). w/h = taille d’une image en pixels art.',
          'export type LifeItem = { sprite: string; x: number; y: number; w: number; h: number; frames: number; dur: number;',
          "  modes: 'both' | 'day' | 'night'; anim?: 'walk' | 'fly' | 'flutter' | 'bat' | 'wisp'; dx?: number; tx?: number; ty?: number; period?: number; delay?: number }",
          f'export const VILLAGE_LIFE: LifeItem[] = {json.dumps(items, ensure_ascii=False, indent=1)}',
          f'export const VILLAGE_FX = {json.dumps(extra)}']
    (ROOT / 'src' / 'data' / 'villageLife.ts').write_text('\n'.join(ts) + '\n', encoding='utf8')
