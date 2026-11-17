# Corps 3D allégé pour la vue 3D de l'app (js/body3d.js, WebGL sans bibliothèque), à partir du fichier propre
# (extract.py) : muscles, tendons et os décimés, un groupe par sommet (os, tendon, muscle « autre », ou l'un des 17
# groupes musculaires de l'app), positions sur 16 bits, normales sur 8 bits, indices sur 32 bits.
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

# Décimation : un modificateur par pièce, au moins ~60 triangles pour garder la forme des petites pièces
for o in objs:
    n = sum(len(p.vertices) - 2 for p in o.data.polygons)
    r = R_BONE if o.get("group") == "bone" else R_MUS
    md = o.modifiers.new("dec", "DECIMATE")
    md.decimate_type = "COLLAPSE"
    md.ratio = min(1.0, max(r, 60 / max(1, n)))
    md.use_collapse_triangulate = True
dg = bpy.context.evaluated_depsgraph_get()

pos, nor, part, idx = [], [], [], []
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
    pos.append(co.reshape(-1, 3)[vid]); nor.append(vn.reshape(-1, 3)[vid])
    part.append(np.where(uniq % 2 == 1, 1, pid).astype(np.uint8))
    idx.append(inv.astype(np.uint32) + base)
    base += len(uniq)
    ev.to_mesh_clear()
P = np.concatenate(pos); N = np.concatenate(nor); G = np.concatenate(part); I = np.concatenate(idx)
lo, hi = P.min(0), P.max(0)
q = np.round((P - lo) / (hi - lo) * 65535 - 32768).astype(np.int16)
n8 = np.clip(np.round(N / np.maximum(1e-9, np.linalg.norm(N, axis=1, keepdims=True)) * 127), -127, 127).astype(np.int8)
# fichier binaire : positions (3 × int16), normales (4 × int8, la 4e = groupe), indices (uint32, alignés sur 4 octets)
nb = np.concatenate([n8, G.astype(np.int8)[:, None]], axis=1)
head = q.tobytes() + nb.tobytes()
pad = (-len(head)) % 4
blob = head + b"\0" * pad + I.tobytes()
open(os.path.join(OUT, "body.bin"), "wb").write(blob)
meta = {"v": len(P), "t": len(I) // 3, "lo": [round(float(x), 5) for x in lo], "hi": [round(float(x), 5) for x in hi], "parts": PARTS,
        "off": {"pos": 0, "nor": len(P) * 6, "idx": len(head) + pad}, "bytes": len(blob)}
json.dump(meta, open(os.path.join(OUT, "body.json"), "w"))
counts = np.bincount(G, minlength=len(PARTS))
print(f"[{time.time()-t0:.0f}s] {meta['v']:,} sommets · {meta['t']:,} triangles · {len(blob) / 1e6:.2f} Mo", flush=True)
print("sommets par partie :", {PARTS[i]: int(c) for i, c in enumerate(counts) if c}, flush=True)
