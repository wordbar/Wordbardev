"""Build the barista customisation parts library from the supplied
Customisation SVG pack (Current-Assembled).

Every Current-Assembled file is a complete, rigged figure with baked
colours. This script turns them into one compact library:

  * foundation: the base figure, with every palette colour replaced by its
    CSS variable (--skin, --hair, --cloth, --glass, --fabric, --iris and
    their shades), so the game can recolour without redrawing;
  * options: for each choice, only the parts it changes (replace / add /
    remove), found by comparing the drawing structure with the foundation.
    Clothing is taken in one colour per style (colour comes from --cloth);
    glasses in one colour per shape (colour comes from --glass).

Artwork geometry is copied unchanged. Usage:
  python3 tools/build_custom.py <Customisation pack dir> game/art/custom/parts.json
"""
import copy, json, os, re, sys
from lxml import etree

NS = "http://www.w3.org/2000/svg"
CONTAINERS = {"common-frame", "custom-head", "face-customized"}
VAR_ORDER = ["--cloth", "--cloth-d760", "--cloth-d900", "--cloth-d910", "--cloth-l250",
             "--fabric", "--fabric-l240", "--fabric-l278", "--glass", "--iris",
             "--hair", "--hair-d680", "--hair-d720", "--hair-l240", "--skin", "--skin-d579", "--skin-d690"]
NOISE_ATTRS = {"id", "style", "fill", "stroke", "clip-path", "mask", "opacity", "aria-label", "role"}


def rgb(h):
    h = h.strip().lstrip("#")
    return "rgb(%d, %d, %d)" % (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))


def var_map(root):
    st = root.get("style") or ""
    vals = dict(re.findall(r"(--[a-z0-9-]+):\s*(#[0-9a-fA-F]{6})", st))
    m = {}
    for name in VAR_ORDER:
        if name in vals:
            for form in (rgb(vals[name]), vals[name].lower(), vals[name].upper()):
                m.setdefault(form, name)
    return m


def apply_vars(el, vm):
    for node in el.iter():
        if not isinstance(node.tag, str):
            continue
        st = node.get("style")
        if st:
            node.set("style", re.sub(r"rgb\(\d+, \d+, \d+\)", lambda mm: "var(%s)" % vm[mm.group(0)] if mm.group(0) in vm else mm.group(0), st))
        for a in ("fill", "stroke", "stop-color"):
            v = node.get(a)
            if v and v.lower() in vm:
                node.set(a, "var(%s)" % vm[v.lower()])


def sig(el):
    """structure-only signature (ignores colours and generated ids)"""
    e = copy.deepcopy(el)
    for node in e.iter():
        if not isinstance(node.tag, str):
            continue
        for a in list(node.attrib):
            if a in NOISE_ATTRS or a.startswith("data-") and a not in ("data-part", "data-joint", "data-view"):
                del node.attrib[a]
    return etree.tostring(e)


def part_map(root):
    d = {}
    for el in root.iter():
        if isinstance(el.tag, str) and el.get("data-part") and el.get("data-part") not in d:
            d[el.get("data-part")] = el
    return d


def anchor(el):
    for k in ("data-part", "data-joint"):
        if el.get(k):
            return '[%s="%s"]' % (k, el.get(k))
    return None


def with_defs(el, root, prefix, counter):
    """copy any url(#id) targets the part needs into it, with fresh ids"""
    el = copy.deepcopy(el)
    ids = {}
    for node in el.iter():
        if not isinstance(node.tag, str):
            continue
        for a, v in node.attrib.items():
            for ref in re.findall(r"url\(#([^)]+)\)", v):
                ids.setdefault(ref, None)
    if not ids:
        return el
    defs = etree.SubElement(el, "{%s}defs" % NS)
    el.remove(defs)
    el.insert(0, defs)
    for ref in ids:
        tgt = root.xpath('//*[@id="%s"]' % ref)
        if not tgt:
            continue
        counter[0] += 1
        new = "%s%d" % (prefix, counter[0])
        ids[ref] = new
        c = copy.deepcopy(tgt[0])
        c.set("id", new)
        defs.append(c)
    for node in el.iter():
        if not isinstance(node.tag, str):
            continue
        for a, v in list(node.attrib.items()):
            if "url(#" in v:
                node.set(a, re.sub(r"url\(#([^)]+)\)", lambda mm: "url(#%s)" % ids.get(mm.group(1), mm.group(1)), v))
    return el


def clean_markup(el):
    s = etree.tostring(el, encoding="unicode")
    s = s.replace(' xmlns="http://www.w3.org/2000/svg"', "")
    s = re.sub(r"\s*display:\s*inline;?", "", s)
    s = re.sub(r'\s(data-(?:review-status|version|refinement|face-trial|motion-revision|palette-mode|joint-placement|nominal-scale|root-x|root-y|taper|follow|hand-standard))="[^"]*"', "", s)
    s = re.sub(r"(\d+\.\d{3})\d+", r"\1", s)
    s = s.replace(' vector-effect="non-scaling-stroke"', "")
    return s


def strip_ids_in_place(root):
    for node in root.iter():
        if isinstance(node.tag, str) and node.get("id") and node.tag.split("}")[-1] not in ("clipPath", "mask", "linearGradient", "radialGradient", "pattern"):
            del node.attrib["id"]


def diff_option(fd, root, key, counter):
    """wearables are compared inside the arms, so a watch or bracelet only
    brings its own hand part and never undoes a hoodie's sleeves"""
    containers = CONTAINERS | ({"arms", "arm-viewer-left", "arm-viewer-right"} if key.startswith("acc/") else set())
    vm = var_map(root)
    od = part_map(root)
    out = {"set": {}, "add": [], "remove": []}
    changed = [p for p, el in od.items() if p not in fd or sig(el) != sig(fd[p])]
    def topmost(p):
        el = od[p].getparent()
        while el is not None:
            q = el.get("data-part")
            if q and q in changed and q not in containers:
                return False
            el = el.getparent()
        return True
    for p in changed:
        if p in containers or not topmost(p):
            continue
        el = with_defs(od[p], root, "c%s_" % re.sub(r"[^a-z0-9]", "", key), counter)
        apply_vars(el, vm)
        if p in fd:
            out["set"][p] = clean_markup(el)
        else:
            par = od[p].getparent()
            while par is not None and not anchor(par):
                par = par.getparent()
            prev = od[p].getprevious()
            while prev is not None and (not isinstance(prev.tag, str) or not anchor(prev)):
                prev = prev.getprevious()
            out["add"].append({"part": p, "parent": anchor(par) if par is not None else None,
                               "after": anchor(prev) if prev is not None else None, "svg": clean_markup(el)})
    for p in fd:
        if p not in od:
            # only report removals whose parent still exists (avoid listing every child)
            par = fd[p].getparent()
            pp = par.get("data-part") if par is not None else None
            if not pp or pp in od:
                out["remove"].append(p)
    return out


def main(pack, out_path):
    A = os.path.join(pack, "Current-Assembled")
    counter = [0]
    froot = etree.parse(os.path.join(A, "foundation", "default.svg")).getroot()
    fd = part_map(froot)
    found = copy.deepcopy(froot)
    apply_vars(found, var_map(froot))
    root_vars = {k: v for k, v in re.findall(r"(--[a-z0-9-]+):\s*(#[0-9a-fA-F]{6})", froot.get("style") or "")}
    found.set("style", "")
    for a in list(found.attrib):
        if a.startswith("data-") and a not in ("data-ground",) or a in ("role", "aria-label"):
            del found.attrib[a]
    lib = {"foundation": clean_markup(found), "defaults": root_vars, "options": {}}
    pick = []
    for f in sorted(os.listdir(os.path.join(A, "hair"))):
        if f.endswith(".svg") and f != "hijab-colours.svg":
            pick.append(("hair/" + f[:-4], os.path.join(A, "hair", f)))
    seen = set()
    for f in sorted(os.listdir(os.path.join(A, "clothing"))):
        style, apron, colour = f[:-4].split("--")
        if colour == "sky":
            pick.append(("clothing/%s--%s" % (style, apron), os.path.join(A, "clothing", f)))
    for f in sorted(os.listdir(os.path.join(A, "glasses"))):
        shape, colour = f[:-4].split("--")
        if colour == "blue":
            pick.append(("glasses/" + shape, os.path.join(A, "glasses", f)))
    for f in sorted(os.listdir(os.path.join(A, "accessories"))):
        pick.append(("acc/" + f[:-4], os.path.join(A, "accessories", f)))
    for sub in ("eyes", "brows", "cheeks", "facialhair", "mouth"):
        for f in sorted(os.listdir(os.path.join(A, "face", sub))):
            pick.append(("%s/%s" % (sub, f[:-4]), os.path.join(A, "face", sub, f)))
    for key, path in pick:
        root = etree.parse(path).getroot()
        lib["options"][key] = diff_option(fd, root, key, counter)
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w") as fh:
        json.dump(lib, fh, separators=(",", ":"))
    print("options", len(lib["options"]), "bytes", os.path.getsize(out_path))
    for key, o in lib["options"].items():
        print("%-34s set=%s add=%s remove=%s" % (key, sorted(o["set"]), [a["part"] for a in o["add"]], o["remove"]))


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
