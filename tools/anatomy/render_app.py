# Images de la planche anatomique de l'app, à partir du fichier propre (extract.py) :
#   - <vue>.webp        corps gris (muscles non sollicités), fond transparent
#   - <vue>-light.webp  mêmes muscles en gris clair : l'app y multiplie la couleur d'un rôle (rouge, orange…)
#   - <vue>-<groupe>.webp  masque (canal alpha) des parties visibles d'un groupe musculaire de l'app
#   - natural-<vue>.webp  écorché naturel (rouge), pour les écrans de présentation
# Modèle : « BodyParts3D - DBCLS - CC-BY-SA 2.1 Japan » et « Z-Anatomy - CC-BY-SA 4.0 ».
# Usage : python -u -I render_app.py -- <body.blend> <dossier de sortie> [largeur hauteur échantillons]
import sys, os, math, time, json
import bpy
import numpy as np
from mathutils import Vector

ARGS = sys.argv[sys.argv.index("--") + 1:]
BLEND, OUT = ARGS[0], ARGS[1]
W, H, SPP = (int(ARGS[2]), int(ARGS[3]), int(ARGS[4])) if len(ARGS) > 4 else (520, 1110, 64)
os.makedirs(OUT, exist_ok=True)
RAW = os.path.join(OUT, "raw"); os.makedirs(RAW, exist_ok=True)
t0 = time.time()
bpy.ops.wm.open_mainfile(filepath=BLEND, load_ui=False, use_scripts=False)
sc = bpy.data.scenes["GT"]
objs = [o for o in sc.objects if o.type == "MESH"]
muscles = [o for o in objs if o.get("group") == "muscle"]
tendons = [o for o in objs if o.get("group") == "tendon"]
bones = [o for o in objs if o.get("group") == "bone"]

# ---------- Groupes de l'app (js/body.js MUSCLES) ----------
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
    ("lowerback", ["thoracolumbar part", "iliocostalis lumborum", "iliocostalis thoracis", "longissimus thoracis", "spinalis thoracis", "multifidus lumborum",
                   "multifidus thoracis", "quadratus lumborum", "semispinalis thoracis", "rotatores", "interspinales lumborum", "intertransversarii"]),
]
def base_name(o):
    n = o.name.lower()
    if n[-4:-3] == "." and n[-3:].isdigit():
        n = n[:-4]
    return n[:-2] if n[-2:] in (".l", ".r") else n
def center(o):
    return sum((o.matrix_world @ Vector(v) for v in o.bound_box), Vector()) / 8
def group_of(o):
    n = base_name(o)
    for g, keys in RULES:
        if any(k in n for k in keys):
            return g
    c = center(o)
    if abs(c.x) > 0.2 and 0.76 < c.z < 1.12:  # avant-bras et main (bras le long du corps)
        return "forearms"
    return None
GROUPS = {}
for o in muscles:
    g = group_of(o)
    o["grp"] = g or ""
    if g:
        GROUPS.setdefault(g, []).append(o)
for g in sorted(GROUPS):
    names = sorted({base_name(o) for o in GROUPS[g]})
    zs = [center(o).z for o in GROUPS[g]]
    print(f"  {g:10s} {len(GROUPS[g]):3d} pièces, z {min(zs):.2f}→{max(zs):.2f} : {', '.join(names)[:230]}", flush=True)

# ---------- Matières ----------
def node(nt, kind, **kw):
    n = nt.nodes.new(kind)
    for k, v in kw.items():
        setattr(n, k, v)
    return n
def fiber_noise(nt, scale_long, scale_cross, detail=3.0):
    geo = node(nt, "ShaderNodeNewGeometry"); comb = node(nt, "ShaderNodeCombineXYZ")
    for i, key in enumerate(("fx", "fy", "fz")):
        at = node(nt, "ShaderNodeAttribute", attribute_type="OBJECT", attribute_name=key)
        dot = node(nt, "ShaderNodeVectorMath", operation="DOT_PRODUCT")
        nt.links.new(geo.outputs["Position"], dot.inputs[0]); nt.links.new(at.outputs["Vector"], dot.inputs[1])
        mul = node(nt, "ShaderNodeMath", operation="MULTIPLY"); mul.inputs[1].default_value = scale_long if i == 0 else scale_cross
        nt.links.new(dot.outputs["Value"], mul.inputs[0]); nt.links.new(mul.outputs[0], comb.inputs[i])
    noi = node(nt, "ShaderNodeTexNoise"); noi.inputs["Scale"].default_value = 1.0; noi.inputs["Detail"].default_value = detail
    noi.inputs["Roughness"].default_value = 0.55
    nt.links.new(comb.outputs[0], noi.inputs["Vector"])
    return noi.outputs["Fac"]
def principled(nt):
    out = node(nt, "ShaderNodeOutputMaterial"); b = node(nt, "ShaderNodeBsdfPrincipled")
    nt.links.new(b.outputs["BSDF"], out.inputs["Surface"])
    return b
def muscle_mat(name, c0, c1, sss, coat, rough=0.5):
    """Muscle : couleur entre c0 et c1 selon les fibres, relief des fibres, léger reflet humide."""
    m = bpy.data.materials.new(name); nt = m.node_tree; nt.nodes.clear()
    bsdf = principled(nt)
    fib = fiber_noise(nt, 6.0, 260.0); blot = fiber_noise(nt, 2.0, 40.0, detail=2.0)
    mix = node(nt, "ShaderNodeMath", operation="MULTIPLY_ADD"); mix.inputs[1].default_value = 0.7
    nt.links.new(fib, mix.inputs[0]); nt.links.new(blot, mix.inputs[2])
    fac = node(nt, "ShaderNodeMath", operation="MULTIPLY"); fac.inputs[1].default_value = 0.6
    nt.links.new(mix.outputs[0], fac.inputs[0])
    ramp = node(nt, "ShaderNodeValToRGB")
    e0, e1 = ramp.color_ramp.elements
    e0.position, e1.position = 0.32, 0.72
    e0.color, e1.color = c0 + (1,), c1 + (1,)
    nt.links.new(fac.outputs[0], ramp.inputs["Fac"]); nt.links.new(ramp.outputs["Color"], bsdf.inputs["Base Color"])
    bsdf.inputs["Subsurface Weight"].default_value = sss
    bsdf.inputs["Subsurface Radius"].default_value = (1.0, 0.22, 0.12)
    bsdf.inputs["Subsurface Scale"].default_value = 0.012
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Coat Weight"].default_value = coat
    bsdf.inputs["Coat Roughness"].default_value = 0.32
    bump = node(nt, "ShaderNodeBump"); bump.inputs["Strength"].default_value = 0.22; bump.inputs["Distance"].default_value = 0.002
    nt.links.new(fib, bump.inputs["Height"]); nt.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    return m
def tissue_mat(name, color, rough, sss=0.0, coat=0.0, sheen=0.0, noise_amt=0.15, fiber=False):
    m = bpy.data.materials.new(name); nt = m.node_tree; nt.nodes.clear()
    bsdf = principled(nt)
    if fiber:
        tex = fiber_noise(nt, 4.0, 320.0)
    else:
        tc = node(nt, "ShaderNodeTexCoord"); noi = node(nt, "ShaderNodeTexNoise")
        noi.inputs["Scale"].default_value = 60.0; noi.inputs["Detail"].default_value = 4.0
        nt.links.new(tc.outputs["Object"], noi.inputs["Vector"]); tex = noi.outputs["Fac"]
    ramp = node(nt, "ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = tuple(max(0.0, c * (1 - noise_amt)) for c in color) + (1,)
    ramp.color_ramp.elements[1].color = tuple(min(1.0, c * (1 + noise_amt * 0.5)) for c in color) + (1,)
    nt.links.new(tex, ramp.inputs["Fac"]); nt.links.new(ramp.outputs["Color"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Subsurface Weight"].default_value = sss
    bsdf.inputs["Subsurface Radius"].default_value = (1.0, 0.6, 0.4)
    bsdf.inputs["Subsurface Scale"].default_value = 0.004
    bsdf.inputs["Coat Weight"].default_value = coat
    bsdf.inputs["Sheen Weight"].default_value = sheen
    bump = node(nt, "ShaderNodeBump"); bump.inputs["Strength"].default_value = 0.12; bump.inputs["Distance"].default_value = 0.0015
    nt.links.new(tex, bump.inputs["Height"]); nt.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    return m
def mask_mat():
    """Masque : blanc pour le groupe demandé (propriété « mask » = 1), noir pour tout le reste (qui cache)."""
    m = bpy.data.materials.new("GT-Mask"); nt = m.node_tree; nt.nodes.clear()
    out = node(nt, "ShaderNodeOutputMaterial"); em = node(nt, "ShaderNodeEmission")
    at = node(nt, "ShaderNodeAttribute", attribute_type="OBJECT", attribute_name="mask")
    nt.links.new(at.outputs["Fac"], em.inputs["Strength"]); em.inputs["Color"].default_value = (1, 1, 1, 1)
    nt.links.new(em.outputs["Emission"], out.inputs["Surface"])
    m.cycles.emission_sampling = "NONE"
    return m

LOOKS = {
    # écorché naturel
    "natural": {"muscle": muscle_mat("N-Muscle", (0.13, 0.012, 0.010), (0.36, 0.045, 0.035), 0.12, 0.2),
                "tendon": tissue_mat("N-Tendon", (0.64, 0.60, 0.53), 0.30, sss=0.15, coat=0.45, sheen=0.25, fiber=True),
                "bone": tissue_mat("N-Bone", (0.60, 0.53, 0.41), 0.60, sss=0.06, noise_amt=0.18),
                "cart": tissue_mat("N-Cart", (0.52, 0.56, 0.58), 0.30, sss=0.3, coat=0.3),
                "teeth": tissue_mat("N-Teeth", (0.74, 0.71, 0.64), 0.25, coat=0.4)},
    # corps gris (base de la planche)
    "base": {"muscle": muscle_mat("B-Muscle", (0.030, 0.032, 0.038), (0.062, 0.066, 0.078), 0.0, 0.2, 0.55),
             "tendon": tissue_mat("B-Tendon", (0.13, 0.135, 0.145), 0.35, coat=0.3, fiber=True),
             "bone": tissue_mat("B-Bone", (0.12, 0.122, 0.13), 0.6),
             "cart": tissue_mat("B-Cart", (0.12, 0.122, 0.13), 0.4),
             "teeth": tissue_mat("B-Teeth", (0.14, 0.14, 0.15), 0.3)},
    # muscles clairs, à colorer dans l'app (multiplication)
    "light": {"muscle": muscle_mat("L-Muscle", (0.42, 0.42, 0.42), (0.80, 0.80, 0.80), 0.0, 0.2, 0.5)},
}
MASK = mask_mat()
KIND = {}
for o in objs:
    me = o.data
    KIND[o.name] = [m.name.replace("kind_", "") if m else o.get("group") for m in me.materials]
def apply_look(look):
    mats = LOOKS.get(look, {})
    for o in objs:
        me = o.data
        for i, k in enumerate(KIND[o.name]):
            if look == "mask":
                me.materials[i] = MASK
            elif k in mats:
                me.materials[i] = mats[k]
            elif look == "light":
                me.materials[i] = LOOKS["base"][k]  # tissus blancs : comme la base (le masque ne garde que les muscles)

# ---------- Caméra, lumières, rendu ----------
def bbox(obs):
    lo, hi = Vector((1e9,) * 3), Vector((-1e9,) * 3)
    for o in obs:
        for c in o.bound_box:
            w = o.matrix_world @ Vector(c)
            lo = Vector(map(min, lo, w)); hi = Vector(map(max, hi, w))
    return lo, hi
lo, hi = bbox(objs)
ctr, height = (lo + hi) / 2, hi.z - lo.z
def mid(part):
    a, b = bbox([o for o in muscles if part in o.name]); return (a + b) / 2
front = -1.0 if mid("Rectus abdominis").y < mid("Latissimus dorsi").y else 1.0
cam_data = bpy.data.cameras.new("GT-Cam"); cam_data.lens = 85; cam_data.sensor_fit = "VERTICAL"
cam = bpy.data.objects.new("GT-Cam", cam_data); sc.collection.objects.link(cam); sc.camera = cam
lights = []
def area(name, rel, energy, size, color=(1, 1, 1)):
    ld = bpy.data.lights.new(name, "AREA"); ld.energy, ld.size, ld.color = energy, size, color
    ob = bpy.data.objects.new(name, ld); sc.collection.objects.link(ob); lights.append((ob, Vector(rel)))
area("Key", (-1.9, 3.2, 1.4), 520, 2.2, (1.0, 0.96, 0.92))
area("Fill", (2.4, 2.8, 0.1), 150, 3.0, (0.92, 0.95, 1.0))
area("RimL", (-1.7, -2.0, 0.9), 420, 0.9, (1.0, 0.92, 0.88))
area("RimR", (1.7, -2.0, 0.6), 420, 0.9, (0.9, 0.95, 1.0))
area("Top", (0.0, 0.6, 2.6), 200, 1.6)
def place(side):
    s = front * side
    vfov = 2 * math.atan(cam_data.sensor_height / 2 / cam_data.lens)
    dist = (height * 1.05 / 2) / math.tan(vfov / 2)
    cam.location = (ctr.x, ctr.y + s * dist, ctr.z)
    cam.rotation_euler = (ctr - Vector(cam.location)).to_track_quat("-Z", "Y").to_euler()
    for ob, rel in lights:
        ob.location = (ctr.x + rel.x * (1 if side > 0 else -1), ctr.y + s * rel.y, ctr.z + rel.z)
        ob.rotation_euler = (ctr - Vector(ob.location)).to_track_quat("-Z", "Y").to_euler()
world = bpy.data.worlds.new("W"); sc.world = world; world.node_tree.nodes.clear()
wo = world.node_tree.nodes.new("ShaderNodeOutputWorld"); bg = world.node_tree.nodes.new("ShaderNodeBackground")
bg.inputs["Color"].default_value = (0.010, 0.011, 0.015, 1); world.node_tree.links.new(bg.outputs[0], wo.inputs["Surface"])
cy = sc.cycles
sc.render.engine = "CYCLES"; cy.device = "CPU"
cy.max_bounces, cy.diffuse_bounces, cy.glossy_bounces, cy.transmission_bounces = 6, 3, 3, 2
cy.caustics_reflective = cy.caustics_refractive = False
sc.render.use_persistent_data = True
sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage = W, H, 100
sc.render.image_settings.file_format = "PNG"; sc.render.image_settings.color_mode = "RGBA"
sc.render.dither_intensity = 0.0  # pas de bruit de tramage : les images (et surtout les masques) se compressent bien mieux
for o in objs:
    o["mask"] = 0.0

def shade_settings(mask):
    if mask:
        cy.samples, cy.use_denoising, cy.max_bounces = 16, False, 0
        sc.render.film_transparent = False; bg.inputs["Color"].default_value = (0, 0, 0, 1)
        sc.view_settings.view_transform, sc.view_settings.look, sc.view_settings.exposure = "Standard", "None", 0.0
    else:
        cy.samples, cy.use_denoising, cy.max_bounces = SPP, True, 6
        try: cy.denoiser = "OPENIMAGEDENOISE"
        except Exception: pass
        sc.render.film_transparent = True; bg.inputs["Color"].default_value = (0.010, 0.011, 0.015, 1)
        sc.view_settings.view_transform = "AgX"
        try: sc.view_settings.look = "AgX - Punchy"
        except Exception: pass
        sc.view_settings.exposure = -0.35

def render(path):
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True, scene=sc.name)

made = {}
for view, side in (("front", +1), ("back", -1)):
    place(side)
    shade_settings(False)
    for look, name in (("base", f"{view}.png"), ("light", f"{view}-light.png"), ("natural", f"natural-{view}.png")):
        if os.path.exists(os.path.join(RAW, name)):
            continue  # déjà rendue
        apply_look(look); t1 = time.time()
        render(os.path.join(RAW, name))
        print(f"[{time.time()-t0:.0f}s] {name} ({time.time()-t1:.0f} s)", flush=True)
    apply_look("mask"); shade_settings(True)
    made[view] = []
    for g, members in sorted(GROUPS.items()):
        for o in objs:
            o["mask"] = 0.0
        for o in members:
            o["mask"] = 1.0
        for o in objs:
            o.update_tag()
        render(os.path.join(RAW, f"{view}-{g}.png"))
        made[view].append(g)
    print(f"[{time.time()-t0:.0f}s] masques {view} : {len(made[view])}", flush=True)
json.dump({"w": W, "h": H, "views": made, "groups": {g: sorted({base_name(o) for o in GROUPS[g]}) for g in GROUPS}},
          open(os.path.join(RAW, "manifest.json"), "w"), indent=1)
print(f"[{time.time()-t0:.0f}s] terminé", flush=True)
