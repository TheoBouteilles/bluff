"""Génère la carte v2 : python3 tools/px/build2.py"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from px import save, OUT
import village2
from pal2 import COLOR_DAY, COLOR_NIGHT

g = village2.build(save)
g.render(COLOR_DAY, 3).save(Path(__file__).parent / 'v2_day.png')
g.render(COLOR_NIGHT, 3).save(Path(__file__).parent / 'v2_night.png')
try:
    import village_life
    village_life.build(save)
except ImportError:
    pass
print('ok')
