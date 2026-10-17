"""Build game-ready character and pet SVGs from the supplied packs.

Artwork geometry is not changed. The build only:
  * removes duplicated class tokens / style declarations and review-only
    metadata attributes (smaller files, same drawing);
  * rounds coordinates to 2 decimals (sub-pixel at game size);
  * prefixes any id with the character id so two drawings can share a page;
  * for masters whose faces live only in the separate state files
    (Okafor, R0-B3RT), gathers the four state faces into the master,
    tagged with data-expression, so every character switches faces the
    same way.

Usage: python3 tools/build_chars.py <72-pack dir> <pets pack dir>
"""
import csv, json, os, re, sys
from lxml import etree

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SVGNS = "http://www.w3.org/2000/svg"
KEEP_DATA = {"data-joint", "data-pivot", "data-part", "data-expression", "data-expressions", "data-eyes",
             "data-view", "data-hand", "data-hand-view", "data-ground", "data-character", "data-pet",
             "data-mount", "data-side", "data-mirror", "data-range", "data-rest-angle", "data-actor",
             "data-tail-layer", "data-leg-layer", "data-stance", "data-face", "data-eye-state"}
NUM = re.compile(r"-?\d+\.\d{3,}")


def tidy(el, prefix):
    for node in el.iter():
        if not isinstance(node.tag, str):
            continue
        for k in list(node.attrib):
            if k.startswith("data-") and k not in KEEP_DATA:
                del node.attrib[k]
            elif k in ("role", "aria-label"):
                del node.attrib[k]
        if "class" in node.attrib:
            seen = []
            for c in node.attrib["class"].split():
                if c not in seen:
                    seen.append(c)
            node.attrib["class"] = " ".join(seen)
        if "style" in node.attrib:
            decl = []
            for d in node.attrib["style"].split(";"):
                d = d.strip()
                if d and d not in decl:
                    decl.append(d)
            node.attrib["style"] = ";".join(decl)
        for k in ("d", "points", "transform", "x", "y", "cx", "cy", "r", "rx", "ry", "width", "height",
                  "x1", "x2", "y1", "y2", "stroke-width"):
            if k in node.attrib:
                node.attrib[k] = NUM.sub(lambda m: ("%.2f" % float(m.group(0))).rstrip("0").rstrip("."), node.attrib[k])
        if "id" in node.attrib:
            node.attrib["id"] = prefix + "-" + node.attrib["id"]
    # retarget url(#id) / href="#id" references to the prefixed ids
    for node in el.iter():
        if not isinstance(node.tag, str):
            continue
        for k, v in list(node.attrib.items()):
            if "url(#" in v:
                node.attrib[k] = re.sub(r"url\(#([^)]+)\)", lambda m: "url(#%s-%s)" % (prefix, m.group(1)), v)
            if k.endswith("href") and v.startswith("#"):
                node.attrib[k] = "#%s-%s" % (prefix, v[1:])


def face_of(tree):
    hits = tree.xpath('//*[@data-part="face"]')
    return hits[0] if hits else None


def merge_state_faces(master, states_dir):
    face = face_of(master)
    if face is None:
        raise SystemExit("no face group in master for " + states_dir)
    parent = face.getparent()
    idx = parent.index(face)
    parent.remove(face)
    for i, state in enumerate(("normal", "blink", "happy", "concern")):
        st = etree.parse(os.path.join(states_dir, state + ".svg")).getroot()
        sf = face_of(st)
        wrap = etree.Element("{%s}g" % SVGNS)
        wrap.set("data-expression", state)
        wrap.append(sf)
        parent.insert(idx + i, wrap)


def write(root, path):
    root.set("aria-hidden", "true")
    root.set("focusable", "false")
    data = etree.tostring(root, encoding="unicode")
    data = re.sub(r">\s+<", "><", data)
    # hands use non-scaling strokes, which swamp them in small portraits
    data = data.replace(' vector-effect="non-scaling-stroke"', "")
    with open(path, "w") as fh:
        fh.write(data)
    return len(data)


def main(chars_dir, pets_dir):
    out_c = os.path.join(ROOT, "game", "art", "chars")
    out_p = os.path.join(ROOT, "game", "art", "pets")
    os.makedirs(out_c, exist_ok=True)
    os.makedirs(out_p, exist_ok=True)
    total = 0
    index = []
    with open(os.path.join(chars_dir, "Character-Index.csv")) as fh:
        for row in csv.DictReader(fh):
            cid = row["id"]
            root = etree.parse(os.path.join(chars_dir, row["master_svg"])).getroot()
            if not root.xpath("//*[@data-expression or @data-expressions]"):
                merge_state_faces(root, os.path.join(chars_dir, "states", cid))
            tidy(root, cid)
            total += write(root, os.path.join(out_c, cid + ".svg"))
            index.append([cid, row["role"]])
    print("characters", len(index), total // 1024, "KB")
    ptotal = 0
    names = sorted(f[:-4] for f in os.listdir(os.path.join(pets_dir, "game")) if f.endswith(".svg"))
    for pid in names:
        root = etree.parse(os.path.join(pets_dir, "game", pid + ".svg")).getroot()
        tidy(root, "pet-" + pid)
        ptotal += write(root, os.path.join(out_p, pid + ".svg"))
    print("pets", len(names), ptotal // 1024, "KB")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
