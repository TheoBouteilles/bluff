"""Icône de l'application (PWA, écran d'accueil, favicon) : un villageois sous la lune, en pixel art.

Usage : python3 tools/px/app_icon.py  (Pillow requis) -> public/pwa/*.png et public/favicon.png
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
PUB = ROOT / "public"
NIGHT = (16, 24, 32, 255)
NIGHT2 = (24, 34, 48, 255)
STAR = (230, 194, 90, 255)


def scene(grid: int) -> Image.Image:
    """Scène carrée de `grid` pixels, contenu centré (zone sûre des icônes « maskable »)."""
    img = Image.new("RGBA", (grid, grid), NIGHT)
    # Halo plus clair au centre (dégradé en marches)
    c = grid / 2
    for y in range(grid):
        for x in range(grid):
            if (x - c + .5) ** 2 + (y - c + .5) ** 2 < (grid * .34) ** 2:
                img.putpixel((x, y), NIGHT2)
    for sx, sy in [(.2, .22), (.78, .3), (.3, .74), (.82, .7), (.62, .16)]:
        img.putpixel((int(sx * grid), int(sy * grid)), STAR)
    face = Image.open(PUB / "px/avatars/renard_face.png").convert("RGBA")
    moon = Image.open(PUB / "px/icons/moon.png").convert("RGBA")
    fx = (grid - face.width) // 2
    fy = (grid - face.height) // 2 + 3
    img.alpha_composite(face, (fx, fy))
    img.alpha_composite(moon, (fx + face.width - 5, fy - moon.height + 2))
    return img


def main() -> None:
    out = PUB / "pwa"
    out.mkdir(exist_ok=True)
    base = scene(32)
    for size in (192, 512):
        base.resize((size, size), Image.NEAREST).save(out / f"icon-{size}.png")
    base.resize((180, 180), Image.NEAREST).save(out / "apple-touch-icon.png")
    base.resize((64, 64), Image.NEAREST).save(PUB / "favicon.png")
    print("icônes écrites dans", out)


if __name__ == "__main__":
    main()
