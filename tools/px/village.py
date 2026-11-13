"""Carte du village en pixel art (vue 3/4), 144 x 204, rendue en jour et en nuit (2 images d'animation chacune).
Les 7 lieux gardent la même disposition que l'ancienne carte. Sorties :
  public/px/village/{day,night}_{0,1}.png  et  src/data/villageSpots.ts (zones cliquables, repère 864 x 1224)
"""
import json, math, random
from pathlib import Path
from canvas import Canvas
from px import ROOT

W, H, SCALE = 144, 204, 6
rnd = random.Random(7)

DAY = {
    'k': '#1b1410',
    # sol
    'g': '#5f8f3e', 'G': '#45702e', 'h': '#7aab4c', 'j': '#5f8f3e', 'J': '#45702e',
    'c': '#b5a48a', 'C': '#8e7f69', 'u': '#b5a48a', 'U': '#8e7f69', 'e': '#a8875a', 'E': '#86683f',
    # bâtiments
    'w': '#efe0c2', 'W': '#cdb994', 'm': '#ece6da', 'M': '#c4bcab', 's': '#9a968f', 'S': '#6f6b66', 't': '#bdb9b0',
    'r': '#b4473c', 'R': '#843128', 'b': '#4f6b86', 'B': '#38506a', 'n': '#c99a4a', 'N': '#9a7232',
    'o': '#7a5233', 'O': '#553821', 'd': '#8a5a35', 'D': '#5e3b20',
    'y': '#9cc7d9', 'Y': '#d8eef5', 'p': '#7c4a8c', 'P': '#55306a', 'q': '#e6c25a', 'Q': '#a8842b',
    # nature et détails
    'l': '#3f7a3a', 'L': '#2c5a2b', 'i': '#5a9a48', 'z': '#a7a39b', 'Z': '#77736c', 'f': '#4f9ec9', 'F': '#2f6f99', 'v': '#bfe6f7',
    'x': '#f2a33a', 'X': '#fff1b0', 'a': '#c0392b', 'A': '#8e2a20', 'T': '#6b4a2e',
    'H': '#5f8f3e',  # feu follet : invisible le jour (couleur de l'herbe)
}
LIT = {  # couleurs qui « s'allument » la nuit
    'y': '#ffcf5a', 'Y': '#fff0a8', 'x': '#ffb43a', 'X': '#fff6c8', 'u': '#6e6656', 'U': '#575041', 'j': '#34503a', 'J': '#2a4030', 'H': '#bfe8ff',
    'q': '#c9a443', 'v': '#9fd0f0',
}


def to_night(hexc):
    h = hexc.lstrip('#'); r, g, b = (int(h[i:i + 2], 16) for i in (0, 2, 4))
    nr, ng, nb = 0x1a, 0x26, 0x44
    k = 0.38
    return '#%02x%02x%02x' % (int(r * k * 0.8 + nr * 0.45), int(g * k * 0.85 + ng * 0.45), int(b * k + nb * 0.55))


NIGHT = {key: (LIT.get(key) or (DAY[key] if key == 'k' else to_night(DAY[key]))) for key in DAY}


def flicker(p):
    """Image 2 : flammes et reflets inversés."""
    q = dict(p); q['x'], q['X'] = p['X'], p['x']; q['f'], q['v'] = p['v'], p['f']
    if p['H'] != p['g']:
        q['H'] = '#7fa8c8'
    return q


# ---------------------------------------------------------------- sol
def ground():
    c = Canvas(W, H, 'g')
    for _ in range(420):                       # touffes d'herbe
        x, y = rnd.randrange(W), rnd.randrange(H)
        c.set(x, y, rnd.choice('Gh')); c.set(x + 1, y, 'G' if rnd.random() < .5 else 'g')
    # place pavée (ellipse) + chemins
    cx, cy = 72, 106
    for y in range(H):
        for x in range(W):
            if ((x - cx) / 34) ** 2 + ((y - cy) / 30) ** 2 <= 1:
                c.set(x, y, 'c')
    def path(x0, y0, x1, y1, wd=7):
        steps = max(abs(x1 - x0), abs(y1 - y0))
        for s in range(steps + 1):
            x = x0 + (x1 - x0) * s / steps; y = y0 + (y1 - y0) * s / steps
            for dx in range(-wd // 2, wd // 2 + 1):
                for dy in range(-wd // 2, wd // 2 + 1):
                    if dx * dx + dy * dy <= (wd / 2) ** 2:
                        c.set(int(x + dx), int(y + dy), 'c')
    path(72, 80, 72, 50, 9)      # mairie
    path(50, 92, 26, 74)         # casino
    path(96, 92, 120, 80)        # taverne
    path(42, 112, 30, 124)       # tour
    path(102, 112, 116, 122)     # planque
    path(52, 130, 34, 150)       # cimetière
    path(92, 130, 112, 150)      # maison
    # joints des pavés
    for y in range(H):
        for x in range(W):
            if c.get(x, y) == 'c' and ((x + (y // 2) * 2) % 4 == 0 and y % 2 == 0 or rnd.random() < 0.06):
                c.set(x, y, 'C')
    # bordure de la place
    for y in range(H):
        for x in range(W):
            if c.get(x, y) == 'g' and any(c.get(x + dx, y + dy) in 'cC' for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                c.set(x, y, 'E')
    return c


def cast_shadow(ground_c, b, dx=2, dy=2):
    sh = {'g': 'G', 'h': 'G', 'c': 'C', 'u': 'U', 'j': 'J', 'E': 'E', 'e': 'E', 'G': 'G', 'C': 'C'}
    pts = [(x, y) for y in range(H) for x in range(W) if b.get(x, y) != '.']
    for x, y in pts:
        k = ground_c.get(x + dx, y + dy)
        if k in sh and b.get(x + dx, y + dy) == '.':
            ground_c.set(x + dx, y + dy, sh[k])


def compose(base, layer):
    for y in range(H):
        for x in range(W):
            k = layer.get(x, y)
            if k != '.':
                base.set(x, y, k)


# ---------------------------------------------------------------- éléments
def roof_band(c, x, y, w, h, k, kd, overhang=1):
    """Toit vu de 3/4 : trapèze qui s'élargit vers le bas, rangs de tuiles."""
    for r in range(h):
        inset = max(0, (h - 1 - r) // 2)
        x0, x1 = x - overhang + inset, x + w - 1 + overhang - inset
        c.hline(x0, x1, y + r, kd if (r % 3 == 2 or r == h - 1) else k)
    c.hline(x + (h - 1) // 2 - overhang + 1, x + w - 1 - (h - 1) // 2 + overhang - 1, y, kd)


def gable(c, x, y, w, k, kd):
    """Pignon triangulaire."""
    hw = w // 2
    for r in range(hw + 1):
        c.hline(x + hw - r, x + w - 1 - hw + r, y + r, k if r < hw else kd)
    c.line(x, y + hw, x + hw, y, kd); c.line(x + w - 1, y + hw, x + w - 1 - hw, y, kd)


def wall(c, x, y, w, h, k, kd):
    c.rect(x, y, w, h, k)
    c.vline(x + w - 1, y, y + h - 1, kd)
    c.hline(x, x + w - 1, y + h - 1, kd)


def window(c, x, y, w=3, h=3, sill=True):
    c.frame(x - 1, y - 1, w + 2, h + 2, 'k')
    c.rect(x, y, w, h, 'y')
    c.set(x, y, 'Y')
    if w >= 4:
        c.vline(x + w // 2, y, y + h - 1, 'k')
    if sill:
        c.hline(x - 1, x + w, y + h + 1, 'W')


def door(c, x, y, w=4, h=6, k='d', kd='D', arch=False):
    c.rect(x, y, w, h, k)
    for i in range(1, w, 2):
        c.vline(x + i, y + 1, y + h - 1, kd)
    c.set(x + w - 2, y + h // 2, 'q')
    c.frame(x - 1, y - 1, w + 2, h + 1, 'k')
    if arch:
        c.set(x - 1, y - 1, '.'); c.set(x + w, y - 1, '.')


def tree(c, x, y, big=False):
    r = 6 if big else 4
    c.rect(x - 1, y, 3, r + 1, 'T')
    c.disc(x, y - r + 1, r, 'L')
    c.disc(x - 1, y - r, r - 1, 'l')
    c.disc(x - 2, y - r - 1, max(1, r - 3), 'i')


def lamp(c, x, y):
    c.vline(x, y - 6, y, 'S'); c.set(x, y - 7, 'k')
    c.rect(x - 1, y - 9, 3, 2, 'x'); c.set(x, y - 9, 'X')
    c.hline(x - 1, x + 1, y - 10, 'k')


# ---------------------------------------------------------------- bâtiments (chaque fonction renvoie (calque, rect))
def mairie():
    b = Canvas(W, H)
    x, y, w = 46, 6, 52
    roof_band(b, x, y + 8, w, 10, 'b', 'B', 2)
    gable(b, x + 16, y, 20, 'm', 'M')                  # fronton
    b.disc(x + 26, y + 6, 3, 'q'); b.set(x + 26, y + 5, 'k'); b.set(x + 26, y + 6, 'k'); b.set(x + 27, y + 6, 'k')  # horloge
    wall(b, x, y + 18, w, 24, 'm', 'M')
    b.hline(x, x + w - 1, y + 18, 'M'); b.hline(x - 1, x + w, y + 19, 'k')   # corniche
    for i in range(6):                                  # colonnes
        cx = x + 4 + i * 9
        b.rect(cx, y + 21, 3, 18, 'm'); b.vline(cx + 2, y + 21, y + 38, 'M'); b.hline(cx - 1, cx + 3, y + 20, 'M'); b.hline(cx - 1, cx + 3, y + 39, 'M')
    for i in range(5):
        window(b, x + 8 + i * 9, y + 23, 3, 5, sill=False)
    door(b, x + 23, y + 32, 6, 9, 'o', 'O', True)
    for s in range(3):                                  # marches
        b.hline(x + 14 - s * 2, x + w - 15 + s * 2, y + 42 + s, 't' if s % 2 == 0 else 's')
    b.rect(x + 25, y - 7, 2, 7, 'S'); b.rect(x + 27, y - 7, 5, 3, 'a'); b.set(x + 31, y - 5, 'A')   # drapeau
    return b, (x - 2, y - 7, w + 4, 52)


def casino():
    b = Canvas(W, H)
    x, y, w = 4, 30, 40
    roof_band(b, x, y, w, 9, 'p', 'P', 2)
    wall(b, x, y + 9, w, 28, 'r', 'R')
    for i in range(0, w, 4):                            # auvent rayé
        b.rect(x + i, y + 9, 2, 4, 'w'); b.rect(x + i + 2, y + 9, 2, 4, 'r')
    b.hline(x - 1, x + w, y + 13, 'k')
    for i in range(0, w, 2):
        b.set(x + i, y + 14, 'W')
    b.rect(x + 9, y + 16, 22, 6, 'k'); b.rect(x + 10, y + 17, 20, 4, 'q')  # enseigne
    for i, col in enumerate([2, 6, 10, 14, 18]):
        b.set(x + 11 + col, y + 18, 'k' if i % 2 == 0 else 'Q'); b.set(x + 11 + col, y + 19, 'Q' if i % 2 == 0 else 'k')
    window(b, x + 4, y + 25, 4, 4); window(b, x + w - 8, y + 25, 4, 4)
    door(b, x + 16, y + 26, 8, 10, 'p', 'P')
    b.rect(x + 2, y + 34, 3, 3, 'q'); b.rect(x + w - 5, y + 34, 3, 3, 'q')  # pots de pièces
    return b, (x - 2, y, w + 4, 38)


def taverne():
    b = Canvas(W, H)
    x, y, w = 102, 24, 38
    roof_band(b, x, y, w, 12, 'r', 'R', 2)
    b.rect(x + 28, y - 6, 4, 8, 's'); b.vline(x + 31, y - 6, y + 1, 'S'); b.hline(x + 27, x + 32, y - 7, 'k')  # cheminée
    wall(b, x, y + 12, w, 30, 'w', 'W')
    for xx in (x, x + 12, x + 25, x + w - 1):           # colombages
        b.vline(xx, y + 12, y + 41, 'O')
    b.hline(x, x + w - 1, y + 12, 'O'); b.hline(x, x + w - 1, y + 25, 'O')
    b.line(x + 1, y + 13, x + 11, y + 24, 'O'); b.line(x + 26, y + 24, x + 36, y + 13, 'O')
    window(b, x + 4, y + 16, 4, 4); window(b, x + 16, y + 16, 5, 4); window(b, x + 29, y + 16, 4, 4)
    window(b, x + 4, y + 30, 4, 4); window(b, x + 29, y + 30, 4, 4)
    door(b, x + 16, y + 31, 6, 10, 'd', 'D', True)
    b.hline(x - 6, x, y + 27, 'O'); b.rect(x - 8, y + 28, 6, 6, 'q'); b.rect(x - 7, y + 29, 4, 4, 'o'); b.rect(x - 6, y + 30, 2, 2, 'w')  # enseigne chope
    b.rect(x + w, y + 36, 4, 5, 'o'); b.hline(x + w, x + w + 3, y + 38, 'O')   # tonneau
    return b, (x - 8, y - 7, w + 12, 49)


def tour():
    b = Canvas(W, H)
    x, y = 12, 84
    b.rect(x + 2, y - 6, 2, 6, 'S'); b.rect(x + 4, y - 6, 6, 3, 'a'); b.set(x + 9, y - 4, 'A')   # drapeau
    for i in range(0, 20, 4):                             # créneaux
        b.rect(x + i - 2, y, 3, 3, 's')
    wall(b, x - 2, y + 3, 20, 4, 't', 'S')
    wall(b, x, y + 7, 16, 38, 's', 'S')
    for yy in range(y + 9, y + 44, 4):                   # appareillage
        for xx in range(x + ((yy // 4) % 2) * 3, x + 16, 6):
            b.hline(xx, xx + 2, yy, 'S')
    window(b, x + 6, y + 12, 3, 5, sill=False); window(b, x + 6, y + 24, 3, 5, sill=False)
    door(b, x + 5, y + 36, 6, 9, 'o', 'O', True)
    roof_band(b, x + 18, y + 26, 20, 6, 'b', 'B', 1)      # poste de garde
    wall(b, x + 18, y + 32, 20, 13, 's', 'S')
    window(b, x + 23, y + 35, 4, 4); b.rect(x + 31, y + 36, 3, 9, 'o')
    b.rect(x + 40, y + 38, 2, 7, 'O'); b.rect(x + 39, y + 36, 4, 2, 'x'); b.set(x + 40, y + 36, 'X')  # brasero
    return b, (x - 2, y - 6, 46, 51)


def planque():
    b = Canvas(W, H)
    x, y, w = 104, 92, 32
    roof_band(b, x, y, w, 9, 'O', 'k', 2)
    b.set(x + 6, y + 3, 'g'); b.set(x + 7, y + 3, 'g'); b.set(x + 20, y + 5, 'G')   # mousse
    wall(b, x, y + 9, w, 26, 'o', 'O')
    for xx in range(x + 3, x + w, 4):
        b.vline(xx, y + 9, y + 34, 'O')
    window(b, x + 4, y + 14, 5, 4)
    b.line(x + 3, y + 13, x + 9, y + 18, 'd'); b.line(x + 3, y + 18, x + 9, y + 13, 'd')  # planches clouées
    door(b, x + 18, y + 22, 7, 12, 'O', 'k')
    b.rect(x + 20, y + 13, 5, 5, 'k'); b.rect(x + 21, y + 14, 3, 2, 'z'); b.set(x + 21, y + 16, 'z'); b.set(x + 23, y + 16, 'z')  # crâne
    b.rect(x - 4, y + 28, 6, 6, 'o'); b.frame(x - 4, y + 28, 6, 6, 'O'); b.line(x - 4, y + 28, x + 1, y + 33, 'O')   # caisse
    return b, (x - 4, y, w + 6, 36)


def cimetiere():
    b = Canvas(W, H)
    x, y = 4, 146
    # chapelle
    gable(b, x + 4, y - 2, 14, 'b', 'B'); wall(b, x + 4, y + 5, 14, 14, 's', 'S'); door(b, x + 9, y + 11, 4, 7, 'O', 'k', True)
    b.rect(x + 10, y - 7, 2, 6, 'z'); b.rect(x + 8, y - 5, 6, 2, 'z')            # croix
    for row in range(3):                                   # tombes
        for col in range(3):
            tx, ty = x + 24 + col * 12, y + 4 + row * 14
            b.rect(tx, ty, 6, 7, 'z'); b.vline(tx + 5, ty, ty + 6, 'Z'); b.set(tx, ty, '.'); b.set(tx + 5, ty, '.')
            b.hline(tx + 2, tx + 3, ty + 2, 'Z'); b.vline(tx + 2, ty + 1, ty + 4, 'Z')
            b.hline(tx - 1, tx + 6, ty + 7, 'E')
    for xx in range(x, x + 64, 3):                          # grille
        b.vline(xx, y + 42, y + 46, 'k'); b.set(xx, y + 41, 'S')
    b.hline(x, x + 63, y + 44, 'k')
    b.line(x + 4, y + 40, x + 4, y + 26, 'T'); b.line(x + 4, y + 30, x + 1, y + 26, 'T'); b.line(x + 4, y + 28, x + 8, y + 24, 'T')   # arbre mort
    return b, (x - 2, y - 7, 68, 54)


def maison():
    b = Canvas(W, H)
    x, y, w = 98, 150, 36
    roof_band(b, x, y, w, 13, 'n', 'N', 3)
    b.rect(x + 6, y - 5, 4, 7, 's'); b.hline(x + 5, x + 10, y - 6, 'k')
    wall(b, x, y + 13, w, 20, 'w', 'W')
    window(b, x + 5, y + 17, 5, 5); window(b, x + 26, y + 17, 5, 5)
    door(b, x + 15, y + 22, 6, 10, 'd', 'D', True)
    for xx in (x + 3, x + 6, x + 29, x + 32):               # fleurs
        b.set(xx, y + 33, 'a'); b.set(xx + 1, y + 33, 'l')
    for xx in range(x - 4, x + w + 4, 3):                   # barrière
        b.vline(xx, y + 37, y + 40, 'w')
    b.hline(x - 4, x + w + 3, y + 38, 'W')
    b.set(x + 17, y + 37, '.'); b.set(x + 18, y + 37, '.')
    return b, (x - 4, y - 6, w + 8, 47)


def fountain(c):
    cx, cy = 72, 104
    c.disc(cx, cy, 12, 'k', 8); c.disc(cx, cy, 11, 's', 7); c.disc(cx, cy, 9, 'F', 5); c.disc(cx, cy - 1, 8, 'f', 4)
    for (dx, dy) in ((-5, -2), (4, 1), (-2, 2), (6, -2)):
        c.set(cx + dx, cy + dy, 'v')
    c.rect(cx - 1, cy - 9, 3, 9, 't'); c.vline(cx + 1, cy - 9, cy - 1, 's'); c.disc(cx, cy - 10, 3, 's', 1)
    c.set(cx, cy - 13, 'v'); c.set(cx - 1, cy - 12, 'v'); c.set(cx + 1, cy - 12, 'v'); c.set(cx - 2, cy - 11, 'f'); c.set(cx + 2, cy - 11, 'f')


LOCATIONS = [('mairie', mairie), ('casino', casino), ('taverne', taverne), ('poste_garde', tour), ('planque', planque),
             ('cimetiere', cimetiere), ('maison', maison)]
LAMPS = [(52, 88), (92, 88), (48, 124), (96, 124)]


def build(save):
    g = ground()
    # lumière des lampadaires (jour : identique, nuit : sol éclairé)
    for lx, ly in LAMPS:
        for y in range(ly - 10, ly + 8):
            for x in range(lx - 10, lx + 11):
                if (x - lx) ** 2 + ((y - ly + 2) * 1.3) ** 2 <= 70:
                    k = g.get(x, y)
                    g.set(x, y, {'c': 'u', 'C': 'U', 'g': 'j', 'G': 'J', 'h': 'j', 'E': 'U'}.get(k, k))
    spots = {}
    layers = []
    for lid, fn in LOCATIONS:
        b, rect = fn()
        b.outline('k')
        layers.append(b)
        spots[lid] = rect
    deco = Canvas(W, H)
    for (x, y, big) in [(56, 70, False), (90, 72, False), (140, 100, False), (80, 172, True), (70, 196, False), (140, 200, False),
                        (8, 18, False), (40, 84, False), (90, 140, False)]:
        tree(deco, x, y, big)
    for lx, ly in LAMPS:
        lamp(deco, lx, ly)
    deco.outline('k')
    for b in layers + [deco]:
        cast_shadow(g, b)
    fountain(g)
    for b in [deco] + layers:
        compose(g, b)
    for (wx, wy) in ((34, 147), (46, 163), (58, 155), (40, 177)):   # feux follets du cimetière (visibles la nuit)
        if g.get(wx, wy) in 'gGhE':
            g.set(wx, wy, 'H'); g.set(wx, wy - 1, 'H'); g.set(wx + 1, wy, 'H')
    out = []
    for mode, pal in (('day', DAY), ('night', NIGHT)):
        for f, p in enumerate((pal, flicker(pal))):
            save(g.render(p), f'village/{mode}_{f}.png')
        out.append(g.render(pal, 4))
    # zones cliquables (repère 864 x 1224)
    ts = ['// Fichier généré par tools/px/village.py : ne pas modifier à la main.',
          '// Repère : 864 x 1224 (image 144 x 204 agrandie x6). poly = contour, c = centre, i = bouton règles, l = étiquette.',
          'export const VILLAGE_SIZE = { w: 864, h: 1224 }',
          'export const VILLAGE_SPOTS: Record<string, { poly: string; c: [number, number]; i: [number, number]; l: [number, number] }> = {']
    for lid, (x, y, w, h) in spots.items():
        X, Y, Wd, Hd = x * SCALE, y * SCALE, w * SCALE, h * SCALE
        if Y < 0:
            Hd += Y; Y = 0
        if X < 0:
            Wd += X; X = 0
        Wd = min(Wd, W * SCALE - X)
        poly = f'{X},{Y} {X + Wd},{Y} {X + Wd},{Y + Hd} {X},{Y + Hd}'
        ts.append(f"  {lid}: {{ poly: '{poly}', c: [{X + Wd // 2}, {Y + Hd // 2}], i: [{X + Wd - 32}, {Y + 32}], l: [{X + Wd // 2}, {Y + Hd + 26}] }},")
    ts.append('}')
    (ROOT / 'src' / 'data' / 'villageSpots.ts').write_text('\n'.join(ts) + '\n', encoding='utf8')
    return out
