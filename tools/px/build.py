"""Génère tous les PNG pixel art dans public/px/. Lancer : python3 tools/px/build.py"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from px import render, strip, save, OUT
import avatars as av
import icons as ic
from PIL import Image

def main():
    for aid, a in av.A.items():
        pal = av.palette(a)
        save(render(av.face_grid(a), pal), f'avatars/{aid}_face.png')
        save(strip([render(av.body_grid(a, f), pal) for f in (0, 1)]), f'avatars/{aid}_body.png')
    for name, grid in ic.ICONS.items():
        save(render(grid, ic.P), f'icons/{name}.png')
    # Planche de contrôle (x6) pour vérification visuelle
    faces = [render(av.face_grid(a), av.palette(a)) for a in av.A.values()]
    bodies = [render(av.body_grid(a, 0), av.palette(a)) for a in av.A.values()]
    icons = [render(g, ic.P) for g in ic.ICONS.values()]
    sheet = Image.new('RGBA', (16 * len(faces) + 4, 16 + 24 + 24 + 12), (16, 24, 32, 255))
    for i, (f, b) in enumerate(zip(faces, bodies)):
        sheet.paste(f, (2 + i * 16, 2), f); sheet.paste(b, (2 + i * 16, 20), b)
    x = 2
    for im in icons:
        sheet.paste(im, (x, 48), im); x += im.size[0] + 2
    sheet = sheet.resize((sheet.size[0] * 6, sheet.size[1] * 6), Image.NEAREST)
    sheet.save(OUT.parent.parent / 'tools' / 'px' / 'sheet.png')
    print('ok', OUT)

if __name__ == '__main__':
    main()
