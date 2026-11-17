# Planche d'anatomie 3D

Ces scripts fabriquent les images de `assets/anatomy/` (planche des muscles de l'app) à partir d'un modèle
anatomique libre, avec [Blender](https://www.blender.org/) utilisé comme module Python (`bpy`). Rien ne tourne dans
l'app : seules les images WebP produites sont livrées.

## Modèle

- **BodyParts3D** — The Database Center for Life Science — CC BY-SA 2.1 Japan
- **Z-Anatomy** — The libre 3D atlas of anatomy — CC BY-SA 4.0 ([dépôt](https://github.com/Z-Anatomy/Models-of-human-anatomy))

Les images dérivées sont sous **CC BY-SA 4.0** (voir `assets/anatomy/LICENSE.md`). Le crédit est affiché dans l'app.

## Fabriquer les images

```sh
# 1. Le modèle (un fichier Blender de 300 Mo dans une archive)
git clone --depth 1 https://github.com/Z-Anatomy/Models-of-human-anatomy za
unzip za/Z-Anatomy.zip "Z-Anatomy/Startup.blend" -d za-data

# 2. Blender en module Python, et Pillow pour le WebP
python3 -m venv .venv && .venv/bin/pip install bpy pillow

# 3. Géométrie propre (muscles, tendons, os) dans un fichier léger
.venv/bin/python -u -I tools/anatomy/extract.py -- za-data/Z-Anatomy/Startup.blend body.blend

# 4. Rendus de l'app (corps gris, couche éclairée, écorché, un masque par groupe), face et dos (~4 min, 4 cœurs)
.venv/bin/python -u -I tools/anatomy/render_app.py -- body.blend out 520 1110 64

# 5. Conversion en WebP dans l'app
.venv/bin/python -I tools/anatomy/pack_app.py out/raw assets/anatomy
```

`render_showcase.py` fait des rendus de présentation en grand (corps entier, gros plan du torse, exemples de
« muscles travaillés »).

## À savoir

- Le fichier du modèle contient un script Python : il est ouvert **sans l'exécuter** (`use_scripts=False`).
- Rendu direct du fichier d'origine : la mémoire explose (étiquettes, dépendances, attributs). `extract.py` n'en garde
  que la géométrie (sommets, faces, matières par face, position) : le rendu passe de plus de 10 Go à moins de 3 Go.
- Les groupes musculaires de l'app (`ANAT_GROUPS` dans `js/anatomy.js`, mêmes clés que `MUSCLES` dans `js/body.js`)
  sont attribués par nom (`RULES` dans `render_app.py`) puis par position (avant-bras et mains).
- Deux pièces du modèle sont découpées par zone dans `extract.py` : la gaine du grand droit, portée par l'oblique
  externe (c'est elle qu'on voit sur le ventre, rattachée aux abdos), et la nappe lombaire du grand dorsal (rattachée
  aux lombaires). Le platysma (fine nappe du cou) est retiré : il cachait les trapèzes de face.
- Dans l'app, un muscle allumé = la couche éclairée multipliée par la couleur de son rôle (`background-blend-mode:
  multiply`), découpée par le masque du groupe (`mask-image`) : le relief et les fibres restent visibles.
