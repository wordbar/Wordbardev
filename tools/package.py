"""Package the WordBar game folder.

  python3 tools/package.py prod   -> dist/WordBar-S13-deploy.zip       (upload as is)
  python3 tools/package.py demo   -> dist/WordBar-S13-demo-deploy.zip  (adds demo-config.js:
                                     1,000,000 coins on every profile; never use for production)
  python3 tools/package.py preview <dir>  -> a claude.ai artifact preview folder
                                     (game.html + demo coins; Kitchen step art left out to fit
                                     the file limit; word banks renamed to .wasm because the
                                     artifact host does not serve .wbdata)
"""
import hashlib, os, shutil, sys, zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GAME = os.path.join(ROOT, "game")
SKIP = {"_scene-test.html", "art/decor/decor-meta.json"}
DEMO_TAG = '<script defer src="demo-config.js?v=batchS13g"></script>'


def game_files():
    for r, _, fs in os.walk(GAME):
        for f in fs:
            rel = os.path.relpath(os.path.join(r, f), GAME)
            if rel not in SKIP:
                yield rel


def copy_tree(dst, demo=False, preview=False):
    if os.path.exists(dst):
        shutil.rmtree(dst)
    for rel in game_files():
        if preview and (rel.startswith("assets/kitchen-steps/") or rel == "_headers"):
            continue
        out = os.path.join(dst, rel)
        os.makedirs(os.path.dirname(out), exist_ok=True)
        shutil.copy2(os.path.join(GAME, rel), out)
    if demo:
        shutil.copy2(os.path.join(ROOT, "tools", "demo", "demo-config.js"), os.path.join(dst, "demo-config.js"))
        idx = os.path.join(dst, "index.html")
        s = open(idx).read()
        anchor = '<script defer src="06-ui.js?v=batchS13g"></script>'
        assert anchor in s
        s = s.replace(anchor, anchor + "\n" + DEMO_TAG)
        open(idx, "w").write(s)
    if preview:
        sha = lambda p: hashlib.sha256(open(p, "rb").read()).hexdigest()
        manifests = ["data/manifest.json", "data/everyday/v1/manifest.json"]
        before = {m: sha(os.path.join(dst, m)) for m in manifests}
        for r, _, fs in os.walk(os.path.join(dst, "data")):
            for f in fs:
                if f.endswith(".wbdata"):
                    os.rename(os.path.join(r, f), os.path.join(r, f + ".wasm"))
        for m in manifests:
            p = os.path.join(dst, m)
            text = open(p).read().replace('.wbdata"', '.wbdata.wasm"')
            open(p, "w").write(text)
        loader = os.path.join(dst, "data-loader.js")
        s = open(loader).read()
        for m in manifests:
            s = s.replace(before[m], sha(os.path.join(dst, m)))
        open(loader, "w").write(s)
        os.rename(os.path.join(dst, "index.html"), os.path.join(dst, "game.html"))


def zip_tree(src, zpath):
    os.makedirs(os.path.dirname(zpath), exist_ok=True)
    with zipfile.ZipFile(zpath, "w", zipfile.ZIP_DEFLATED) as z:
        for r, _, fs in os.walk(src):
            for f in sorted(fs):
                full = os.path.join(r, f)
                z.write(full, os.path.relpath(full, src))
    print(zpath, os.path.getsize(zpath) // 1024, "KB")


if __name__ == "__main__":
    mode = sys.argv[1]
    if mode in ("prod", "demo"):
        tmp = os.path.join(ROOT, "dist", "_build_" + mode)
        copy_tree(tmp, demo=(mode == "demo"))
        name = "WordBar-S13-deploy.zip" if mode == "prod" else "WordBar-S13-demo-deploy.zip"
        zip_tree(tmp, os.path.join(ROOT, "dist", name))
        shutil.rmtree(tmp)
    elif mode == "preview":
        copy_tree(sys.argv[2], demo=True, preview=True)
        print("preview at", sys.argv[2])
