"""Génère les calques d'avatar personnalisé dans public/px/looks/ et une planche de contrôle.
Lancer : python3 tools/px/build_looks.py  (nécessite Pillow)
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from PIL import Image
from px import render, strip, save, OUT
import avatars as av
import looks as lk


def main():
    for i, color in enumerate(lk.TUNICS):
        if color:
            frame = render(lk.tunic_grid(), lk.tunic_palette(color))
            save(strip([frame, frame]), f'looks/tunic_{i}_body.png')
    for i, layer in enumerate(lk.ACCESSORIES):
        if layer:
            save(render(lk.acc_face(i), lk.PAL), f'looks/acc_{i}_face.png')
            save(strip([render(lk.acc_body(i, f), lk.PAL) for f in (0, 1)]), f'looks/acc_{i}_body.png')

    # Planche : chaque avatar avec une tenue et un accessoire différents (x6)
    names = list(av.A.keys())
    sheet = Image.new('RGBA', (len(names) * 18 + 2, 24 * 2 + 6), (16, 24, 32, 255))
    for n, aid in enumerate(names):
        a = av.A[aid]
        body = render(av.body_grid(a, 0), av.palette(a))
        t = 1 + n % (len(lk.TUNICS) - 1)
        acc = 1 + n % (len(lk.ACCESSORIES) - 1)
        tun = render(lk.tunic_grid(), lk.tunic_palette(lk.TUNICS[t]))
        hat = render(lk.acc_body(acc, 0), lk.PAL)
        x = 2 + n * 18
        sheet.paste(body, (x, 2), body); sheet.paste(tun, (x, 2), tun); sheet.paste(hat, (x, 2), hat)
        face = render(av.face_grid(a), av.palette(a))
        hatf = render(lk.acc_face(acc), lk.PAL)
        sheet.paste(face, (x, 30), face); sheet.paste(hatf, (x, 30), hatf)
    sheet = sheet.resize((sheet.size[0] * 6, sheet.size[1] * 6), Image.NEAREST)
    sheet.save(OUT.parent.parent / 'tools' / 'px' / 'looks_sheet.png')
    print('ok', OUT / 'looks')


if __name__ == '__main__':
    main()
