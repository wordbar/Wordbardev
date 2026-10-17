"""Build game-ready decor sprites from the supplied full-size PNGs.

Sprites are trimmed to their visible pixels and resized for a 3x phone
screen at their in-café size; surfaces become small tiling textures.
The supplied originals are never modified.
"""
import glob, json, os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "game", "art", "decor")
SURFACES = {"counter_marble", "floor_cocoa", "floor_honey", "floor_slate", "tiles_terra",
            "wall_blush", "wall_meadow", "wall_sky", "wall_sunny"}
# longest side in pixels; default 210 (about 70 café units at 3x)
MAXDIM = {"window_awning": 330, "window_stained": 330, "mural_market": 240, "rug_ocean": 360,
          "rug_rose": 360, "rug_stripe": 360, "bunting_rainbow": 360, "fairylights": 360,
          "lantern_paper": 360, "stars_paper": 360, "jukebox": 220, "petbasket": 240,
          "petbed_cloud": 240, "flowerbox": 300, "shelf_books": 240, "shelf_trophies": 240,
          "shelf_kegs": 200, "mug_rack": 180}

def main():
    os.makedirs(OUT, exist_ok=True)
    meta = {}
    for f in sorted(glob.glob(os.path.join(ROOT, "0[1-4]-*", "*.png"))):
        name = os.path.basename(f)[:-4]
        im = Image.open(f)
        if name in SURFACES:
            im = im.convert("RGB")
            im = im.resize((256, 256), Image.LANCZOS)
            im.save(os.path.join(OUT, name + ".webp"), "WEBP", quality=80, method=6)
            meta[name] = {"tile": 1}
            continue
        im = im.convert("RGBA")
        bbox = im.getchannel("A").point(lambda a: 255 if a > 12 else 0).getbbox()
        im = im.crop(bbox)
        m = MAXDIM.get(name, 210)
        s = min(1.0, m / max(im.size))
        im = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)
        im.save(os.path.join(OUT, name + ".webp"), "WEBP", quality=84, method=6, alpha_quality=90)
        meta[name] = {"w": im.width, "h": im.height}
    with open(os.path.join(OUT, "decor-meta.json"), "w") as fh:
        json.dump(meta, fh, separators=(",", ":"))
    print(len(meta), "sprites")

if __name__ == "__main__":
    main()
