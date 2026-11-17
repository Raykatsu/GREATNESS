# Corps 3D allégé pour la vue 3D de l'app (js/body3d.js, WebGL sans bibliothèque), à partir du fichier propre
# (extract.py) : muscles, tendons et os décimés, un groupe par sommet (os, tendon, muscle « autre », ou l'un des 17
# groupes musculaires de l'app), positions sur 16 bits, normales sur 8 bits, indices sur 32 bits, et le squelette des
# démos animées : pour chaque sommet, les deux segments qui le portent et le poids du premier.
# Modèle : « BodyParts3D - DBCLS - CC-BY-SA 2.1 Japan » et « Z-Anatomy - CC-BY-SA 4.0 ».
# Usage : python -u -I export_web.py -- <body.blend> <dossier de sortie> [part des triangles gardés : muscles os]
import sys, os, json, time
import bpy
import numpy as np

ARGS = sys.argv[sys.argv.index("--") + 1:]
BLEND, OUT = ARGS[0], ARGS[1]
R_MUS, R_BONE = (float(ARGS[2]), float(ARGS[3])) if len(ARGS) > 3 else (0.07, 0.05)
os.makedirs(OUT, exist_ok=True)
t0 = time.time()
bpy.ops.wm.open_mainfile(filepath=BLEND, load_ui=False, use_scripts=False)
sc = bpy.data.scenes["GT"]
objs = [o for o in sc.objects if o.type == "MESH"]

# mêmes groupes et mêmes règles que render_app.py (ANAT_GROUPS dans js/anatomy.js)
GROUPS = ["pecs", "delts", "traps", "lats", "biceps", "triceps", "forearms", "abs", "obliques", "lowerback",
          "glutes", "quads", "hams", "adductors", "abductors", "calves", "hipflex"]
RULES = [
    ("lowerback", ["thoracolumbar part"]),  # avant les dorsaux : la nappe lombaire découpée du grand dorsal (extract.py)
    ("pecs", ["pectoralis major", "pectoralis minor"]),
    ("delts", ["deltoid", "supraspinatus", "infraspinatus", "teres minor"]),
    ("lats", ["latissimus dorsi", "teres major"]),
    ("traps", ["trapezius", "rhomboid", "levator scapulae"]),
    ("triceps", ["triceps brachii", "anconeus"]),
    ("biceps", ["biceps brachii", "brachialis", "coracobrachialis"]),
    ("abs", ["rectus abdominis", "transversus abdominis", "pyramidalis", "rectus sheath"]),
    ("obliques", ["abdominal oblique"]),
    ("glutes", ["gluteus maximus"]),
    ("abductors", ["gluteus medius", "gluteus minimus", "tensor fasciae latae"]),
    ("quads", ["rectus femoris", "vastus"]),
    ("hams", ["biceps femoris", "semitendinosus", "semimembranosus"]),
    ("adductors", ["adductor longus", "adductor brevis", "adductor magnus", "gracilis", "pectineus"]),
    ("hipflex", ["iliacus", "psoas", "sartorius"]),
    ("calves", ["gastrocnemius", "soleus", "plantaris"]),
    ("lowerback", ["thoracolumbar part", "iliocostalis lumborum", "iliocostalis thoracis", "longissimus thoracis", "spinalis thoracis",
                   "multifidus lumborum", "multifidus thoracis", "quadratus lumborum", "semispinalis thoracis", "rotatores",
                   "interspinales lumborum", "intertransversarii"]),
]
PARTS = ["bone", "tendon", "muscle"] + GROUPS  # identifiant d'un sommet = index dans cette liste

def base_name(o):
    n = o.name.lower()
    if n[-4:-3] == "." and n[-3:].isdigit():
        n = n[:-4]
    return n[:-2] if n[-2:] in (".l", ".r") else n

def part_of(o):
    if o.get("group") == "bone":
        return 0
    if o.get("group") == "tendon":
        return 1
    n = base_name(o)
    for g, keys in RULES:
        if any(k in n for k in keys):
            return PARTS.index(g)
    M = np.array(o.matrix_world)
    c = np.array([list(v) for v in o.bound_box]) @ M[:3, :3].T + M[:3, 3]
    x, z = abs(c.mean(0)[0]), c.mean(0)[2]
    return PARTS.index("forearms") if x > 0.2 and 0.76 < z < 1.12 else 2

# ---------- Squelette d'animation (démos en 3D : js/demo3d.js) ----------
# Les articulations sont placées sur les vrais os du modèle (tête du fémur par ajustement de sphère, genou entre fémur et
# tibia…). Repère du modèle : x vers la gauche du sujet, y vers l'arrière, z vers le haut (mètres).
OBJ = {}
for o in objs:
    OBJ[base_name(o) + (o.name.lower()[-6:-4] if o.name.lower()[-6:-4] in (".l", ".r") else "")] = o
def V(name):
    o = OBJ[name]
    co = np.empty(len(o.data.vertices) * 3, np.float32); o.data.vertices.foreach_get("co", co)
    return co.reshape(-1, 3).astype(np.float64)
def sphere(P):  # centre de la sphère la plus proche des points (moindres carrés)
    A = np.c_[2 * P, np.ones(len(P))]
    return np.linalg.lstsq(A, (P ** 2).sum(1), rcond=None)[0][:3]
def J_side(s):
    sx = 1 if s == "l" else -1
    fe, ti, hu = V(f"femur.{s}"), V(f"tibia.{s}"), V(f"humerus.{s}")
    top = fe[fe[:, 2] > fe[:, 2].max() - 0.055]; head = top[np.abs(top[:, 0]) < np.median(np.abs(top[:, 0]))]
    hip = sphere(head)
    knee = (fe[fe[:, 2] < fe[:, 2].min() + 0.025].mean(0) + ti[ti[:, 2] > ti[:, 2].max() - 0.02].mean(0)) / 2
    ta = V(f"talus.{s}"); ankle = ta[ta[:, 2] > ta[:, 2].min() + 0.5 * np.ptp(ta[:, 2])].mean(0)
    toe = V(f"distal phalanx of second finger of foot.{s}"); toe = toe[toe[:, 1].argmin()]
    ca = V(f"calcaneus.{s}"); heel = ca[ca[:, 1].argmax()]
    htop = hu[hu[:, 2] > hu[:, 2].max() - 0.045]; hhead = htop[np.abs(htop[:, 0]) < np.median(np.abs(htop[:, 0]))]
    shoulder = sphere(hhead)
    elbow = hu[hu[:, 2] < hu[:, 2].min() + 0.03].mean(0)
    ra, ul = V(f"radius.{s}"), V(f"ulna.{s}")
    wrist = 0.6 * ra[ra[:, 2] < ra[:, 2].min() + 0.015].mean(0) + 0.4 * ul[ul[:, 2] < ul[:, 2].min() + 0.015].mean(0)
    tip = V(f"distal phalanx of third finger of hand.{s}"); tip = tip[tip[:, 2].argmin()]
    cl = V(f"clavicle.{s}"); ax = np.abs(cl[:, 0])
    sc, ac = cl[ax < ax.min() + 0.02].mean(0), cl[ax > ax.max() - 0.02].mean(0)
    return dict(hip=hip, knee=knee, ankle=ankle, toe=toe, heel=heel, shoulder=shoulder, elbow=elbow, wrist=wrist, tip=tip, sc=sc, ac=ac)
JL, JR = J_side("l"), J_side("r")
def body_c(name, top=False):  # centre du corps vertébral (partie avant de la vertèbre), plateau du haut ou du bas
    P = V(name); P = P[P[:, 1] < P[:, 1].min() + 0.035]; c = P.mean(0)
    c[2] = P[:, 2].max() if top else P[:, 2].min()
    return c
pelvis = (JL["hip"] + JR["hip"]) / 2
ls, tl, ct = body_c("vertebra l5"), body_c("vertebra l1"), body_c("vertebra t1", top=True)
atlas = V("atlas (c1)").mean(0)
crown = V("parietal bone.l"); crown = np.array([0, atlas[1], crown[:, 2].max()])
# os : pivot, direction de visée au repos (vers l'articulation suivante), parent, rayon (pour répartir les muscles)
BONES = [("pelvis", pelvis, ls, -1, 0.12), ("abdomen", ls, tl, 0, 0.12), ("chest", tl, ct, 1, 0.13),
         ("neck", ct, atlas, 2, 0.055), ("head", atlas, crown, 3, 0.09)]
for s, Jx in (("r", JR), ("l", JL)):
    BONES += [(f"clav_{s}", Jx["sc"], Jx["ac"], 2, 0.045), (f"uarm_{s}", Jx["shoulder"], Jx["elbow"], None, 0.048),
              (f"farm_{s}", Jx["elbow"], Jx["wrist"], None, 0.038), (f"hand_{s}", Jx["wrist"], Jx["tip"], None, 0.032)]
for s, Jx in (("r", JR), ("l", JL)):
    BONES += [(f"thigh_{s}", Jx["hip"], Jx["knee"], 0, 0.075), (f"shin_{s}", Jx["knee"], Jx["ankle"], None, 0.052),
              (f"foot_{s}", Jx["ankle"], Jx["toe"], None, 0.035)]
NAMES = [b[0] for b in BONES]
PARENT = {"uarm": "clav", "farm": "uarm", "hand": "farm", "shin": "thigh", "foot": "shin"}
BONES = [(n, h, t, p if p is not None else NAMES.index(f"{PARENT[n[:-2]]}{n[-2:]}"), r) for n, h, t, p, r in BONES]
# axes des capsules de répartition : le long des os, le tronc décalé vers l'avant (centre du thorax, pas la colonne)
CAP = []
for n, h, t, p, r in BONES:
    h2, t2 = h.copy(), t.copy()
    if n in ("pelvis", "abdomen", "chest"):
        h2[1] -= 0.045; t2[1] -= 0.045
    CAP.append((h2, t2, r))
CAP = [(np.array(a), np.array(b), r) for a, b, r in CAP]
B = {n: i for i, n in enumerate(NAMES)}

def rigid_bone(o):  # os entier sur un seul segment du squelette, d'après son nom (None : décidé par la distance)
    if o.get("group") != "bone":  # muscles et tendons : à la distance (« iliotibial » contient « tibia »…)
        return None
    n, side = base_name(o), o.name.lower()[-6:-4]
    s = side[-1] if side in (".l", ".r") else None
    has = lambda *ks: any(k in n for k in ks)
    if s:
        if has("femur"): return f"thigh_{s}"
        if has("tibia", "fibula", "patella"): return f"shin_{s}"
        if has("of foot", "metatarsal", "talus", "calcaneus", "navicular", "cuboid", "cuneiform"): return f"foot_{s}"
        if has("humerus"): return f"uarm_{s}"
        if has("radius", "ulna"): return f"farm_{s}"
        if has("of hand", "metacarpal", "scaphoid", "lunate", "triquetrum", "pisiform", "trapezium", "trapezoid", "capitate", "hamate"): return f"hand_{s}"
        if has("clavicle", "scapula"): return f"clav_{s}"
        if has("sesamoid"): return None
    if has("hip bone", "sacrum", "coccyx"): return "pelvis"
    if has("vertebra l"): return "abdomen"
    if has("vertebra t", "rib", "costal", "sternum", "manubrium", "xiphoid"): return "chest"
    if has("vertebra c", "atlas", "axis", "hyoid", "cricoid", "thyroid", "arytenoid", "corniculate", "epiglott"): return "neck"
    return "head"

def allowed(o, c):  # segments possibles pour une pièce (muscle, tendon, os inclassé) selon sa place dans le corps
    side = o.name.lower()[-6:-4]
    s = side[-1] if side in (".l", ".r") else ("l" if c[0] > 0.02 else "r" if c[0] < -0.02 else None)
    sides = [s] if s else ["l", "r"]
    if c[2] > atlas[2] - 0.02 and abs(c[0]) < 0.12:
        return ["head", "neck", "chest"]
    if abs(c[0]) > 0.19 and 0.6 < c[2] < 1.45:
        return ["chest"] + [f"{b}_{x}" for x in sides for b in ("clav", "uarm", "farm", "hand")]
    if c[2] < 0.8 and abs(c[0]) < 0.25:
        return ["pelvis"] + [f"{b}_{x}" for x in sides for b in ("thigh", "shin", "foot")]
    return ["pelvis", "abdomen", "chest", "neck"] + [f"{b}_{x}" for x in sides for b in ("clav", "uarm", "thigh")]

def seg_dist(P, a, b):  # distance de chaque point au segment [a, b]
    ab = b - a; t = np.clip(((P - a) @ ab) / max(1e-9, ab @ ab), 0, 1)
    return np.linalg.norm(P - (a + t[:, None] * ab), axis=1)

def skin_of(o, co):  # deux segments par sommet et le poids du premier (sur 255)
    rb = rigid_bone(o)
    n = len(co)
    if rb:
        i = B[rb]; return np.full(n, i, np.uint8), np.full(n, i, np.uint8), np.full(n, 255, np.uint8)
    cand = [B[x] for x in allowed(o, co.mean(0))]
    D = np.stack([seg_dist(co, CAP[i][0], CAP[i][1]) / CAP[i][2] for i in cand], axis=1)
    order = np.argsort(D, axis=1)[:, :2]
    d1, d2 = np.take_along_axis(D, order, 1).T
    w1 = 1 / (1 + np.exp(-6.0 * (d2 - d1)))  # même distance : moitié-moitié ; nettement plus près : tout au plus proche
    c = np.array(cand)
    return c[order[:, 0]].astype(np.uint8), c[order[:, 1]].astype(np.uint8), np.round(w1 * 255).astype(np.uint8)

# Décimation : un modificateur par pièce, au moins ~60 triangles pour garder la forme des petites pièces
for o in objs:
    n = sum(len(p.vertices) - 2 for p in o.data.polygons)
    r = R_BONE if o.get("group") == "bone" else R_MUS
    md = o.modifiers.new("dec", "DECIMATE")
    md.decimate_type = "COLLAPSE"
    md.ratio = min(1.0, max(r, 60 / max(1, n)))
    md.use_collapse_triangulate = True
dg = bpy.context.evaluated_depsgraph_get()

pos, nor, part, idx, skin = [], [], [], [], []
base = 0
for o in objs:
    pid = part_of(o)
    ev = o.evaluated_get(dg)
    me = ev.to_mesh()
    me.calc_loop_triangles()
    nv, nt = len(me.vertices), len(me.loop_triangles)
    if not nt:
        ev.to_mesh_clear(); continue
    co = np.empty(nv * 3, np.float32); me.vertices.foreach_get("co", co)
    vn = np.empty(nv * 3, np.float32); me.vertices.foreach_get("normal", vn)
    tri = np.empty(nt * 3, np.int32); me.loop_triangles.foreach_get("vertices", tri)
    tmat = np.empty(nt, np.int32); me.loop_triangles.foreach_get("material_index", tmat)
    # tendon par face (matière « kind_tendon » dans une pièce musculaire) : les sommets de ces faces sont dédoublés
    names = [m.name if m else "" for m in me.materials]
    is_tendon = np.array([n == "kind_tendon" for n in names] or [False])[np.clip(tmat, 0, max(0, len(names) - 1))]
    face_part = np.where(is_tendon, 1, pid) if pid >= 2 else np.full(nt, pid)
    key = tri.reshape(-1, 3) * 2 + (face_part[:, None] == 1)  # (sommet, tendon ?) → nouveau sommet
    uniq, inv = np.unique(key.ravel(), return_inverse=True)
    vid = uniq // 2
    s0, s1, sw = skin_of(o, co.reshape(-1, 3).astype(np.float64))
    skin.append(np.stack([s0[vid], s1[vid], sw[vid], np.zeros(len(vid), np.uint8)], axis=1))
    pos.append(co.reshape(-1, 3)[vid]); nor.append(vn.reshape(-1, 3)[vid])
    part.append(np.where(uniq % 2 == 1, 1, pid).astype(np.uint8))
    idx.append(inv.astype(np.uint32) + base)
    base += len(uniq)
    ev.to_mesh_clear()
P = np.concatenate(pos); N = np.concatenate(nor); G = np.concatenate(part); I = np.concatenate(idx); S = np.concatenate(skin)
lo, hi = P.min(0), P.max(0)
q = np.round((P - lo) / (hi - lo) * 65535 - 32768).astype(np.int16)
n8 = np.clip(np.round(N / np.maximum(1e-9, np.linalg.norm(N, axis=1, keepdims=True)) * 127), -127, 127).astype(np.int8)
# fichier binaire : positions (3 × int16), normales (4 × int8, la 4e = groupe), indices (uint32, alignés sur 4 octets)
nb = np.concatenate([n8, G.astype(np.int8)[:, None]], axis=1)
head = q.tobytes() + nb.tobytes()
pad = (-len(head)) % 4
# squelette (js/demo3d.js) : 2 segments par sommet et le poids du premier (4 × uint8), après les indices
blob = head + b"\0" * pad + I.tobytes() + S.tobytes()
open(os.path.join(OUT, "body.bin"), "wb").write(blob)
W = lambda v: [round(float(v[0]), 4), round(float(v[2]), 4), round(float(-v[1]), 4)]  # repère de l'app : x gauche, y haut, z avant
aim = {f"foot_{s}": Jx["toe"] - Jx["heel"] for s, Jx in (("r", JR), ("l", JL))}
rig = [{"n": n, "p": p, "h": W(h), "t": W(t), **({"aim": W(aim[n])} if n in aim else {})} for n, h, t, p, r in BONES]
meta = {"v": len(P), "t": len(I) // 3, "lo": [round(float(x), 5) for x in lo], "hi": [round(float(x), 5) for x in hi], "parts": PARTS,
        "off": {"pos": 0, "nor": len(P) * 6, "idx": len(head) + pad, "skin": len(head) + pad + len(I) * 4}, "bytes": len(blob), "rig": rig}
json.dump(meta, open(os.path.join(OUT, "body.json"), "w"))
counts = np.bincount(G, minlength=len(PARTS))
print(f"[{time.time()-t0:.0f}s] {meta['v']:,} sommets · {meta['t']:,} triangles · {len(blob) / 1e6:.2f} Mo", flush=True)
print("sommets par partie :", {PARTS[i]: int(c) for i, c in enumerate(counts) if c}, flush=True)
print("sommets par os :", {NAMES[i]: int(c) for i, c in enumerate(np.bincount(S[:, 0], minlength=len(NAMES)))}, flush=True)
for b in rig: print(f"  {b['n']:9s} parent {b['p']:2d}  pivot {b['h']}  bout {b['t']}", flush=True)
