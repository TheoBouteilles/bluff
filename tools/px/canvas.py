"""Canevas pixel art en mémoire : dessin par clés de palette, contour automatique, rendu PNG."""
from PIL import Image
from px import hex2rgba


class Canvas:
    def __init__(self, w, h, fill='.'):
        self.w, self.h = w, h
        self.g = [[fill] * w for _ in range(h)]

    def get(self, x, y):
        return self.g[y][x] if 0 <= x < self.w and 0 <= y < self.h else '.'

    def set(self, x, y, k):
        if 0 <= x < self.w and 0 <= y < self.h and k is not None:
            self.g[y][x] = k

    def rect(self, x, y, w, h, k):
        for yy in range(y, y + h):
            for xx in range(x, x + w):
                self.set(xx, yy, k)

    def hline(self, x0, x1, y, k):
        for x in range(min(x0, x1), max(x0, x1) + 1):
            self.set(x, y, k)

    def vline(self, x, y0, y1, k):
        for y in range(min(y0, y1), max(y0, y1) + 1):
            self.set(x, y, k)

    def frame(self, x, y, w, h, k):
        self.hline(x, x + w - 1, y, k); self.hline(x, x + w - 1, y + h - 1, k)
        self.vline(x, y, y + h - 1, k); self.vline(x + w - 1, y, y + h - 1, k)

    def line(self, x0, y0, x1, y1, k):
        dx, dy = abs(x1 - x0), -abs(y1 - y0)
        sx, sy = (1 if x0 < x1 else -1), (1 if y0 < y1 else -1)
        err = dx + dy
        while True:
            self.set(x0, y0, k)
            if x0 == x1 and y0 == y1:
                break
            e2 = 2 * err
            if e2 >= dy:
                err += dy; x0 += sx
            if e2 <= dx:
                err += dx; y0 += sy

    def disc(self, cx, cy, r, k, ry=None):
        ry = r if ry is None else ry
        for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
            for x in range(int(cx - r) - 1, int(cx + r) + 2):
                if ((x - cx) / (r + 0.5)) ** 2 + ((y - cy) / (ry + 0.5)) ** 2 <= 1:
                    self.set(x, y, k)

    def stamp(self, x, y, rows, transparent='.'):
        for j, row in enumerate(rows):
            for i, c in enumerate(row):
                if c != transparent:
                    self.set(x + i, y + j, c)

    def outline(self, k='k', diag=False, only_over='.'):
        """Ajoute un contour `k` autour de tout pixel non transparent (sur les pixels `only_over`)."""
        add = []
        for y in range(self.h):
            for x in range(self.w):
                if self.g[y][x] != only_over:
                    continue
                n = [(1, 0), (-1, 0), (0, 1), (0, -1)] + ([(1, 1), (-1, -1), (1, -1), (-1, 1)] if diag else [])
                if any(self.get(x + dx, y + dy) not in ('.', k) for dx, dy in n):
                    add.append((x, y))
        for x, y in add:
            self.g[y][x] = k

    def replace(self, a, b, region=None):
        x0, y0, x1, y1 = region or (0, 0, self.w, self.h)
        for y in range(y0, y1):
            for x in range(x0, x1):
                if self.g[y][x] == a:
                    self.g[y][x] = b

    def rows(self):
        return [''.join(r) for r in self.g]

    def render(self, palette, scale=1):
        im = Image.new('RGBA', (self.w, self.h), (0, 0, 0, 0))
        px = im.load()
        for y in range(self.h):
            for x in range(self.w):
                c = self.g[y][x]
                if c != '.':
                    px[x, y] = hex2rgba(palette[c]) if isinstance(palette[c], str) else palette[c]
        if scale != 1:
            im = im.resize((self.w * scale, self.h * scale), Image.NEAREST)
        return im
