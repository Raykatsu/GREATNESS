# Extrait la géométrie pure du corps (muscles, tendons, os) du modèle Z-Anatomy dans un .blend neuf et léger :
# seulement les sommets, les faces, les matières par face (muscle / tendon / os / cartilage / dents) et la position de
# chaque pièce. Rien d'autre (étiquettes, dépendances, attributs, modificateurs) : c'est ce qui faisait exploser la mémoire.
# Modèle : « BodyParts3D - The Database Center for Life Science - CC-BY-SA 2.1 Japan » et
#          « Z-Anatomy - The libre 3D atlas of anatomy - CC-BY-SA 4.0 ».
# Usage : python -u -I extract.py -- <Startup.blend> <sortie clean.blend>
import sys, time
import bpy
import numpy as np

SRC, DST = sys.argv[sys.argv.index("--") + 1:][:2]
t0 = time.time()
bpy.ops.wm.open_mainfile(filepath=SRC, load_ui=False, use_scripts=False)
MUS, SK = bpy.data.collections["4: Muscular system"], bpy.data.collections["1: Skeletal system"]
WHITE = {"Tendon", "Fascia", "Ligament", "Articular capsule", "Bursa"}
SKIP_MAT = {"Fascia", "Bursa", "Articular capsule", "Ligament"}
SKIP_WORDS = ("bursa", "fascia", "sheath", "capsule")

def first_mat(ob):
    return next((m.name for m in ob.data.materials if m), None)

def world_bbox_center(ob):
    M = np.array(ob.matrix_world)
    c = np.array([list(v) for v in ob.bound_box]) @ M[:3, :3].T + M[:3, 3]
    return c.mean(0)

picked = []  # (objet, groupe)
for ob in MUS.objects:
    if ob.type != "MESH":
        continue
    n, m = ob.name, first_mat(ob)
    if n.startswith("(") or n.endswith((".j", ".g")) or not m or m in SKIP_MAT or any(w in n.lower() for w in SKIP_WORDS):
        continue
    if n.lower().startswith("platysma"):  # fine nappe du cou : elle cache les trapèzes et les sterno-cléido-mastoïdiens
        continue
    picked.append((ob, "tendon" if m == "Tendon" else "muscle"))
for ob in SK.objects:
    if ob.type == "MESH" and not ob.hide_render and not ob.name.endswith((".j", ".g")):
        picked.append((ob, "bone"))
# pièces rangées ailleurs dans le modèle mais visibles sur un écorché (ligne blanche du ventre)
for name in ("Linea alba",):
    ob = bpy.data.objects.get(name)
    if ob and ob.type == "MESH" and all(ob is not o for o, _ in picked):
        picked.append((ob, "tendon"))
picked = [(o, g) for o, g in picked if abs(world_bbox_center(o)[0]) < 0.5 and abs(world_bbox_center(o)[1]) < 0.5]
print(f"[{time.time()-t0:.0f}s] {len(picked)} pièces retenues", flush=True)

# matières « emplacements » : le rendu les remplace par les vraies
KINDS = {k: bpy.data.materials.new("kind_" + k) for k in ("muscle", "tendon", "bone", "cart", "teeth")}
def kind_of(orig_name, group):
    if orig_name in WHITE:
        return "tendon"
    ln = (orig_name or "").lower()
    if group == "bone":
        return "cart" if "cartil" in ln else "teeth" if "teeth" in ln else "bone"
    return "tendon" if group == "tendon" else "muscle"

def world_verts(ob):
    n = len(ob.data.vertices); co = np.empty(n * 3, np.float32); ob.data.vertices.foreach_get("co", co)
    M = np.array(ob.matrix_world, dtype=np.float64)
    return co.reshape(-1, 3).astype(np.float64) @ M[:3, :3].T + M[:3, 3]

# Découpes par zone : dans ce modèle, l'oblique externe porte aussi la gaine qui recouvre le grand droit (c'est elle
# qu'on voit de face sur le ventre) et le grand dorsal la nappe qui recouvre les lombaires. On rattache ces zones aux
# groupes que l'œil y voit (abdos, lombaires) en les séparant en pièces à part.
ra = np.vstack([world_verts(o) for o, _ in picked if o.name.startswith("Rectus abdominis muscle")])
RA_X, RA_Z = float(np.abs(ra[:, 0]).max()) + 0.004, (float(ra[:, 2].min()), float(ra[:, 2].max()))
SPLITS = {  # nom de base → (nom de la pièce séparée, faces à séparer d'après leur centre)
    "External abdominal oblique muscle": ("Anterior rectus sheath",
        lambda c: (np.abs(c[:, 0]) < RA_X) & (c[:, 1] < -0.02) & (c[:, 2] > RA_Z[0]) & (c[:, 2] < RA_Z[1])),
    "Latissimus dorsi muscle": ("Thoracolumbar part of latissimus dorsi",
        lambda c: (np.abs(c[:, 0]) < 0.075) & (c[:, 2] < 1.12) & (c[:, 1] > 0)),
}

def build(name, w, lv, ls, lt, mi, mats, group, flip, faces=None):
    """Crée une pièce propre, avec toutes les faces ou seulement celles de « faces » (sommets renumérotés)."""
    if faces is not None:
        idx = np.nonzero(faces)[0]
        if not len(idx):
            return 0
        lt = lt[idx]
        loops = np.concatenate([np.arange(s, s + t) for s, t in zip(ls[idx], lt)])
        used, lv = np.unique(lv[loops], return_inverse=True)
        w, mi = w[used], mi[idx]
        ls = np.concatenate([[0], np.cumsum(lt)[:-1]]).astype(np.int32)
    lv = lv.astype(np.int32)
    me = bpy.data.meshes.new(name)
    me.vertices.add(len(w)); me.vertices.foreach_set("co", w.astype(np.float32).ravel())
    me.loops.add(len(lv)); me.loops.foreach_set("vertex_index", lv)
    me.polygons.add(len(lt)); me.polygons.foreach_set("loop_start", ls); me.polygons.foreach_set("loop_total", lt)
    for mat in mats:
        me.materials.append(mat)
    me.polygons.foreach_set("material_index", mi.astype(np.int32))
    if flip:  # pièce en miroir : on retourne les faces pour garder les normales vers l'extérieur
        me.flip_normals()
    me.validate(clean_customdata=True)
    me.update()
    me.shade_smooth()
    new = bpy.data.objects.new(name, me)
    new["group"] = group
    # axe des fibres : axe principal des sommets (ACP)
    pts = w[:: max(1, len(w) // 4000)].astype(np.float64)
    pts = pts - pts.mean(0)
    _, vec = np.linalg.eigh(np.cov(pts.T)) if len(pts) > 5 else (None, np.eye(3))
    new["fx"], new["fy"], new["fz"] = tuple(map(float, vec[:, 2])), tuple(map(float, vec[:, 1])), tuple(map(float, vec[:, 0]))
    col.objects.link(new)
    return int((lt - 2).sum())

scene = bpy.data.scenes.new("GT")
col = bpy.data.collections.new("Body")
scene.collection.children.link(col)
tri_total, n_split = 0, 0
for ob, group in picked:
    src = ob.data
    nv, nl, npoly = len(src.vertices), len(src.loops), len(src.polygons)
    if not npoly:
        continue
    lv = np.empty(nl, np.int32); src.loops.foreach_get("vertex_index", lv)
    ls = np.empty(npoly, np.int32); src.polygons.foreach_get("loop_start", ls)
    lt = np.empty(npoly, np.int32); src.polygons.foreach_get("loop_total", lt)
    mi = np.zeros(npoly, np.int32); src.polygons.foreach_get("material_index", mi)
    w = world_verts(ob)  # coordonnées monde (aucun parent dans le fichier propre)
    # matières par face
    kinds = [kind_of(m.name if m else None, group) for m in src.materials] or [kind_of(None, group)]
    order = list(dict.fromkeys(kinds))
    remap = np.array([order.index(k) for k in kinds], np.int32)
    mi = remap[np.clip(mi, 0, len(remap) - 1)]
    mats = [KINDS[k] for k in order]
    flip = np.linalg.det(np.array(ob.matrix_world)[:3, :3]) < 0
    base = ob.name[:-2] if ob.name[-2:] in (".l", ".r") else ob.name
    if base in SPLITS:
        part, pred = SPLITS[base]
        order_ok = np.all(np.diff(ls) > 0)
        fc = (np.add.reduceat(w[lv], ls, axis=0) if order_ok else np.array([w[lv[s:s + t]].sum(0) for s, t in zip(ls, lt)])) / lt[:, None]
        sel = pred(fc)
        tri_total += build(ob.name, w, lv, ls, lt, mi, mats, group, flip, ~sel)
        tri_total += build(part + ob.name[len(base):], w, lv, ls, lt, mi, mats, group, flip, sel)
        n_split += int(sel.sum())
    else:
        tri_total += build(ob.name, w, lv, ls, lt, mi, mats, group, flip)
print(f"découpes par zone : {n_split} faces rattachées à un autre groupe", flush=True)
print(f"[{time.time()-t0:.0f}s] {len(col.objects)} objets propres, {tri_total:,} triangles", flush=True)
bpy.data.libraries.write(DST, {scene}, fake_user=True, compress=True)
print(f"[{time.time()-t0:.0f}s] écrit : {DST}", flush=True)
