"""Mini-pipeline pixel art : des grilles de texte -> PNG (1x) dans public/px/.
Chaque lettre d'une grille est une couleur de la palette ('.' = transparent).
Relancer : python3 tools/px/build.py  (depuis la racine du dépôt)
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'public' / 'px'

# Palette commune (sépia / nuit, inspirée de l'ambiance Wonderhop)
INK = '#1b1410'       # contour
PAPER = '#f1e6cc'     # crème
SAND = '#d9b98a'
GOLD = '#e6c25a'
GOLD_D = '#a8842b'
BLOOD = '#a84a44'
NIGHT = '#101820'
SEA = '#2f5068'
MOSS = '#2e6a5f'
PINK = '#e58a9a'
WHITE = '#fbf7ee'


def hex2rgba(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4)) + (255,)


def overlay(base, layers):
    """base : liste de str ; layers : liste de dict {row: str} ou liste de str. '.' = inchangé."""
    rows = [list(r) for r in base]
    for layer in layers:
        items = layer.items() if isinstance(layer, dict) else enumerate(layer)
        for y, s in items:
            for x, c in enumerate(s):
                if c != '.':
                    rows[y][x] = c
    return [''.join(r) for r in rows]


def render(grid, palette):
    h = len(grid); w = max(len(r) for r in grid)
    im = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    px = im.load()
    for y, row in enumerate(grid):
        for x, c in enumerate(row):
            if c == '.' or c == ' ':
                continue
            if c not in palette:
                raise KeyError(f'couleur inconnue {c!r} ligne {y}')
            px[x, y] = hex2rgba(palette[c])
    return im


def strip(frames):
    """Concatène des frames (même taille) horizontalement."""
    w, h = frames[0].size
    im = Image.new('RGBA', (w * len(frames), h), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        im.paste(f, (i * w, 0))
    return im


def save(im, rel):
    p = OUT / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    im.save(p, optimize=True)
    return p


def shade(hexc, k):
    """Assombrit (k<1) ou éclaircit (k>1) une couleur."""
    r, g, b, _ = hex2rgba(hexc)
    f = lambda v: max(0, min(255, int(v * k) if k < 1 else int(v + (255 - v) * (k - 1))))
    return '#%02x%02x%02x' % (f(r), f(g), f(b))
