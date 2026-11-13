"""Logos de camp : blasons 32x32 (cartes, titres) + petites versions 12x12 (listes)."""
from canvas import Canvas
from px import INK, GOLD, GOLD_D, WHITE, shade

FIELD = {'villageois': '#3d6f93', 'saboteurs': '#a8352f', 'solitaires': '#2e7a66'}


def shield(field):
    """Blason : contour encre, liseré or, champ avec reflet à gauche et ombre à droite."""
    c = Canvas(32, 32)
    W, top, bottom = 26, 2, 30
    x0 = (32 - W) // 2
    def half(y):
        t = (y - top) / (bottom - top)
        if t < 0.52:
            return W / 2
        u = (t - 0.52) / 0.48
        return max(0.6, (W / 2) * (1 - u ** 1.7))
    for y in range(top, bottom + 1):
        hw = half(y)
        for x in range(32):
            if abs(x + 0.5 - 16) <= hw:
                c.set(x, y, 'f')
    # créneau décoratif en haut
    for x in (x0 + 4, 15, 16, x0 + W - 5):
        c.set(x, top, '.')
    # liseré or : pixels du champ touchant l'extérieur
    edge = [(x, y) for y in range(32) for x in range(32) if c.get(x, y) == 'f'
            and any(c.get(x + dx, y + dy) == '.' for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))]
    for x, y in edge:
        c.set(x, y, 'q')
    inner = [(x, y) for y in range(32) for x in range(32) if c.get(x, y) == 'f'
             and any(c.get(x + dx, y + dy) == 'q' for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))]
    for x, y in inner:
        c.set(x, y, 'Q')
    # reflet / ombre du champ
    for y in range(32):
        row = [x for x in range(32) if c.get(x, y) == 'f']
        if row:
            c.set(row[0], y, 'h'); c.set(row[0] + 1, y, 'h')
            c.set(row[-1], y, 's'); c.set(row[-1] - 1, y, 's')
    c.outline('k')
    return c


def glyph_house(c, ox, oy):
    g = Canvas(16, 16)
    for i in range(7):                     # toit
        g.hline(7 - i, 8 + i, 1 + i, 'w')
    g.rect(11, 1, 2, 4, 'w')                 # cheminée
    g.rect(2, 8, 12, 6, 'w')                 # mur
    g.rect(3, 9, 3, 2, 'y'); g.rect(10, 9, 3, 2, 'y')  # fenêtres éclairées
    g.rect(7, 10, 2, 4, 'd')                 # porte
    g.outline('k')
    c.stamp(ox, oy, g.rows())


def glyph_daggers(c, ox, oy):
    g = Canvas(16, 16)
    def dagger(mirror):
        for i in range(1, 15):
            x = 15 - i if mirror else i
            y = i
            if i <= 8:                       # lame (2 px)
                g.set(x, y, 'w'); g.set(x + (1 if not mirror else -1), y, 'w' if i < 8 else 'w')
            elif i == 9:                     # garde perpendiculaire
                for d in (-2, -1, 0, 1, 2):
                    g.set(x + (d if not mirror else -d), y - d, 'q')
            elif i <= 12:                    # manche
                g.set(x, y, 'd')
            else:                            # pommeau
                g.set(x, y, 'q')
    dagger(False); dagger(True)
    g.outline('k')
    c.stamp(ox, oy, g.rows())


def glyph_coin(c, ox, oy):
    g = Canvas(16, 16)
    g.disc(7.5, 7.5, 6, 'q')
    g.disc(7.5, 7.5, 4, 'y')
    g.rect(7, 4, 2, 8, 'q')                  # fente centrale
    g.set(5, 5, 'w'); g.set(4, 6, 'w'); g.set(5, 4, 'w')  # reflet
    g.outline('k')
    c.stamp(ox, oy, g.rows())


GLYPH = {'villageois': glyph_house, 'saboteurs': glyph_daggers, 'solitaires': glyph_coin}

SMALL = {
    'villageois': ['.....kk.....', '....kwwk.kk.', '...kwwwwkwk.', '..kwwwwwwwk.', '.kwwwwwwwwk.', 'kkkkkkkkkkkk',
                   '.kwwwwwwwwk.', '.kwykwwkykk.', '.kwwwkkwwwk.', '.kwwwkkwwwk.', '.kkkkkkkkkk.', '............'],
    'saboteurs': ['kk........kk', 'kwk......kwk', '.kwk....kwk.', '..kwk..kwk..', '...kwkkwk...', '....kwwk....',
                  '..kqkwwkqk..', '..kkqkkqkk..', '..kdk..kdk..', '.kdk....kdk.', 'kqk......kqk', 'kk........kk'],
    'solitaires': ['...kkkkkk...', '..kyyyyyyk..', '.kyyqyyqyyk.', 'kyyqqyyqqyyk', 'kyyyqqqqyyyk', 'kyyyyqqyyyyk',
                   'kyyyyqqyyyyk', 'kyyyqqqqyyyk', 'kyyqqyyqqyyk', '.kyyqyyqyyk.', '..kyyyyyyk..', '...kkkkkk...'],
}


def build(save):
    for team, field in FIELD.items():
        c = shield(field)
        GLYPH[team](c, 8, 7)
        pal = {'k': INK, 'f': field, 'h': shade(field, 1.25), 's': shade(field, 0.75), 'q': GOLD, 'Q': GOLD_D,
               'w': WHITE, 'y': '#ffd96b', 'd': '#6b4423'}
        save(c.render(pal), f'icons/team_{team}.png')
        s = Canvas(12, 12); s.stamp(0, 0, SMALL[team])
        save(s.render({'k': INK, 'w': WHITE, 'y': '#ffd96b', 'q': GOLD_D if team == 'solitaires' else GOLD, 'd': '#6b4423'}), f'icons/team_{team}_s.png')
