"""Les 10 avatars : visage 16x16 (menu) et bonhomme 16x24 (carte, 2 frames)."""
from px import INK, WHITE, PINK, GOLD, overlay, shade

# Lettres : k contour, b base, d ombre, l lumière, w blanc, e œil, p nez/rose, x accent, y accent 2
HEAD = [
    '................',
    '................',
    '....kkkkkkkk....',
    '...kbbbbbbbbk...',
    '..kbbbbbbbbbbk..',
    '..kbbbbbbbbbbk..',
    '..kbbbbbbbbbbk..',
    '..kbbbbbbbbbbk..',
    '..kbbbbbbbbbbk..',
    '..kbbbbbbbbbbk..',
    '..kbbbbbbbbbbk..',
    '...kbbbbbbbbk...',
    '....kkkkkkkk....',
    '................',
    '................',
    '................',
]
EYES = {6: '.....e....e.....', 7: '.....e....e.....'}
EYES_BLINK = {6: '................', 7: '.....e....e.....'}

# Corps commun (lignes 13-23 du bonhomme), la tête = lignes 0-12 du visage décalées
BODY = {
    13: '.....kbbbbbk....',
    14: '....kbblllbbk...',
    15: '...kbkblllbkbk..',
    16: '...kbkblllbkbk..',
    17: '...kkkbbbbbkkk..',
    18: '.....kbbbbbk....',
    19: '.....kkkkkkk....',
    20: '.....kdk.kdk....',
    21: '.....kdk.kdk....',
    22: '....kkkk.kkkk...',
    23: '................',
}

A = {}

A['renard'] = dict(
    name='Renard', b='#e8893a', x=WHITE, y='#b8601f',
    face=[{0: '..k.........k...', 1: '..kbk.......kbk.', 2: '..kbyk.....kybk.', 3: '..kbbbk...kbbbk.'},
          {8: '.....wwwwww.....', 9: '....wwwwkkwwww..', 10: '....wwwwwwwwww..', 11: '.....wwwwwwww...'}],
)
A['pieuvre'] = dict(
    name='Pieuvre', b='#d65aa0', x='#f5b3d6', y='#9c3a74',
    face=[{9: '.......pp.......'}, {4: '....x..x..x..x..', 5: '....x..x..x..x..'},
          {12: '....kkkkkkkk....', 13: '...kbkbkbkbkbk..', 14: '...kbk.kbk.kbk..', 15: '...kkk.kkk.kkk..'}],
)
A['hibou'] = dict(
    name='Hibou', b='#a8763e', x='#f2d8a8', y='#6b4520',
    face=[{1: '..k..........k..', 2: '..kkk......kkk..', 3: '...kyk....kyk...'},
          {5: '...wwwww.wwwww..', 6: '...wweww.wweww..', 7: '...wweww.wweww..', 8: '...wwwww.wwwww..', 9: '.......xx.......', 10: '.......x........'},
          {11: '...kxxxxxxxxk...'}],
    eyes=False,
)
A['grenouille'] = dict(
    name='Grenouille', b='#4caf50', x='#9be39f', y='#2e7d32',
    face=[{0: '...kkk....kkk...', 1: '..kbbbk..kbbbk..', 2: '..kbebk..kbebk..', 3: '..kbbbkkkkbbbk..'},
          {9: '....kkkkkkkk....', 10: '.....xxxxxx.....', 11: '...kxxxxxxxxk...'}],
    eyes=False,
)
A['loup'] = dict(
    name='Loup', b='#7d8a99', x='#c9d3dc', y='#525c69',
    face=[{0: '..k.........k...', 1: '..kbk.......kbk.', 2: '..kbyk.....kybk.', 3: '..kbbbk...kbbbk.'},
          {8: '.....xxxxxx.....', 9: '....xxxxkkxxxx..', 10: '....xxxxxxxxxx..', 11: '.....xxxxxxxx...'},
          {5: '..kbbbbbbbbbbk..'}],
)
A['licorne'] = dict(
    name='Licorne', b='#f4ecf8', x='#b46ad6', y=GOLD,
    face=[{0: '.......y........', 1: '......kyk.......', 2: '.....kyyyk......'},
          {3: '...kxxxxxxxxk...', 4: '..kxxbbbbbbxxk..', 5: '..kxbbbbbbbbxk..', 6: '..kxbbbbbbbbbk..'},
          {9: '.......pp.......', 10: '......kppk......'}],
)
A['tigre'] = dict(
    name='Tigre', b='#e9a23b', x='#ffd27a', y='#b36e14',
    face=[{0: '...kkk....kkk...', 1: '..kbbbk..kbbbk..', 2: '..kbkbkkkkbkbk..'},
          {4: '..kbbkbbbbkbbk..', 5: '..kbkbbkkbbkbk..'},
          {8: '.....xxxxxx.....', 9: '....xxxxkkxxxx..', 10: '....xxxxxxxxxx..', 11: '.....xxxxxxxx...'}],
)
A['dauphin'] = dict(
    name='Dauphin', b='#4aa8d8', x='#c6ecfa', y='#2a6f9c',
    face=[{0: '.......kk.......', 1: '......kbbk......', 2: '.....kbbbbk.....'},
          {8: '....xxxxxxxxx...', 9: '...xxxxxxxxxxxk.', 10: '....xxxxxxxxx...', 11: '.....xxxxxxx....'},
          {9: '.......kk.......'}],
)
A['raton'] = dict(
    name='Raton', b='#8f8a84', x='#d6d1ca', y='#2a2622',
    face=[{0: '..kkk.....kkk...', 1: '..kyyk...kyyk...', 2: '..kbyk...kybk...'},
          {5: '...yyyy..yyyy...', 6: '...yyeyy.yyeyy..', 7: '...yyeyy.yyeyy..', 8: '....yyy..yyy....'},
          {9: '.....xxxxxx.....', 10: '....xxxxkkxxxx..', 11: '.....xxxxxxxx...'}],
    eyes=False,
)
A['dragon'] = dict(
    name='Dragon', b='#c93b3b', x=GOLD, y='#8d1f1f',
    face=[{0: '..kk.......kk...', 1: '..kxk.....kxk...', 2: '..kxxk...kxxk...', 3: '...kxxk.kxxk....'},
          {8: '....yyyyyyyy....', 9: '....ykykykyky...', 10: '....yyyyyyyy....', 11: '...kyyyyyyyyk...'},
          {5: '......y..y......'}],
)


def palette(a):
    return {'k': INK, 'b': a['b'], 'd': shade(a['b'], 0.72), 'l': shade(a['b'], 1.35), 'w': WHITE,
            'e': INK, 'p': PINK, 'x': a['x'], 'y': a['y']}


def face_grid(a, blink=False):
    layers = []
    if a.get('eyes', True):
        layers.append(EYES_BLINK if blink else EYES)
    layers += a['face']
    return overlay(HEAD, layers)


def body_grid(a, frame=0):
    """Tête du visage posée sur le corps ; frame 1 = tête qui descend d'1 px + clignement."""
    face = face_grid(a, blink=(frame == 1))[0:13]
    grid = ['.' * 16] * 24
    shift = frame  # 0 ou 1
    head = {y + shift: row for y, row in enumerate(face)}
    body = dict(BODY)
    return overlay(grid, [body, head])
