# Rendu réaliste du corps à partir du fichier propre (extract.py). Cycles, processeur.
# Modèle : « BodyParts3D - DBCLS - CC-BY-SA 2.1 Japan » et « Z-Anatomy - CC-BY-SA 4.0 ».
# Usage : python -u -I render_showcase.py -- <body.blend> <dossier de sortie> <preview|final> <vues>
# Vues : front, back (écorché naturel), bench (développé couché, face), pullup (tractions, dos), squat (face)
import sys, os, math, time, threading
import bpy
from mathutils import Vector

BLEND, OUT, MODE = sys.argv[sys.argv.index("--") + 1:][:3]
VIEWS = sys.argv[sys.argv.index("--") + 4].split(",")
STAGE, t0 = ["chargement"], time.time()

def rss():
    for line in open("/proc/self/status"):
        if line.startswith("VmRSS:"):
            return int(line.split()[1]) / 1e6
    return 0.0
def watch():
    n = 0
    while True:
        time.sleep(2); n += 1
        r = rss()
        if n % 15 == 0:
            print(f"   · mémoire {r:.1f} Go ({STAGE[0]})", flush=True)
        if r > 10.0:
            print(f"!!! ARRÊT : {r:.1f} Go pendant « {STAGE[0]} »", flush=True); os._exit(3)
threading.Thread(target=watch, daemon=True).start()

bpy.ops.wm.open_mainfile(filepath=BLEND, load_ui=False, use_scripts=False)
sc = bpy.data.scenes["GT"]
bpy.context.window_manager  # (pas de fenêtre en arrière-plan)
objs = [o for o in sc.objects if o.type == "MESH"]
muscles = [o for o in objs if o.get("group") == "muscle"]
tendons = [o for o in objs if o.get("group") == "tendon"]
bones = [o for o in objs if o.get("group") == "bone"]
print(f"[{time.time()-t0:.0f}s] {len(muscles)} muscles · {len(tendons)} tendons · {len(bones)} os", flush=True)

# ---------- Matières ----------
def node(nt, kind, loc=(0, 0), **kw):
    n = nt.nodes.new(kind); n.location = loc
    for k, v in kw.items():
        setattr(n, k, v)
    return n

def fiber_noise(nt, scale_long, scale_cross, detail=3.0):
    """Bruit étiré le long de l'axe principal de la pièce (propriétés fx, fy, fz de l'objet) : stries des fibres."""
    geo = node(nt, "ShaderNodeNewGeometry")
    comb = node(nt, "ShaderNodeCombineXYZ")
    for i, key in enumerate(("fx", "fy", "fz")):
        at = node(nt, "ShaderNodeAttribute", attribute_type="OBJECT", attribute_name=key)
        dot = node(nt, "ShaderNodeVectorMath", operation="DOT_PRODUCT")
        nt.links.new(geo.outputs["Position"], dot.inputs[0]); nt.links.new(at.outputs["Vector"], dot.inputs[1])
        mul = node(nt, "ShaderNodeMath", operation="MULTIPLY"); mul.inputs[1].default_value = scale_long if i == 0 else scale_cross
        nt.links.new(dot.outputs["Value"], mul.inputs[0]); nt.links.new(mul.outputs[0], comb.inputs[i])
    noi = node(nt, "ShaderNodeTexNoise")
    noi.inputs["Scale"].default_value = 1.0; noi.inputs["Detail"].default_value = detail; noi.inputs["Roughness"].default_value = 0.55
    nt.links.new(comb.outputs[0], noi.inputs["Vector"])
    return noi.outputs["Fac"]

def principled(nt):
    out = node(nt, "ShaderNodeOutputMaterial", (900, 0))
    b = node(nt, "ShaderNodeBsdfPrincipled", (600, 0))
    nt.links.new(b.outputs["BSDF"], out.inputs["Surface"])
    return b

def muscle_material():
    m = bpy.data.materials.new("GT-Muscle"); nt = m.node_tree; nt.nodes.clear()
    bsdf = principled(nt)
    fib = fiber_noise(nt, 6.0, 260.0)
    blot = fiber_noise(nt, 2.0, 40.0, detail=2.0)
    mix = node(nt, "ShaderNodeMath", operation="MULTIPLY_ADD"); mix.inputs[1].default_value = 0.7
    nt.links.new(fib, mix.inputs[0]); nt.links.new(blot, mix.inputs[2])
    fac = node(nt, "ShaderNodeMath", operation="MULTIPLY"); fac.inputs[1].default_value = 0.6
    nt.links.new(mix.outputs[0], fac.inputs[0])
    ramp = node(nt, "ShaderNodeValToRGB")
    e0, e1 = ramp.color_ramp.elements
    e0.position, e1.position = 0.32, 0.72
    e0.color, e1.color = (0.13, 0.012, 0.010, 1), (0.36, 0.045, 0.035, 1)
    nt.links.new(fac.outputs[0], ramp.inputs["Fac"])
    # muscles travaillés : les autres en gris neutre (dim), la cible en rouge vif (hl=1), l'aide en orange (hl=2)
    dim = node(nt, "ShaderNodeAttribute", attribute_type="OBJECT", attribute_name="dim")
    hl = node(nt, "ShaderNodeAttribute", attribute_type="OBJECT", attribute_name="hl")
    neutral = node(nt, "ShaderNodeMix", data_type="RGBA"); neutral.inputs["B"].default_value = (0.045, 0.048, 0.056, 1)
    nt.links.new(dim.outputs["Fac"], neutral.inputs["Factor"]); nt.links.new(ramp.outputs["Color"], neutral.inputs["A"])
    is1 = node(nt, "ShaderNodeMath", operation="COMPARE"); is1.inputs[1].default_value = 1.0; is1.inputs[2].default_value = 0.25
    is2 = node(nt, "ShaderNodeMath", operation="COMPARE"); is2.inputs[1].default_value = 2.0; is2.inputs[2].default_value = 0.25
    nt.links.new(hl.outputs["Fac"], is1.inputs[0]); nt.links.new(hl.outputs["Fac"], is2.inputs[0])
    red = node(nt, "ShaderNodeMix", data_type="RGBA"); red.inputs["B"].default_value = (0.60, 0.022, 0.018, 1)
    nt.links.new(is1.outputs[0], red.inputs["Factor"]); nt.links.new(neutral.outputs["Result"], red.inputs["A"])
    org = node(nt, "ShaderNodeMix", data_type="RGBA"); org.inputs["B"].default_value = (0.80, 0.25, 0.02, 1)
    nt.links.new(is2.outputs[0], org.inputs["Factor"]); nt.links.new(red.outputs["Result"], org.inputs["A"])
    gray = node(nt, "ShaderNodeValToRGB")
    gray.color_ramp.elements[0].color, gray.color_ramp.elements[1].color = (0.55, 0.55, 0.55, 1), (1, 1, 1, 1)
    nt.links.new(fac.outputs[0], gray.inputs["Fac"])
    fmod = node(nt, "ShaderNodeMix", data_type="RGBA", blend_type="MULTIPLY"); fmod.inputs["Factor"].default_value = 0.35
    nt.links.new(org.outputs["Result"], fmod.inputs["A"]); nt.links.new(gray.outputs["Color"], fmod.inputs["B"])
    nt.links.new(fmod.outputs["Result"], bsdf.inputs["Base Color"])
    em = node(nt, "ShaderNodeMath", operation="MULTIPLY_ADD"); em.inputs[1].default_value = 0.35
    em2 = node(nt, "ShaderNodeMath", operation="MULTIPLY"); em2.inputs[1].default_value = 0.18
    nt.links.new(is1.outputs[0], em.inputs[0]); nt.links.new(is2.outputs[0], em2.inputs[0]); nt.links.new(em2.outputs[0], em.inputs[2])
    nt.links.new(org.outputs["Result"], bsdf.inputs["Emission Color"]); nt.links.new(em.outputs[0], bsdf.inputs["Emission Strength"])
    bsdf.inputs["Subsurface Weight"].default_value = 0.12
    bsdf.inputs["Subsurface Radius"].default_value = (1.0, 0.22, 0.12)
    bsdf.inputs["Subsurface Scale"].default_value = 0.012
    bsdf.inputs["Roughness"].default_value = 0.50
    bsdf.inputs["Coat Weight"].default_value = 0.20
    bsdf.inputs["Coat Roughness"].default_value = 0.32
    bump = node(nt, "ShaderNodeBump"); bump.inputs["Strength"].default_value = 0.22; bump.inputs["Distance"].default_value = 0.002
    nt.links.new(fib, bump.inputs["Height"]); nt.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    m.cycles.emission_sampling = "NONE"  # la lueur se voit, mais les muscles ne servent pas de lampes
    return m

def simple_material(name, color, rough, sss=0.0, coat=0.0, sheen=0.0, noise_amt=0.15, fiber=False):
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
    nt.links.new(tex, ramp.inputs["Fac"])
    dim = node(nt, "ShaderNodeAttribute", attribute_type="OBJECT", attribute_name="dim")
    k = node(nt, "ShaderNodeMath", operation="MULTIPLY"); k.inputs[1].default_value = 0.75
    nt.links.new(dim.outputs["Fac"], k.inputs[0])
    gmix = node(nt, "ShaderNodeMix", data_type="RGBA"); gmix.inputs["B"].default_value = (0.12, 0.122, 0.13, 1)
    nt.links.new(k.outputs[0], gmix.inputs["Factor"]); nt.links.new(ramp.outputs["Color"], gmix.inputs["A"])
    nt.links.new(gmix.outputs["Result"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Subsurface Weight"].default_value = sss
    bsdf.inputs["Subsurface Radius"].default_value = (1.0, 0.6, 0.4)
    bsdf.inputs["Subsurface Scale"].default_value = 0.004
    bsdf.inputs["Coat Weight"].default_value = coat
    bsdf.inputs["Sheen Weight"].default_value = sheen
    bump = node(nt, "ShaderNodeBump"); bump.inputs["Strength"].default_value = 0.12; bump.inputs["Distance"].default_value = 0.0015
    nt.links.new(tex, bump.inputs["Height"]); nt.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    return m

MATS = {
    "kind_muscle": muscle_material(),
    "kind_tendon": simple_material("GT-Tendon", (0.64, 0.60, 0.53), 0.30, sss=0.15, coat=0.45, sheen=0.25, fiber=True),
    "kind_bone": simple_material("GT-Bone", (0.60, 0.53, 0.41), 0.60, sss=0.06, noise_amt=0.18),
    "kind_cart": simple_material("GT-Cartilage", (0.52, 0.56, 0.58), 0.30, sss=0.3, coat=0.3),
    "kind_teeth": simple_material("GT-Teeth", (0.74, 0.71, 0.64), 0.25, coat=0.4),
}
for o in objs:
    me = o.data
    for i, m in enumerate(list(me.materials)):
        if m and m.name in MATS:
            me.materials[i] = MATS[m.name]
    o["hl"] = 0.0; o["dim"] = 0.0
print(f"[{time.time()-t0:.0f}s] matières posées", flush=True)

# ---------- Cadre, lumières ----------
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
    lo_, hi_ = bbox([o for o in muscles if part in o.name])
    return (lo_ + hi_) / 2
c_abs, c_lat = mid("Rectus abdominis"), mid("Latissimus dorsi")
front = -1.0 if c_abs.y < c_lat.y else 1.0
print(f"corps {height:.2f} m, face vers {'−Y' if front < 0 else '+Y'}", flush=True)

cam_data = bpy.data.cameras.new("GT-Cam"); cam_data.lens = 85; cam_data.sensor_fit = "VERTICAL"
cam = bpy.data.objects.new("GT-Cam", cam_data); sc.collection.objects.link(cam); sc.camera = cam
lights = []
def area(name, rel, energy, size, color=(1, 1, 1)):
    ld = bpy.data.lights.new(name, "AREA"); ld.energy, ld.size, ld.color = energy, size, color
    ob = bpy.data.objects.new(name, ld); sc.collection.objects.link(ob); lights.append((ob, Vector(rel)))
area("GT-Key", (-1.9, 3.2, 1.4), 520, 2.2, (1.0, 0.96, 0.92))
area("GT-Fill", (2.4, 2.8, 0.1), 150, 3.0, (0.92, 0.95, 1.0))
area("GT-RimL", (-1.7, -2.0, 0.9), 420, 0.9, (1.0, 0.92, 0.88))
area("GT-RimR", (1.7, -2.0, 0.6), 420, 0.9, (0.9, 0.95, 1.0))
area("GT-Top", (0.0, 0.6, 2.6), 200, 1.6)

def place(side, frame=None):
    """frame = (z_bas, z_haut) en mètres pour un gros plan ; sinon le corps entier."""
    s = front * side
    vfov = 2 * math.atan(cam_data.sensor_height / 2 / cam_data.lens)
    z0, z1 = frame if frame else (lo.z, hi.z)
    tz, h = (z0 + z1) / 2, (z1 - z0) * (1.0 if frame else 1.07)
    dist = (h / 2) / math.tan(vfov / 2)
    target = Vector((ctr.x, ctr.y, tz))
    cam.location = (ctr.x, ctr.y + s * dist, tz)
    cam.rotation_euler = (target - Vector(cam.location)).to_track_quat("-Z", "Y").to_euler()
    for ob, rel in lights:
        ob.location = (ctr.x + rel.x * (1 if side > 0 else -1), ctr.y + s * rel.y, ctr.z + rel.z)
        ob.rotation_euler = (ctr - Vector(ob.location)).to_track_quat("-Z", "Y").to_euler()

world = bpy.data.worlds.new("GT-World"); sc.world = world
world.node_tree.nodes.clear()
wo = node(world.node_tree, "ShaderNodeOutputWorld"); bg = node(world.node_tree, "ShaderNodeBackground")
bg.inputs["Color"].default_value = (0.010, 0.011, 0.015, 1)
world.node_tree.links.new(bg.outputs[0], wo.inputs["Surface"])

sc.render.engine = "CYCLES"
cy = sc.cycles
cy.device = "CPU"; cy.use_denoising = True
try: cy.denoiser = "OPENIMAGEDENOISE"
except Exception: pass
cy.max_bounces, cy.diffuse_bounces, cy.glossy_bounces, cy.transmission_bounces = 6, 3, 3, 2
cy.caustics_reflective = cy.caustics_refractive = False
sc.render.use_persistent_data = True
sc.view_settings.view_transform = "AgX"
try: sc.view_settings.look = "AgX - Punchy"
except Exception: pass
if MODE == "preview":
    sc.render.resolution_x, sc.render.resolution_y, cy.samples = 405, 720, 16
else:
    sc.render.resolution_x, sc.render.resolution_y, cy.samples = 1080, 1920, 64
sc.render.resolution_percentage = 100
sc.render.image_settings.file_format = "PNG"
sc.view_settings.exposure = -0.35

EXAMPLES = {
    "bench": (+1, ["pectoralis major"], ["Clavicular part of deltoid", "triceps brachii"]),
    "pullup": (-1, ["Latissimus dorsi"], ["biceps brachii", "Teres major", "Rhomboid", "Scapular spinal part of deltoid", "Ascending part of trapezius", "Transverse part of trapezius"]),
    "squat": (+1, ["Vastus", "Rectus femoris", "Gluteus maximus"], ["Adductor magnus", "Adductor longus", "Soleus", "Erector spinae", "Rectus abdominis"]),
}
def set_highlight(primary=(), secondary=()):
    on = bool(primary or secondary)
    for o in bones:
        o["dim"] = 1.0 if on else 0.0
        o.update_tag()
    for o in muscles + tendons:
        nl = o.name.lower()
        o["hl"] = 1.0 if any(k.lower() in nl for k in primary) else 2.0 if any(k.lower() in nl for k in secondary) else 0.0
        o["dim"] = 1.0 if on else 0.0
        o.update_tag()

for v in VIEWS:
    if v in EXAMPLES:
        side, prim, sec = EXAMPLES[v]
        set_highlight(prim, sec)
        print(f"{v} : {sum(1 for o in muscles if o['hl'] == 1.0)} pièces principales, {sum(1 for o in muscles if o['hl'] == 2.0)} secondaires", flush=True)
    else:
        side = -1 if v.startswith("back") else +1
        set_highlight()
    zoom = {"torso": (lo.z + height * 0.55, lo.z + height * 0.90), "backtorso": (lo.z + height * 0.55, lo.z + height * 0.90)}.get(v)
    place(side, zoom)
    sc.render.filepath = f"{OUT}/{MODE}-{v}.png"
    STAGE[0] = f"rendu {v}"
    t1 = time.time()
    bpy.ops.render.render(write_still=True, scene=sc.name)
    print(f"[{time.time()-t0:.0f}s] {v} rendu en {time.time()-t1:.0f} s · mémoire {rss():.1f} Go → {sc.render.filepath}", flush=True)
print("terminé", flush=True)
