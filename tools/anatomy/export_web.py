# Corps 3D allégé pour la vue 3D de l'app (js/body3d.js, WebGL sans bibliothèque), à partir du fichier propre
# (extract.py) : muscles, tendons et os décimés, un groupe par sommet (os, tendon, muscle « autre », ou l'un des 17
# groupes musculaires de l'app), positions sur 16 bits, normales sur 8 bits, indices sur 32 bits, et le squelette des
# démos animées : pour chaque sommet, les deux segments qui le portent, le poids du premier et, sur l'avant-bras, la part
# de la rotation (pronation / supination) qu'il suit. Les mains ont leurs doigts : trois phalanges par doigt (chaque doigt
# plie autour de ses propres articulations, les quatre doigts du même angle) et le pouce en trois segments.
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

# Main : centres des articulations (métacarpo-phalangiennes, interphalangiennes, pointe) des doigts 2 à 5 et du pouce, là où
# deux os se touchent. Chaque rangée d'articulations (les quatre doigts) plie autour d'un même axe : la droite qui passe au
# plus près des quatre centres, perpendiculaire aux phalanges ; « vers la paume » est le sens où les doigts s'enroulent.
FINGERS = ["second", "third", "fourth", "fifth"]
def joint(A, B, tol=0.002):
    A2, B2 = A[::max(1, len(A) // 600)], B[::max(1, len(B) // 600)]
    dA = np.min(np.linalg.norm(A2[:, None, :] - B2[None, :, :], axis=2), axis=1)
    dB = np.min(np.linalg.norm(B2[:, None, :] - A2[None, :, :], axis=2), axis=1)
    m = min(dA.min(), dB.min())
    return (A2[dA < m + tol].mean(0) + B2[dB < m + tol].mean(0)) / 2
unit = lambda v: v / max(1e-12, np.linalg.norm(v))
def hand_side(s, Jx):
    rows = {"mcp": [], "pip": [], "dip": [], "tip": []}
    for f in FINGERS:
        mc, pp = V(f"{f} metacarpal bone.{s}"), V(f"proximal phalanx of {f} finger of hand.{s}")
        mp, dp = V(f"middle phalanx of {f} finger of hand.{s}"), V(f"distal phalanx of {f} finger of hand.{s}")
        rows["mcp"].append(joint(mc, pp)); rows["pip"].append(joint(pp, mp)); rows["dip"].append(joint(mp, dp))
        rows["tip"].append(dp[np.argmax(np.linalg.norm(dp - rows["dip"][-1], axis=1))])
    R = {k: np.array(v) for k, v in rows.items()}
    mc1, pp1, dp1 = V(f"first metacarpal bone.{s}"), V(f"proximal phalanx of first finger of hand.{s}"), V(f"distal phalanx of first finger of hand.{s}")
    cmc, mcp1, ip1 = joint(V(f"trapezium bone.{s}"), mc1), joint(mc1, pp1), joint(pp1, dp1)
    tip1 = dp1[np.argmax(np.linalg.norm(dp1 - ip1, axis=1))]
    C = {k: R[k].mean(0) for k in R}
    D = unit(C["mcp"] - Jx["wrist"])  # paume : du poignet aux jointures
    curl = unit((C["tip"] - C["mcp"]) - ((C["tip"] - C["mcp"]) @ D) * D)  # les doigts au repos s'enroulent vers la paume
    def row_axis(P, d):  # droite au plus près des centres, rendue perpendiculaire à la direction d des phalanges
        a = np.linalg.svd(P - P.mean(0))[2][0]
        return unit(a - (a @ d) * d)
    K = row_axis(R["mcp"], D)
    if np.cross(K, D) @ curl < 0: K = -K
    n = unit(np.cross(K, D))  # normale de la paume (côté paume)
    seg = [("mcp", "pip"), ("pip", "dip"), ("dip", "tip")]
    ax = []
    for a, b in seg:
        d = unit((R[b] - R[a]).mean(0)); k = row_axis(R[a], d)
        ax.append(k if np.cross(k, d) @ n > 0 else -k)  # tourner de + autour de l'axe : plier vers la paume
    # pouce : écartement vers l'avant de la paume (ab), opposition vers l'auriculaire (op), flexion des phalanges (ax)
    u = unit(R["mcp"][3] - R["mcp"][0])  # de l'index vers l'auriculaire
    def toward(d, w):  # axe qui fait tourner d vers w
        w = w - (w @ d) * d
        return unit(np.cross(d, w))
    d1, d2, d3 = unit(mcp1 - cmc), unit(ip1 - mcp1), unit(tip1 - ip1)
    thumb = dict(cmc=cmc, mcp1=mcp1, ip1=ip1, tip1=tip1, ab=toward(d1, n), op=toward(d1, u),
                 ax2=toward(d2, u + 0.3 * n), ax3=toward(d3, u + 0.3 * n))
    return dict(rows=R, C=C, n=n, ax=ax, **thumb)
HL, HR = hand_side("l", JL), hand_side("r", JR)
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
              (f"farm_{s}", Jx["elbow"], Jx["wrist"], None, 0.038), (f"hand_{s}", Jx["wrist"], (HR if s == "r" else HL)["C"]["mcp"], None, 0.032)]
for s, Jx in (("r", JR), ("l", JL)):
    BONES += [(f"thigh_{s}", Jx["hip"], Jx["knee"], 0, 0.075), (f"shin_{s}", Jx["knee"], Jx["ankle"], None, 0.052),
              (f"foot_{s}", Jx["ankle"], Jx["toe"], None, 0.035)]
for s, H in (("r", HR), ("l", HL)):
    BONES += [(f"thumb1_{s}", H["cmc"], H["mcp1"], None, 0.012), (f"thumb2_{s}", H["mcp1"], H["ip1"], None, 0.009),
              (f"thumb3_{s}", H["ip1"], H["tip1"], None, 0.008)]
for s, H in (("r", HR), ("l", HL)):  # rangées de phalanges (proximales, moyennes, distales) : une rotation pour les 4 doigts
    BONES += [(f"fing{k + 1}_{s}", H["C"][a], H["C"][b], None, 0.008) for k, (a, b) in enumerate([("mcp", "pip"), ("pip", "dip"), ("dip", "tip")])]
NAMES = [b[0] for b in BONES]
PARENT = {"uarm": "clav", "farm": "uarm", "hand": "farm", "shin": "thigh", "foot": "shin", "thumb1": "hand", "thumb2": "thumb1", "thumb3": "thumb2",
          "fing1": "hand", "fing2": "fing1", "fing3": "fing2"}
BONES = [(n, h, t, p if p is not None else NAMES.index(f"{PARENT[n[:-2]]}{n[-2:]}"), r) for n, h, t, p, r in BONES]
# axes des capsules de répartition : le long des os, le tronc décalé vers l'avant (centre du thorax, pas la colonne)
CAP = []
for n, h, t, p, r in BONES:
    if n.startswith(("thumb", "fing")):
        CAP.append(None); continue
    if n.startswith("hand"):  # la main entière, du poignet au bout du majeur
        t = (JR if n.endswith("r") else JL)["tip"]
    h2, t2 = h.copy(), t.copy()
    if n in ("pelvis", "abdomen", "chest"):
        h2[1] -= 0.045; t2[1] -= 0.045
    CAP.append((h2, t2, r))
NB = len(NAMES)
# os « virtuels » des doigts : la rangée k (1 à 3) du doigt f (0 index … 3 auriculaire) de chaque côté. Ils partagent la
# rotation de leur rangée (fing1…3) mais pivotent autour de leurs propres articulations (js/demo3d.js).
VNAMES = [f"f{k}_{f}_{s}" for s in ("r", "l") for k in (1, 2, 3) for f in range(4)]
B = {n: i for i, n in enumerate(NAMES + VNAMES)}

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
        if has("phalanx") and has("of hand"):
            k = 1 if n.startswith("proximal") else 2 if n.startswith("middle") else 3
            if has("first finger"): return f"thumb{2 if k == 1 else 3}_{s}"
            return f"f{k}_{next(i for i, f in enumerate(FINGERS) if f'{f} finger' in n)}_{s}"
        if has("first metacarpal"): return f"thumb1_{s}"
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

# Points des os de la main et de l'avant-bras, rangés par segment : les tissus de la main suivent l'os le plus proche
# (tendons des doigts, muscles de la paume et du pouce), avec un fondu sur quelques millimètres autour des articulations.
def hand_points(s):
    pts, lab = [], []
    for o in objs:
        if o.get("group") != "bone": continue
        rb = rigid_bone(o)
        if not rb or not rb.endswith("_" + s) or not rb.startswith(("farm", "hand", "thumb", "f1", "f2", "f3")): continue
        P = V(base_name(o) + "." + s); P = P[::max(1, len(P) // 300)]
        pts.append(P); lab.append(np.full(len(P), B[rb]))
    P, L = np.concatenate(pts), np.concatenate(lab)
    order = np.argsort(L, kind="stable"); P, L = P[order], L[order]
    starts = np.r_[0, np.flatnonzero(np.diff(L)) + 1]
    return P, L[starts], starts
HP = {s: hand_points(s) for s in ("r", "l")}
def refine_hand(co, s):
    P, labels, starts = HP[s]
    s0, s1, w = np.empty(len(co), np.uint8), np.empty(len(co), np.uint8), np.empty(len(co), np.uint8)
    for a in range(0, len(co), 2000):
        d = np.linalg.norm(co[a:a + 2000, None, :] - P[None, :, :], axis=2)
        per = np.minimum.reduceat(d, starts, axis=1)  # distance à chaque segment
        o2 = np.argsort(per, axis=1)[:, :2]
        d1, d2 = np.take_along_axis(per, o2, 1).T
        s0[a:a + 2000], s1[a:a + 2000] = labels[o2[:, 0]], labels[o2[:, 1]]
        w[a:a + 2000] = np.round(255 / (1 + np.exp(-(d2 - d1) / 0.0035)))
    return s0, s1, w

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
    s0, s1, w = c[order[:, 0]].astype(np.uint8), c[order[:, 1]].astype(np.uint8), np.round(w1 * 255).astype(np.uint8)
    for s in ("r", "l"):  # main : au plus près des os (doigts, pouce, paume, poignet)
        m = (s0 == B[f"hand_{s}"]) | (s1 == B[f"hand_{s}"])
        if m.any(): s0[m], s1[m], w[m] = refine_hand(co[m], s)
    return s0, s1, w

# Pronation / supination : l'avant-bras tourne progressivement du coude (0) au poignet (1). Octet : 0 sans rotation,
# 1 à 127 avant-bras droit, 128 à 254 avant-bras gauche (la part de la rotation sur 126).
def twist_of(co, s0, s1):
    out = np.zeros(len(co), np.uint8)
    for s, Jx, b0 in (("r", JR, 1), ("l", JL, 128)):
        m = (s0 == B[f"farm_{s}"]) | (s1 == B[f"farm_{s}"])
        if not m.any(): continue
        e, w = Jx["elbow"], Jx["wrist"]
        t = np.clip(((co[m] - e) @ (w - e)) / ((w - e) @ (w - e)), 0, 1)
        out[m] = b0 + np.round(t * 126).astype(np.uint8)
    return out

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
    co64 = co.reshape(-1, 3).astype(np.float64)
    s0, s1, sw = skin_of(o, co64)
    tw = twist_of(co64, s0, s1)
    skin.append(np.stack([s0[vid], s1[vid], sw[vid], tw[vid]], axis=1))
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
EXTRA = {}
for s, H in (("r", HR), ("l", HL)):
    EXTRA[f"hand_{s}"] = {"pn": W(H["n"])}  # normale de la paume
    EXTRA[f"thumb1_{s}"] = {"ab": W(H["ab"]), "op": W(H["op"])}
    EXTRA[f"thumb2_{s}"], EXTRA[f"thumb3_{s}"] = {"ax": W(H["ax2"])}, {"ax": W(H["ax3"])}
    for k in range(3): EXTRA[f"fing{k + 1}_{s}"] = {"ax": W(H["ax"][k])}
rig = [{"n": n, "p": p, "h": W(h), "t": W(t), **({"aim": W(aim[n])} if n in aim else {}), **EXTRA.get(n, {})} for n, h, t, p, r in BONES]
# articulations de chaque doigt (index → auriculaire) : métacarpo-phalangienne, interphalangiennes, pointe
fingers = {s: [[W(H["rows"][k][f]) for k in ("mcp", "pip", "dip", "tip")] for f in range(4)] for s, H in (("r", HR), ("l", HL))}
meta = {"v": len(P), "t": len(I) // 3, "lo": [round(float(x), 5) for x in lo], "hi": [round(float(x), 5) for x in hi], "parts": PARTS,
        "off": {"pos": 0, "nor": len(P) * 6, "idx": len(head) + pad, "skin": len(head) + pad + len(I) * 4}, "bytes": len(blob), "rig": rig,
        "fingers": fingers, "frow": NAMES.index("fing1_r")}
json.dump(meta, open(os.path.join(OUT, "body.json"), "w"))
counts = np.bincount(G, minlength=len(PARTS))
print(f"[{time.time()-t0:.0f}s] {meta['v']:,} sommets · {meta['t']:,} triangles · {len(blob) / 1e6:.2f} Mo", flush=True)
print("sommets par partie :", {PARTS[i]: int(c) for i, c in enumerate(counts) if c}, flush=True)
print("sommets par os :", {(NAMES + VNAMES)[i]: int(c) for i, c in enumerate(np.bincount(S[:, 0], minlength=len(B)))}, flush=True)
print("sommets qui tournent avec l'avant-bras :", int((S[:, 3] > 0).sum()), flush=True)
for b in rig: print(f"  {b['n']:9s} parent {b['p']:2d}  pivot {b['h']}  bout {b['t']}", flush=True)
