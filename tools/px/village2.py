"""Carte du village v2 (médiéval fantasy), 216 x 306 px, agrandie x4 (repère 864 x 1224).
Décor fixe uniquement : la vie (eau, drapeaux, animaux, feuillage, fumées...) est dans village_life.py.
Lancer via build.py. Sorties : public/px/village2/base_{day,night}.png, src/data/villageSpots.ts."""
import math, random
from canvas import Canvas
from pal2 import K, LAMP, COLOR_DAY, COLOR_NIGHT, CHAR_INV
from px import ROOT

W, H, S = 216, 306, 4
R = random.Random(11)
INK = K('ink')


# ============================================================ outils
def shade_rect(c, x, y, w, h, ramp, j, top=1, right=-1, bottom=-1):
    c.rect(x, y, w, h, K(ramp, j))
    if top: c.hline(x, x + w - 1, y, K(ramp, j + top))
    if right: c.vline(x + w - 1, y, y + h - 1, K(ramp, j + right))
    if bottom: c.hline(x, x + w - 1, y + h - 1, K(ramp, j + bottom))


def bricks(c, x, y, w, h, ramp, j=2, bw=5, bh=3, jitter=True):
    """Pierres de taille : rangs décalés, joint sombre, arête claire en haut à gauche."""
    for yy in range(y, y + h):
        for xx in range(x, x + w):
            c.set(xx, yy, K(ramp, j))
    row = 0
    for yy in range(y, y + h, bh):
        off = (bw // 2) * (row % 2)
        c.hline(x, x + w - 1, yy, K(ramp, j - 1))
        for xx in range(x - off, x + w, bw):
            c.vline(xx, yy, min(y + h - 1, yy + bh - 1), K(ramp, j - 1))
            # arête claire + variation
            for dx in range(1, bw - 1):
                if x <= xx + dx < x + w and yy + 1 < y + h:
                    c.set(xx + dx, yy + 1, K(ramp, j + 1))
            if jitter and R.random() < 0.35:
                rx, ry = xx + R.randint(1, bw - 2), yy + R.randint(1, max(1, bh - 1))
                if x <= rx < x + w and y <= ry < y + h:
                    c.set(rx, ry, K(ramp, j + (1 if R.random() < .5 else -1)))
        row += 1


def rubble(c, x, y, w, h, ramp, j=2):
    """Moellons irréguliers (murs rustiques)."""
    c.rect(x, y, w, h, K(ramp, j - 1))
    yy = y
    while yy < y + h:
        rh = R.choice((2, 3, 3, 4))
        xx = x - R.randint(0, 3)
        while xx < x + w:
            rw = R.choice((3, 4, 5, 6))
            for a in range(xx + 1, xx + rw):
                for b in range(yy + 1, yy + rh):
                    if x <= a < x + w and y <= b < y + h:
                        c.set(a, b, K(ramp, j + (1 if b == yy + 1 else 0)))
            xx += rw
        yy += rh


def planks_v(c, x, y, w, h, ramp='wood', j=3, pw=3, crooked=0):
    for i, xx in enumerate(range(x, x + w)):
        k = (xx - x) % pw
        col = K(ramp, j - 1) if k == 0 else (K(ramp, j + 1) if k == 1 else K(ramp, j))
        dy = R.randint(-crooked, crooked) if crooked and k == 0 else 0
        c.vline(xx, y + max(0, dy), y + h - 1, col)
    for _ in range(max(1, w * h // 60)):                     # nœuds
        c.set(R.randrange(x, x + w), R.randrange(y, y + h), K(ramp, j - 2))


def shingles(c, x, y, w, h, ramp, j=2, sw=4, sh=3, taper=0):
    """Toit vu de 3/4 : rangs d'écailles (bas arrondi), clair en haut, ombre sous chaque rang."""
    for r in range(h):
        inset = int(taper * (h - 1 - r) / max(1, h - 1))
        x0, x1 = x + inset, x + w - 1 - inset
        rowi = r // sh
        lv = j + (1 if r % sh == 0 else 0) - (1 if r % sh == sh - 1 else 0)
        for xx in range(x0, x1 + 1):
            k = (xx + (sw // 2) * (rowi % 2)) % sw
            if r % sh == sh - 1 and k in (0, sw - 1):
                c.set(xx, y + r, K(ramp, j - 2))
            elif k == 0:
                c.set(xx, y + r, K(ramp, lv - 1))
            else:
                c.set(xx, y + r, K(ramp, lv))
    # faîtage
    c.hline(x + taper, x + w - 1 - taper, y, K(ramp, j + 2))


def thatch(c, x, y, w, h, j=3, taper=0, round_edge=True):
    for r in range(h):
        inset = int(taper * (h - 1 - r) / max(1, h - 1))
        x0, x1 = x + inset, x + w - 1 - inset
        if round_edge and r < 2:
            x0 += 2 - r; x1 -= 2 - r
        for xx in range(x0, x1 + 1):
            n = (xx * 7 + r * 3 + R.randint(0, 2)) % 5
            lv = j + (1 if n == 0 else 0) - (1 if n == 4 else 0) - (1 if r > h - 3 else 0)
            c.set(xx, y + r, K('thatch', lv))
    for xx in range(x + taper - 1, x + w - taper + 1):          # frange irrégulière
        if R.random() < 0.6:
            c.set(xx, y + h, K('thatch', j - 1))
        if R.random() < 0.25:
            c.set(xx, y + h + 1, K('thatch', j - 2))
    c.hline(x + taper + 2, x + w - taper - 3, y, K('thatch', j + 2))


def window(c, x, y, w=4, h=5, frame='wood', arch=False, shutters=False, cross=True, box=False):
    """Fenêtre à petits carreaux ; la vitre s'allume la nuit."""
    c.rect(x - 1, y - 1, w + 2, h + 2, K(frame, 1))
    c.rect(x, y, w, h, K('glass', 1))
    for xx in range(x, x + w):
        for yy in range(y, y + h):
            if (xx - x) + (yy - y) < 2:
                c.set(xx, yy, K('glass', 3))
            elif (xx - x) + (yy - y) < 4:
                c.set(xx, yy, K('glass', 2))
    if cross:
        c.vline(x + w // 2, y, y + h - 1, K(frame, 1)); c.hline(x, x + w - 1, y + h // 2, K(frame, 1))
    if arch:
        c.set(x - 1, y - 1, '.'); c.set(x + w, y - 1, '.')
        c.hline(x, x + w - 1, y - 2, K(frame, 1)); c.set(x, y - 1, K(frame, 1)); c.set(x + w - 1, y - 1, K(frame, 1))
        c.hline(x + 1, x + w - 2, y - 1, K('glass', 3))
    if shutters:
        c.rect(x - 3, y - 1, 2, h + 2, K('green', 2)); c.rect(x + w + 1, y - 1, 2, h + 2, K('green', 2))
        c.vline(x - 3, y - 1, y + h, K('green', 3)); c.vline(x + w + 2, y - 1, y + h, K('green', 1))
    if box:  # jardinière fleurie
        c.rect(x - 1, y + h + 1, w + 2, 2, K('wood', 2))
        for xx in range(x - 1, x + w + 1):
            c.set(xx, y + h, K('flower', R.choice((0, 1, 3, 5))) if R.random() < .7 else K('leaf', 4))
    else:
        c.hline(x - 2, x + w + 1, y + h + 1, K('stone', 4))


def door(c, x, y, w, h, ramp='wood', j=2, arch=True, studs=False, ring=True):
    c.rect(x - 1, y - 1, w + 2, h + 1, K('stone', 1))
    planks_v(c, x, y, w, h, ramp, j + 1, 2)
    if arch:
        for i in range(2):
            c.set(x - 1 + i, y - 1, '.'); c.set(x + w - i, y - 1, '.')
        c.set(x, y, K('stone', 1)); c.set(x + w - 1, y, K('stone', 1))
        c.hline(x + 1, x + w - 2, y - 2, K('stone', 1))
    if studs:
        for yy in range(y + 2, y + h - 1, 3):
            for xx in range(x + 1, x + w - 1, 2):
                c.set(xx, yy, K('iron', 3))
    if ring:
        c.set(x + w - 2, y + h // 2, K('gold', 3))


def lantern_post(c, x, y):
    c.vline(x, y - 9, y, K('iron', 1)); c.set(x - 1, y, K('iron', 1)); c.set(x + 1, y, K('iron', 1))
    c.hline(x, x + 2, y - 9, K('iron', 1))
    c.rect(x + 1, y - 8, 3, 4, K('iron', 0)); c.rect(x + 2, y - 7, 1, 2, K('flame', 2))


# ============================================================ sol
def ground():
    c = Canvas(W, H, K('grass', 2))
    # taches d'herbe (bruit) + touffes
    for y in range(H):
        for x in range(W):
            n = math.sin(x * 0.11 + y * 0.07) + math.sin(x * 0.05 - y * 0.13) * 0.8 + R.random() * 0.6
            if n > 1.35: c.set(x, y, K('grass', 3))
            elif n < -1.25: c.set(x, y, K('grass', 1))
    for _ in range(320):                         # brins d'herbe : un pixel clair au-dessus d'un sombre
        x, y = R.randrange(W), R.randrange(H)
        if c.get(x, y) == K('grass', 2):
            c.set(x, y, K('grass', 1)); c.set(x, y - 1, K('grass', 3))
    # chemins de terre vers chaque lieu
    def path(pts, wd=8):
        for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
            steps = max(abs(x1 - x0), abs(y1 - y0), 1)
            for s in range(steps + 1):
                x = x0 + (x1 - x0) * s / steps; y = y0 + (y1 - y0) * s / steps
                rr = wd / 2 + math.sin(s * 0.3) * 0.8
                for dx in range(-wd, wd + 1):
                    for dy in range(-wd, wd + 1):
                        if dx * dx + dy * dy <= rr * rr:
                            c.set(int(x + dx), int(y + dy), K('dirt', 2 + (1 if R.random() < .25 else 0) - (1 if R.random() < .1 else 0)))
    path([(108, 120), (108, 74)], 10)                 # mairie
    path([(84, 140), (60, 118), (40, 104)])           # tripot
    path([(132, 140), (160, 116), (180, 100)])        # taverne
    path([(70, 160), (50, 178)])                      # tour
    path([(146, 160), (172, 178)])                    # planque
    path([(86, 184), (70, 210), (80, 232)])           # cimetière
    path([(130, 184), (150, 214), (170, 236)])        # maison
    # place pavée
    cx, cy = 108, 156
    for y in range(H):
        for x in range(W):
            d = ((x - cx) / 44) ** 2 + ((y - cy) / 36) ** 2
            if d <= 1:
                # pavés arrondis 4x3 décalés
                bx, by = x // 4 + (y // 3) % 2 * 2, y // 3
                local = ((x + ((y // 3) % 2) * 2) % 4, y % 3)
                lv = 2 + ((bx * 31 + by * 17) % 3 == 0) - ((bx * 13 + by * 7) % 5 == 0)
                if local[0] == 0 or local[1] == 2:
                    c.set(x, y, K('cobble', 1))
                elif local == (1, 0):
                    c.set(x, y, K('cobble', lv + 1))
                else:
                    c.set(x, y, K('cobble', lv))
            elif d <= 1.08:
                c.set(x, y, K('stone', 2) if (x + y) % 3 else K('stone', 1))
    # fleurs et cailloux
    grassy = (K('grass', 1), K('grass', 2), K('grass', 3))
    for _ in range(18):                           # massifs de fleurs (une couleur par massif)
        x0, y0, col = R.randrange(4, W - 4), R.randrange(4, H - 4), R.choice((0, 1, 2, 3, 4))
        for _ in range(R.randint(4, 8)):
            x, y = x0 + R.randint(-4, 4), y0 + R.randint(-2, 2)
            if c.get(x, y) in grassy and c.get(x, y + 1) in grassy:
                c.set(x, y, K('flower', col)); c.set(x, y + 1, K('leaf', 3))
    for _ in range(26):                           # cailloux
        x, y = R.randrange(W), R.randrange(H)
        if c.get(x, y) in grassy and c.get(x + 1, y) in grassy:
            c.set(x, y, K('stone', 4)); c.set(x + 1, y, K('stone', 2)); c.set(x, y + 1, K('grass', 0)); c.set(x + 1, y + 1, K('grass', 0))
    return c


def cast_shadow(g, layer, dx=3, dy=2):
    """Ombre portée vers le bas-droite : on assombrit le sol d'un cran."""
    pts = [(x, y) for y in range(H) for x in range(W) if layer.get(x, y) != '.']
    seen = set()
    for x, y in pts:
        for s in range(1, dx + 1):
            X, Y = x + s, y + min(dy, s)
            if (X, Y) in seen or layer.get(X, Y) != '.':
                continue
            seen.add((X, Y))
            k = g.get(X, Y)
            name = CHAR_INV.get(k)
            if name and name[0] in ('grass', 'dirt', 'cobble', 'stone'):
                g.set(X, Y, K(name[0], name[1] - 1 if name[1] > 0 else 0) if name[0] != 'grass' else K('grass', 0 if name[1] <= 1 else 1))


def compose(base, layer):
    for y in range(H):
        for x in range(W):
            k = layer.get(x, y)
            if k != '.':
                base.set(x, y, k)


# ============================================================ bâtiments
def mairie():
    b = Canvas(W, H)
    # ailes : murs de grès, hauts toits d'ardoise
    for (x0, x1) in ((70, 99), (117, 146)):
        shingles(b, x0 - 2, 22, x1 - x0 + 4, 17, 'slate', 2, 4, 3, taper=4)
        bricks(b, x0, 39, x1 - x0, 27, 'sand', 3, 6, 3)
        b.hline(x0 - 1, x1, 39, K('sand', 5)); b.hline(x0 - 1, x1, 40, K('sand', 1))   # corniche
        for i, wx in enumerate(range(x0 + 4, x1 - 4, 9)):
            window(b, wx, 46, 4, 9, 'stone', arch=True)
        # bannière bleue et or entre les fenêtres
        bx = x0 + 11 if x0 < 100 else x1 - 14
        b.rect(bx, 43, 4, 12, K('blue', 2)); b.vline(bx + 3, 43, 54, K('blue', 1)); b.vline(bx, 43, 54, K('blue', 3))
        b.set(bx, 55, K('blue', 2)); b.set(bx + 3, 55, K('blue', 2)); b.set(bx + 1, 56, K('blue', 1))
        b.rect(bx + 1, 46, 2, 2, K('gold', 3)); b.set(bx + 1, 49, K('gold', 3)); b.set(bx + 2, 49, K('gold', 2))
        b.hline(bx - 1, bx + 4, 42, K('gold', 2))
        # lucarnes
        for lx in range(x0 + 6, x1 - 4, 14):
            b.rect(lx - 1, 27, 6, 7, K('sand', 4)); window(b, lx, 29, 4, 4, 'sand', arch=True, cross=False)
    # beffroi central
    tx, tw = 99, 18
    bricks(b, tx, 20, tw, 46, 'stone', 3, 6, 3)
    b.vline(tx + tw - 1, 20, 65, K('stone', 1)); b.vline(tx, 20, 65, K('stone', 4))
    # flèche conique d'ardoise
    for r in range(18):
        hw = 1 + r * (tw // 2 + 2) // 18
        for xx in range(tx + tw // 2 - hw, tx + tw // 2 + hw):
            k = 3 if xx < tx + tw // 2 - hw // 3 else (2 if xx < tx + tw // 2 + hw // 3 else 1)
            b.set(xx, 3 + r, K('slate', k - (1 if r % 3 == 2 else 0)))
    b.hline(tx - 2, tx + tw + 1, 21, K('stone', 1)); b.hline(tx - 2, tx + tw + 1, 22, K('stone', 4))
    b.vline(tx + tw // 2, 0, 3, K('iron', 2))                                     # mât (drapeau animé)
    # cloche dans l'arcade
    b.rect(tx + 4, 25, 10, 9, K('ink')); b.set(tx + 4, 25, K('stone', 3)); b.set(tx + 13, 25, K('stone', 3))
    b.rect(tx + 7, 27, 4, 4, K('gold', 2)); b.hline(tx + 6, tx + 11, 31, K('gold', 1)); b.set(tx + 7, 27, K('gold', 4)); b.set(tx + 9, 32, K('gold', 1))
    # horloge
    b.disc(tx + 8.5, 40, 4, K('gold', 1)); b.disc(tx + 8.5, 40, 3, K('bone', 3))
    b.vline(tx + 9, 37, 40, K('ink')); b.hline(tx + 9, tx + 11, 40, K('ink'))
    # grande porte cloutée sous arc
    door(b, tx + 4, 51, 10, 15, 'wood', 2, arch=True, studs=True)
    b.vline(tx + 9, 51, 65, K('wood', 0))
    # marches
    for s in range(4):
        b.hline(tx - 4 - s * 2, tx + tw + 3 + s * 2, 66 + s, K('stone', 4 if s % 2 == 0 else 3))
    return b, (68, 0, 80, 72)


def tripot():
    """Le Tripot (casino) : maison de jeu à colombages pourpres, étage en encorbellement, enseigne aux dés."""
    b = Canvas(W, H)
    x0, x1 = 8, 64
    shingles(b, x0 - 3, 46, x1 - x0 + 6, 16, 'tile', 3, 4, 3, taper=6)
    # lucarne
    b.rect(30, 46, 12, 10, K('tile', 2)); b.rect(31, 50, 10, 7, K('plaster', 3)); window(b, 33, 51, 6, 4, 'purple', arch=True)
    for r in range(5): b.hline(30 + r, 41 - r, 46 + r - 1, K('tile', 3 + (r == 0)))
    # étage : torchis + colombages pourpres
    b.rect(x0 - 2, 62, x1 - x0 + 4, 17, K('plaster', 3))
    for xx in (x0 - 2, x0 + 13, x0 + 27, x0 + 41, x1 + 1):
        b.vline(xx, 62, 78, K('purple', 1)); b.vline(xx + 1, 62, 78, K('purple', 2))
    for xa, xb in ((x0, x0 + 12), (x0 + 43, x1)):
        b.line(xa, 63, xb, 77, K('purple', 2)); b.line(xb, 63, xa, 77, K('purple', 2))
    window(b, x0 + 17, 66, 7, 7, 'purple'); window(b, x0 + 31, 66, 7, 7, 'purple')
    b.hline(x0 - 3, x1 + 2, 62, K('purple', 1)); b.hline(x0 - 3, x1 + 2, 79, K('purple', 1)); b.hline(x0 - 3, x1 + 2, 80, K('purple', 0))
    for xx in range(x0 - 2, x1 + 2, 6): b.set(xx, 81, K('purple', 1))         # abouts de solives
    # rez-de-chaussée : pierre sombre
    bricks(b, x0, 81, x1 - x0, 19, 'stone', 2, 5, 3)
    # porte à rideau pourpre
    b.rect(x0 + 22, 86, 12, 14, K('stone', 1)); b.rect(x0 + 23, 87, 10, 13, K('purple', 2))
    for xx in range(x0 + 23, x0 + 33, 2): b.vline(xx, 87, 99, K('purple', 3))
    b.hline(x0 + 23, x0 + 32, 87, K('gold', 2)); b.set(x0 + 23, 88, K('gold', 3)); b.set(x0 + 32, 88, K('gold', 3))
    for i in range(2): b.set(x0 + 22 + i, 85, '.'); b.set(x0 + 33 - i, 85, '.')
    # fenêtres à barreaux
    for wx in (x0 + 5, x1 - 13):
        window(b, wx, 87, 8, 6, 'iron', cross=False)
        for xx in range(wx + 1, wx + 8, 2): b.vline(xx, 87, 92, K('iron', 1))
    # enseigne : dés et pièces
    b.rect(x0 + 15, 80, 26, 7, K('ink')); b.rect(x0 + 16, 81, 24, 5, K('wood', 3)); b.hline(x0 + 16, x0 + 39, 81, K('wood', 4))
    for dx, pips in ((x0 + 18, (0, 4)), (x0 + 24, (0, 2, 4))):
        b.rect(dx, 82, 4, 3, K('bone', 3)); b.set(dx + 3, 84, K('bone', 1))
        for p in pips: b.set(dx + (p % 3), 82 + p // 3, K('red', 2))
    b.disc(x0 + 33, 83, 2, K('gold', 3)); b.set(x0 + 33, 83, K('gold', 1)); b.disc(x0 + 37, 84, 1, K('gold', 2))
    # coffre d'or et lanternes
    b.rect(x1 - 4, 95, 7, 5, K('wood', 2)); b.hline(x1 - 4, x1 + 2, 95, K('gold', 3)); b.rect(x1 - 3, 93, 5, 2, K('gold', 3)); b.set(x1 - 1, 92, K('gold', 4))
    for lx in (x0 + 19, x0 + 36):
        b.vline(lx, 86, 87, K('iron', 1)); b.rect(lx - 1, 88, 3, 3, K('iron', 0)); b.set(lx, 89, K('flame', 2))
    return b, (4, 44, 64, 58)


def taverne():
    b = Canvas(W, H)
    x0, x1 = 156, 208
    # cheminée de pierre (fumée animée)
    rubble(b, 196, 30, 7, 16, 'stone', 3); b.hline(195, 203, 30, K('stone', 4)); b.hline(195, 203, 31, K('stone', 1))
    thatch(b, x0 - 4, 38, x1 - x0 + 8, 22, 3, taper=5)
    # pignon : colombages
    b.rect(x0, 60, x1 - x0, 36, K('plaster', 3))
    for xx in (x0, x0 + 12, x0 + 26, x0 + 39, x1 - 1):
        b.vline(xx, 60, 95, K('wood', 1)); b.vline(xx + 1, 60, 95, K('wood', 2))
    for yy in (60, 77, 95):
        b.hline(x0, x1 - 1, yy, K('wood', 1))
    b.line(x0 + 2, 61, x0 + 11, 76, K('wood', 2)); b.line(x0 + 28, 76, x0 + 38, 61, K('wood', 2)); b.line(x0 + 41, 61, x1 - 2, 76, K('wood', 2))
    window(b, x0 + 4, 65, 6, 6, 'wood', box=True); window(b, x0 + 16, 64, 7, 7, 'wood', box=True); window(b, x0 + 30, 65, 6, 6, 'wood', box=True); window(b, x0 + 43, 65, 6, 6, 'wood', box=True)
    window(b, x0 + 4, 82, 7, 7, 'wood'); window(b, x0 + 41, 82, 7, 7, 'wood')
    # porte ouverte : lumière chaude
    b.rect(x0 + 17, 80, 14, 16, K('wood', 1))
    b.rect(x0 + 18, 82, 12, 14, K('interior', 1)); b.rect(x0 + 22, 84, 7, 12, K('interior', 2)); b.rect(x0 + 18, 82, 4, 14, K('wood', 3)); b.vline(x0 + 21, 82, 95, K('wood', 2))
    for i in range(2): b.set(x0 + 17 + i, 80, '.'); b.set(x0 + 30 - i, 80, '.')
    b.hline(x0 + 22, x0 + 29, 82, K('interior', 3)); b.rect(x0 + 24, 86, 3, 4, K('interior', 3))
    # enseigne : chope sur potence
    b.hline(x0 - 9, x0, 70, K('iron', 1)); b.line(x0 - 1, 70, x0 - 1, 74, K('iron', 1)); b.line(x0 - 7, 70, x0 - 1, 74, K('iron', 1))
    b.vline(x0 - 8, 71, 72, K('iron', 1))
    b.rect(x0 - 12, 73, 9, 9, K('wood', 2)); b.frame(x0 - 12, 73, 9, 9, K('wood', 1))
    b.rect(x0 - 10, 75, 4, 5, K('gold', 3)); b.set(x0 - 6, 76, K('gold', 2)); b.set(x0 - 6, 77, K('gold', 2)); b.hline(x0 - 10, x0 - 7, 75, K('bone', 3)); b.set(x0 - 9, 74, K('bone', 3))
    # tonneaux et banc
    for (bx, by) in ((x1 + 1, 88), (x1 + 1, 81), (x1 + 6, 88)):
        b.rect(bx, by, 5, 7, K('wood', 3)); b.vline(bx, by, by + 6, K('wood', 2)); b.vline(bx + 4, by, by + 6, K('wood', 2))
        b.hline(bx, bx + 4, by + 1, K('iron', 2)); b.hline(bx, bx + 4, by + 5, K('iron', 2)); b.set(bx + 1, by + 2, K('wood', 5))
    b.rect(x0 + 4, 97, 10, 2, K('wood', 3)); b.vline(x0 + 5, 98, 99, K('wood', 1)); b.vline(x0 + 12, 98, 99, K('wood', 1))
    return b, (142, 30, 74, 70)


def tour():
    b = Canvas(W, H)
    tx, tw = 20, 22
    # toit conique de tuiles
    for r in range(14):
        hw = 2 + r * (tw // 2 + 3) // 14
        for xx in range(tx + tw // 2 - hw, tx + tw // 2 + hw):
            k = 4 if xx < tx + tw // 2 - hw // 2 else (3 if xx < tx + tw // 2 + hw // 3 else 2)
            b.set(xx, 112 + r, K('tile', k - (1 if r % 3 == 2 else 0)))
    b.vline(tx + tw // 2, 106, 112, K('iron', 2))                                     # mât (drapeau animé)
    # galerie de guet en bois (hourds)
    b.rect(tx - 3, 126, tw + 6, 8, K('wood', 3)); planks_v(b, tx - 3, 127, tw + 6, 6, 'wood', 3, 3)
    b.hline(tx - 4, tx + tw + 3, 126, K('wood', 1)); b.hline(tx - 4, tx + tw + 3, 133, K('wood', 1))
    for xx in range(tx - 2, tx + tw + 3, 5): b.vline(xx, 134, 136, K('wood', 1))       # corbeaux
    b.rect(tx + 4, 128, 3, 3, K('ink')); b.rect(tx + 15, 128, 3, 3, K('ink'))
    # fût de pierre
    bricks(b, tx, 134, tw, 54, 'stone', 3, 6, 3)
    b.vline(tx, 134, 187, K('stone', 4)); b.vline(tx + 1, 134, 187, K('stone', 4)); b.vline(tx + tw - 1, 134, 187, K('stone', 1)); b.vline(tx + tw - 2, 134, 187, K('stone', 2))
    for yy in (142, 156):                                                            # meurtrières
        b.rect(tx + 10, yy, 2, 6, K('ink')); b.set(tx + 9, yy + 2, K('ink')); b.set(tx + 12, yy + 2, K('ink'))
    window(b, tx + 8, 168, 5, 5, 'stone', arch=True)
    door(b, tx + 7, 178, 8, 10, 'wood', 2, arch=True, studs=True)
    # poste de garde
    gx = 44
    shingles(b, gx - 2, 160, 30, 9, 'wood', 3, 3, 2, taper=3)
    rubble(b, gx, 169, 26, 19, 'stone', 3)
    window(b, gx + 4, 173, 6, 5, 'wood'); door(b, gx + 15, 176, 7, 12, 'wood', 2, arch=False)
    # râtelier de lances et brasero (flamme animée)
    b.hline(gx + 28, gx + 33, 178, K('wood', 2)); b.hline(gx + 28, gx + 33, 185, K('wood', 2))
    for xx in (gx + 29, gx + 31, gx + 33):
        b.vline(xx, 172, 187, K('wood', 3)); b.set(xx, 171, K('iron', 3)); b.set(xx, 170, K('iron', 2))
    b.rect(8, 182, 7, 3, K('iron', 1)); b.vline(9, 185, 188, K('iron', 1)); b.vline(13, 185, 188, K('iron', 1)); b.hline(8, 14, 182, K('iron', 3))
    # botte de paille et cible
    b.disc(66, 192, 3, K('thatch', 3), 2); b.disc(66, 191, 1, K('red', 3)); b.set(66, 191, K('bone', 3))
    return b, (6, 104, 70, 90)


def planque():
    b = Canvas(W, H)
    x0, x1 = 160, 198
    # toit de bardeaux affaissé, troué, moussu
    for r in range(13):
        sag = int(2 * math.sin(math.pi * r / 13))
        for xx in range(x0 - 3, x1 + 3):
            k = (xx + (r // 2) * 2) % 5
            y = 140 + r + (1 if x0 + 10 < xx < x1 - 8 and r > 2 else 0)
            b.set(xx, y, K('wood', 1 if k == 0 else (2 if r % 2 else 3)))
    for (mx, my) in ((x0 + 2, 142), (x0 + 3, 142), (x0 + 20, 144), (x0 + 21, 145), (x1 - 4, 141), (x0 + 12, 148)):
        b.set(mx, my, K('moss', 2)); b.set(mx + 1, my, K('moss', 1))
    b.rect(x0 + 26, 144, 3, 2, K('ink'))                                                 # trou
    b.hline(x0 - 3, x1 + 2, 153, K('wood', 0))
    # murs de planches de travers
    planks_v(b, x0, 154, x1 - x0, 34, 'wood', 2, 3, crooked=1)
    b.rect(x0 + 24, 160, 6, 5, K('wood', 4)); b.frame(x0 + 24, 160, 6, 5, K('wood', 1))      # rustine
    # fenêtre condamnée
    b.rect(x0 + 4, 160, 9, 8, K('ink'))
    for yy in (161, 164, 166): b.hline(x0 + 3, x0 + 13, yy, K('wood', 3))
    b.line(x0 + 3, 167, x0 + 13, 160, K('wood', 4))
    # porte basse cadenassée
    b.rect(x0 + 15, 170, 8, 18, K('wood', 0)); planks_v(b, x0 + 16, 171, 6, 17, 'wood', 1, 2)
    b.hline(x0 + 15, x0 + 22, 175, K('iron', 2)); b.hline(x0 + 15, x0 + 22, 183, K('iron', 2)); b.rect(x0 + 20, 178, 2, 2, K('gold', 1))
    # avis de recherche
    b.rect(x0 + 27, 171, 6, 7, K('bone', 3)); b.rect(x0 + 28, 172, 4, 3, K('bone', 1)); b.hline(x0 + 28, x0 + 31, 176, K('bone', 1))
    # caisses, sac, trappe
    for (cx, cy) in ((x1 + 1, 178), (x1 + 1, 171), (x1 + 7, 182)):
        b.rect(cx, cy, 7, 7, K('wood', 3)); b.frame(cx, cy, 7, 7, K('wood', 1)); b.line(cx, cy, cx + 6, cy + 6, K('wood', 1))
    b.disc(x0 - 4, 185, 3, K('sand', 3), 3); b.set(x0 - 4, 182, K('sand', 1))
    b.rect(x0 + 3, 189, 10, 5, K('wood', 2)); b.frame(x0 + 3, 189, 10, 5, K('wood', 0)); b.set(x0 + 10, 191, K('iron', 3))
    return b, (152, 136, 62, 60)


def cimetiere():
    b = Canvas(W, H)
    x0, y0, x1, y1 = 8, 214, 100, 288
    # crypte gothique
    cx = 12
    for r in range(12):
        b.hline(cx + 12 - r, cx + 13 + r, 210 + r, K('slate', 2 if r % 3 else 1))
    b.hline(cx, cx + 25, 222, K('stone', 1))
    bricks(b, cx, 223, 26, 22, 'stone', 3, 5, 3)
    b.rect(cx + 9, 230, 8, 15, K('ink')); b.rect(cx + 10, 231, 6, 14, K('iron', 1))
    for xx in range(cx + 10, cx + 16, 2): b.vline(xx, 231, 244, K('iron', 3))
    for i in range(2): b.set(cx + 9 + i, 229, '.'); b.set(cx + 16 - i, 229, '.')
    b.disc(cx + 13, 226, 2, K('glass', 1)); b.set(cx + 12, 225, K('glass', 3))
    # ange de pierre
    b.rect(cx + 12, 203, 3, 7, K('stone', 4)); b.disc(cx + 13, 202, 1, K('stone', 4))
    b.line(cx + 11, 205, cx + 8, 202, K('stone', 3)); b.line(cx + 15, 205, cx + 18, 202, K('stone', 3))
    # tombes
    graves = [(42, 222, 'r'), (56, 220, 'c'), (70, 223, 'r'), (84, 221, 'c'), (44, 242, 'c'), (58, 244, 'r'), (72, 241, 'r'), (86, 245, 'c'),
              (16, 254, 'r'), (30, 258, 'c'), (48, 262, 'r'), (64, 264, 'c'), (80, 262, 'r')]
    for gx, gy, kind in graves:
        b.rect(gx - 1, gy + 9, 9, 3, K('grass', 1)); b.hline(gx, gx + 6, gy + 9, K('grass', 3))
        if kind == 'r':
            b.rect(gx, gy, 7, 9, K('stone', 3)); b.vline(gx + 6, gy, gy + 8, K('stone', 2)); b.vline(gx, gy, gy + 8, K('stone', 4))
            b.hline(gx + 1, gx + 5, gy - 1, K('stone', 4)); b.set(gx, gy, '.'); b.set(gx + 6, gy, '.')
            b.hline(gx + 2, gx + 4, gy + 3, K('stone', 1)); b.hline(gx + 2, gx + 4, gy + 5, K('stone', 1))
            if R.random() < .5: b.set(gx + 1, gy + 8, K('moss', 2)); b.set(gx + 2, gy + 8, K('moss', 1))
        else:
            b.rect(gx + 2, gy - 1, 3, 10, K('stone', 3)); b.rect(gx, gy + 2, 7, 3, K('stone', 3))
            b.vline(gx + 4, gy - 1, gy + 8, K('stone', 2)); b.hline(gx, gx + 6, gy + 4, K('stone', 2))
    # arbre mort tordu (corbeau animé)
    for (a, bb, c2, d) in ((96, 286, 96, 258), (96, 268, 88, 256), (96, 262, 104, 252), (88, 256, 84, 252), (104, 252, 108, 248), (96, 258, 98, 250)):
        b.line(a, bb, c2, d, K('bark', 1)); b.line(a + 1, bb, c2 + 1, d, K('bark', 2))
    # muret et grille
    b.rect(x0, y1 - 4, x1 - x0 - 6, 5, K('stone', 2)); bricks(b, x0, y1 - 4, x1 - x0 - 6, 5, 'stone', 2, 4, 2)
    for xx in range(x0 + 1, x1 - 8, 3):
        b.vline(xx, y1 - 9, y1 - 5, K('iron', 1)); b.set(xx, y1 - 10, K('iron', 3))
    b.hline(x0, x1 - 8, y1 - 8, K('iron', 1))
    return b, (4, 198, 106, 92)


def maison():
    b = Canvas(W, H)
    x0, x1 = 160, 200
    rubble(b, 186, 214, 6, 14, 'stone', 3); b.hline(185, 192, 214, K('stone', 4))       # cheminée (fumée animée)
    thatch(b, x0 - 5, 222, x1 - x0 + 10, 22, 3, taper=6)
    # lucarne ronde dans le chaume
    b.disc(170, 232, 4, K('thatch', 4), 3); b.disc(170, 233, 2, K('glass', 1)); b.set(169, 232, K('glass', 3)); b.set(170, 233, K('glass', 2))
    # soubassement de pierre + torchis à colombages
    b.rect(x0, 244, x1 - x0, 22, K('plaster', 3))
    for xx in (x0, x0 + 13, x0 + 27, x1 - 1): b.vline(xx, 244, 265, K('wood', 2))
    b.hline(x0, x1 - 1, 244, K('wood', 1)); b.hline(x0, x1 - 1, 254, K('wood', 2))
    rubble(b, x0, 262, x1 - x0, 6, 'stone', 3)
    window(b, x0 + 4, 247, 6, 5, 'wood', shutters=True, box=True); window(b, x0 + 30, 247, 6, 5, 'wood', shutters=True, box=True)
    # porte ronde verte
    b.disc(x0 + 20, 259, 5, K('stone', 2), 6); b.rect(x0 + 15, 259, 11, 9, K('stone', 2))
    b.disc(x0 + 20, 259, 4, K('green', 2), 5); b.rect(x0 + 16, 259, 9, 9, K('green', 2))
    for xx in (x0 + 18, x0 + 20, x0 + 22): b.vline(xx, 255, 267, K('green', 1))
    b.set(x0 + 23, 262, K('gold', 3))
    # potager et barrière
    for row in range(3):
        for xx in range(x0 - 8, x0 + 12, 3):
            b.set(xx, 274 + row * 4, K('leaf', 4)); b.set(xx + 1, 274 + row * 4, K('leaf', 3)); b.set(xx, 275 + row * 4, K('dirt', 1))
            if R.random() < .3: b.set(xx + 1, 273 + row * 4, K('flower', 0))
    for xx in range(x0 - 10, x1 + 10, 3):
        if x0 + 16 <= xx <= x0 + 24: continue
        b.vline(xx, 284, 288, K('plaster', 4)); b.set(xx, 283, K('plaster', 3))
    b.hline(x0 - 10, x0 + 15, 286, K('plaster', 2)); b.hline(x0 + 25, x1 + 9, 286, K('plaster', 2))
    # puits
    b.disc(x1 + 6, 274, 4, K('stone', 3), 3); b.disc(x1 + 6, 274, 2, K('water', 0), 1)
    b.vline(x1 + 2, 264, 273, K('wood', 2)); b.vline(x1 + 10, 264, 273, K('wood', 2)); b.hline(x1 + 1, x1 + 11, 264, K('wood', 3)); b.hline(x1 + 1, x1 + 11, 263, K('tile', 3))
    return b, (148, 210, 66, 82)


def fountain(c):
    cx, cy = 108, 158
    c.disc(cx, cy, 17, INK, 10); c.disc(cx, cy, 16, K('stone', 2), 9); c.disc(cx, cy - 1, 15, K('stone', 4), 8)
    c.disc(cx, cy, 13, K('water', 1), 7); c.disc(cx, cy - 1, 12, K('water', 2), 6)
    # socle central (la statue et l'eau sont animées par-dessus)
    c.disc(cx, cy, 4, K('stone', 1), 2); c.disc(cx, cy - 1, 3, K('stone', 3), 2)


TREES_ROUND = [(84, 112), (134, 110), (206, 128), (122, 206), (110, 290), (206, 300), (12, 30), (58, 124), (150, 202), (196, 202)]
TREES_PINE = [(4, 112), (4, 300), (54, 296), (212, 216), (148, 130), (60, 30)]
LANTERNS = [(80, 132), (138, 132), (76, 182), (142, 182)]


def pine(c, x, y):
    c.rect(x - 1, y - 2, 3, 4, K('bark', 1))
    for r in range(16):
        hw = 1 + (r % 5) + r // 5
        for xx in range(x - hw, x + hw + 1):
            k = 3 if xx < x - hw // 2 else (2 if xx <= x + hw // 3 else 1)
            c.set(xx, y - 18 + r, K('leaf', k - (1 if r % 5 == 4 else 0)))
    c.set(x, y - 19, K('leaf', 4))


def build(save):
    g = ground()
    # sol éclairé par les lanternes (même couleur le jour)
    for lx, ly in LANTERNS:
        for y in range(ly - 14, ly + 10):
            for x in range(lx - 14, lx + 15):
                if (x - lx - 2) ** 2 + ((y - ly + 3) * 1.25) ** 2 <= 130:
                    name = CHAR_INV.get(g.get(x, y))
                    if name and name[0] in ('cobble', 'grass', 'dirt'):
                        g.set(x, y, LAMP[name])
    layers, spots = [], {}
    for lid, fn in (('mairie', mairie), ('casino', tripot), ('taverne', taverne), ('poste_garde', tour),
                    ('planque', planque), ('cimetiere', cimetiere), ('maison', maison)):
        b, rect = fn()
        b.outline(INK)
        layers.append(b); spots[lid] = rect
    deco = Canvas(W, H)
    for x, y in TREES_PINE:
        pine(deco, x, y)
    for x, y in TREES_ROUND:                    # troncs seulement ; feuillage animé
        deco.rect(x - 1, y - 6, 3, 8, K('bark', 1)); deco.vline(x - 1, y - 6, y + 1, K('bark', 2))
        deco.set(x - 2, y + 1, K('bark', 1)); deco.set(x + 2, y + 1, K('bark', 0))
    for lx, ly in LANTERNS:
        lantern_post(deco, lx, ly)
    # étal du marché (place) et panneau d'affichage (près de la mairie)
    st = Canvas(W, H)
    for xx in range(126, 146):
        st.vline(xx, 186, 189, K('red', 3) if (xx // 3) % 2 else K('bone', 3))
    st.rect(127, 190, 18, 5, K('wood', 3)); st.vline(127, 190, 198, K('wood', 1)); st.vline(144, 190, 198, K('wood', 1))
    for xx in range(129, 143, 3): st.disc(xx, 189, 1, K('flower', R.choice((0, 1, 3))))
    st.rect(84, 92, 12, 9, K('wood', 3)); st.frame(84, 92, 12, 9, K('wood', 1)); st.vline(86, 101, 104, K('wood', 1)); st.vline(93, 101, 104, K('wood', 1))
    for (px_, py_) in ((86, 94), (90, 95), (86, 97)): st.rect(px_, py_, 3, 2, K('bone', 3))
    deco.outline(INK); st.outline(INK)
    for L in layers + [deco, st]:
        cast_shadow(g, L)
    for x, y in TREES_ROUND:                    # ombre ronde sous le feuillage
        for yy in range(y - 2, y + 4):
            for xx in range(x - 8, x + 10):
                if ((xx - x - 2) / 9) ** 2 + ((yy - y - 1) / 3) ** 2 <= 1:
                    name = CHAR_INV.get(g.get(xx, yy))
                    if name and name[0] in ('grass', 'dirt', 'cobble'):
                        g.set(xx, yy, K(name[0], max(0, name[1] - 1)))
    fountain(g)
    for L in [deco, st] + layers:
        compose(g, L)
    for mode, pal in (('day', COLOR_DAY), ('night', COLOR_NIGHT)):
        save(g.render(pal), f'village2/base_{mode}.png')
    # zones cliquables
    ts = ['// Fichier généré par tools/px/village2.py : ne pas modifier à la main.',
          '// Repère : 864 x 1224 (image 216 x 306 agrandie x4). poly = contour, c = centre, i = bouton règles, l = étiquette.',
          'export const VILLAGE_SIZE = { w: 864, h: 1224 }',
          'export const VILLAGE_SPOTS: Record<string, { poly: string; c: [number, number]; i: [number, number]; l: [number, number] }> = {']
    labels = {'mairie': (108, 80), 'casino': (34, 106), 'taverne': (182, 104), 'poste_garde': (34, 198), 'planque': (178, 200),
              'cimetiere': (52, 296), 'maison': (180, 296)}
    for lid, (x, y, w, h) in spots.items():
        X, Y, Wd, Hd = x * S, y * S, w * S, h * S
        poly = f'{X},{Y} {X + Wd},{Y} {X + Wd},{Y + Hd} {X},{Y + Hd}'
        lx, ly = labels[lid]
        ts.append(f"  {lid}: {{ poly: '{poly}', c: [{X + Wd // 2}, {Y + Hd // 2}], i: [{min(X + Wd - 28, 836)}, {max(Y + 28, 28)}], l: [{lx * S}, {ly * S}] }},")
    ts.append('}')
    (ROOT / 'src' / 'data' / 'villageSpots.ts').write_text('\n'.join(ts) + '\n', encoding='utf8')
    return g
