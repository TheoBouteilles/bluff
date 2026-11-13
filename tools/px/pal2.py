"""Palette de la carte v2 : rampes par matériau (du plus sombre au plus clair).
Chaque teinte reçoit un caractère ; le dessin utilise K('stone', 2) -> caractère.
NIGHT_LIT : teintes qui s'allument la nuit (fenêtres, flammes, sol des lanternes)."""

RAMPS = {
    'ink':    ['#1f1712'],
    'grass':  ['#2c5228', '#3b6c31', '#4f873b', '#6aa24a', '#8fc163'],
    'dirt':   ['#5e4530', '#7d5d3e', '#9c7b52', '#bb9b6c', '#d6bb8a'],
    'cobble': ['#4f4a44', '#6b655c', '#8a8376', '#aaa293', '#c8c1b0'],
    'stone':  ['#3f3f48', '#575761', '#73737c', '#93939a', '#b7b7bb', '#d6d6d8'],
    'sand':   ['#5f4f3e', '#806b54', '#a28b6d', '#c3ac8a', '#ddc9a6', '#efe2c4'],
    'plaster':['#8f7d5f', '#b4a17e', '#d3c29c', '#ece0c0', '#f8f0da'],
    'wood':   ['#2e1d12', '#4a301d', '#6a462b', '#8a5f3b', '#ab7c50', '#c99a6a'],
    'slate':  ['#1e2738', '#2c3a52', '#3e5070', '#56698c', '#7387a8', '#97a8c2'],
    'tile':   ['#4a1914', '#6e251d', '#94352a', '#b84b3a', '#d66c55', '#eb9478'],
    'thatch': ['#5a421d', '#7c5c28', '#a07a36', '#c39a49', '#ddb966', '#f0d58c'],
    'purple': ['#26142f', '#3d2150', '#5a3274', '#7a4a96', '#9c6bb5'],
    'gold':   ['#5e4410', '#946d1f', '#c99a30', '#e6c25a', '#fbe79a'],
    'red':    ['#4a1010', '#7a1d1a', '#a82e26', '#cf4a3a', '#ea7a62'],
    'blue':   ['#142238', '#1f3a60', '#2e5890', '#4a7cbc', '#7aa6dc'],
    'green':  ['#16301f', '#22492e', '#2f6340', '#468257'],
    'glass':  ['#22394a', '#3d6680', '#76a9c2', '#bfe0ee'],
    'water':  ['#173f5e', '#245e86', '#3a85b3', '#68b2d8', '#a8dcf0', '#e8f8ff'],
    'leaf':   ['#16301a', '#224624', '#2f5f2e', '#40793a', '#589648', '#78b25a'],
    'bark':   ['#2a1a10', '#45301e', '#634530'],
    'iron':   ['#18181d', '#2c2c35', '#45454f', '#62626e'],
    'flower': ['#d64f4a', '#f2cf4a', '#f3eee4', '#e58aa8', '#7a96e0', '#b36ad6'],
    'flame':  ['#a8401a', '#e8792a', '#ffb43a', '#fff0b0'],
    'bone':   ['#7d776c', '#a8a297', '#cfcabf', '#ece8de'],
    'moss':   ['#2f4d26', '#45692f', '#5f8a3a'],
    'interior': ['#24170f', '#33231a', '#463224', '#5a4231'],
    'shadow': ['#1a2a1c'],  # remplacé à la volée par la teinte sombre du sol
}

NIGHT_LIT = {
    'glass': ['#7a3e10', '#c87a1e', '#ffc24d', '#ffe9a0'],
    'flame': ['#c8501a', '#ff9a2a', '#ffd04a', '#fff6c8'],
    'gold':  ['#4a3a1a', '#7a6030', '#b8923e', '#e0bd62', '#f6dd94'],
    'interior': ['#a0561a', '#d88a2a', '#ffc04a', '#ffe08a'],
}

POOL = [chr(c) for c in range(0x21, 0x7f) if chr(c) not in '.\\\'"`'] + [chr(c) for c in range(0xc0, 0x17f)]

CHAR = {}
COLOR_DAY = {}
_i = 0
for name, ramp in RAMPS.items():
    for j, col in enumerate(ramp):
        ch = POOL[_i]; _i += 1
        CHAR[(name, j)] = ch
        COLOR_DAY[ch] = col


def K(name, j=0):
    ramp = RAMPS[name]
    j = max(0, min(len(ramp) - 1, j))
    return CHAR[(name, j)]


def _night(hexc):
    h = hexc.lstrip('#'); r, g, b = (int(h[i:i + 2], 16) for i in (0, 2, 4))
    # clair de lune : on assombrit, on désature et on tire vers le bleu
    lum = 0.30 * r + 0.59 * g + 0.11 * b
    r2 = r * 0.26 + lum * 0.08 + 16
    g2 = g * 0.26 + lum * 0.10 + 20
    b2 = b * 0.34 + lum * 0.14 + 50
    return '#%02x%02x%02x' % (int(min(255, r2)), int(min(255, g2)), int(min(255, b2)))


COLOR_NIGHT = {}
for (name, j), ch in CHAR.items():
    if name == 'ink':
        COLOR_NIGHT[ch] = '#0e0c12'
    elif name in NIGHT_LIT:
        COLOR_NIGHT[ch] = NIGHT_LIT[name][min(j, len(NIGHT_LIT[name]) - 1)]
    else:
        COLOR_NIGHT[ch] = _night(RAMPS[name][j])

# sol éclairé par les lanternes (nuit) : caractères dédiés, identiques au sol le jour
LAMP = {}
for base in ('cobble', 'grass', 'dirt'):
    for j, col in enumerate(RAMPS[base]):
        ch = POOL[_i]; _i += 1
        LAMP[(base, j)] = ch
        COLOR_DAY[ch] = col
        h = col.lstrip('#'); r, g, b = (int(h[i:i + 2], 16) for i in (0, 2, 4))
        COLOR_NIGHT[ch] = '#%02x%02x%02x' % (int(r * 0.42 + 34), int(g * 0.36 + 28), int(b * 0.28 + 26))
CHAR_INV = {v: k for k, v in CHAR.items()}
