"""Calques d'avatar personnalisé : tenues (couleur du haut) et accessoires de tête.
Ils se superposent aux sprites d'avatars (même taille : visage 16x16, bonhomme 16x24 en 2 images).
Indices alignés sur src/data/avatars.ts (TUNICS, ACCESSORIES) et sur clean_look() en SQL (t 0-7, a 0-6).
Génération : python3 tools/px/build_looks.py
"""
from px import INK, GOLD, PINK, overlay, shade
import avatars as av

# Tenues : 0 = naturelle (pas de calque)
TUNICS = [None, '#b03a3a', '#3a6fb0', '#3f8f4f', '#7a4aa8', '#d9a93a', '#33333d', '#e8e2d4']

# Accessoires, en coordonnées du visage (lignes 0 à 12) ; 0 = aucun
ACCESSORIES = [
    None,
    {  # 1 chapeau de feutre
        0: '.....kkkkkk.....',
        1: '....khhhhhhk....',
        2: '....krrrrrrk....',
        3: '..khhhhhhhhhhk..',
    },
    {  # 2 chapeau pointu
        0: '.......kk.......',
        1: '......kvvk......',
        2: '.....kvyvvk.....',
        3: '..kvvvvvvvvvvk..',
    },
    {  # 3 couronne
        0: '....k..kk..k....',
        1: '....kykyykyk....',
        2: '....kyyyyyyk....',
        3: '....kkkkkkkk....',
    },
    {  # 4 bandeau
        4: '..krrrrrrrrrrk..',
        5: '..............rr',
    },
    {  # 5 lunettes
        6: '....kggkkggk....',
        7: '....kggk.ggk....',
    },
    {  # 6 fleur
        1: '...........kpk..',
        2: '..........kpypk.',
        3: '...........kpk..',
    },
]

PAL = {'k': INK, 'h': '#6b4520', 'r': '#a84a44', 'v': '#6a3d9a', 'y': GOLD, 'g': '#22303f', 'p': PINK}

for layer in ACCESSORIES[1:]:
    for row in layer.values():
        assert len(row) == 16, row

EMPTY_FACE = ['.' * 16] * 16
EMPTY_BODY = ['.' * 16] * 24


def tunic_grid():
    """Haut du corps (lignes 13 à 18) : base -> o, lumière -> q ; le reste transparent."""
    rows = {}
    for y, row in av.BODY.items():
        if 13 <= y <= 18:
            rows[y] = ''.join({'b': 'o', 'l': 'q'}.get(c, '.') for c in row)
    return overlay(EMPTY_BODY, [rows])


def tunic_palette(color):
    return {'o': color, 'q': shade(color, 1.3)}


def acc_face(i):
    return overlay(EMPTY_FACE, [ACCESSORIES[i]])


def acc_body(i, frame=0):
    """Même décalage que la tête du bonhomme : frame 1 = tête descendue d'1 px."""
    return overlay(EMPTY_BODY, [{y + frame: row for y, row in ACCESSORIES[i].items()}])
