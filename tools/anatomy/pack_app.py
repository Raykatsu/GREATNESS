# Convertit les rendus bruts (render_app.py) en images WebP légères pour l'app, dans assets/anatomy :
# corps gris, couche éclairée et écorché naturel (fond transparent), et un masque par groupe musculaire
# (blanc, la couverture du groupe dans le canal alpha).
# Usage : python -I pack_app.py <dossier raw> <dossier assets/anatomy>
import sys, os, json
from PIL import Image

RAW, DST = sys.argv[1], sys.argv[2]
os.makedirs(DST, exist_ok=True)
man = json.load(open(os.path.join(RAW, "manifest.json")))
total, report = 0, []

def save(img, name, **kw):
    global total
    path = os.path.join(DST, name)
    img.save(path, "WEBP", method=6, **kw)
    size = os.path.getsize(path)
    total += size
    return size

for view, groups in man["views"].items():
    for name in (view, f"{view}-light", f"natural-{view}"):
        im = Image.open(os.path.join(RAW, name + ".png")).convert("RGBA")
        report.append((name, save(im, name + ".webp", quality=84, alpha_quality=92)))
    for g in groups:
        m = Image.open(os.path.join(RAW, f"{view}-{g}.png")).convert("L").point(lambda v: 0 if v < 6 else v)  # sans bruit résiduel
        white = Image.new("L", m.size, 255)
        size = save(Image.merge("RGBA", (white, white, white, m)), f"{view}-{g}.webp", quality=70, alpha_quality=90)
        hist = m.histogram()
        cover = sum(hist[128:]) / (m.size[0] * m.size[1])
        report.append((f"{view}-{g}", size, cover))

for r in report:
    print(f"{r[0]:22s} {r[1] / 1024:6.1f} Ko" + (f"   couverture {r[2] * 100:5.2f} %" if len(r) > 2 else ""))
print(f"TOTAL {total / 1024:.0f} Ko pour {len(report)} fichiers")
