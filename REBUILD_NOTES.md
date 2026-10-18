# Deep Sea Fall — reference reconstruction, 2026-10-12

Local project: `/home/spark/will/DeepSeaFall`.

Open `model-review.html` for orbit/zoom and the girl, face, whale and encounter
views. `cinematic.html` runs a 36-second real-time 3D sequence with pause and seek:
descent, emergence, encounter, ascent and brighter water. `index.html` retains
the playable game and its controls, now with the same rebuilt meshes.

The user's three front/side/back character references define the brown fringe,
low ponytail, pale green straps and dress, and bare feet. The fourth reference
defines the canyon composition, overhead water light and giant humpback.

This is a reconstruction from screenshots, **not an exact copy of the original
production models or animation**. Facial likeness, hair, mouth anatomy, cloth
simulation and lighting remain visibly different. The WebGL sequence does not
recreate the original fluid simulation or full original choreography.

## Assets and reproducibility

`assets/usd/girl.glb` and `whale.glb` are actual triangle meshes with embedded
PBR materials, smooth normals and textures. USDA assets use PreviewSurface,
relative texture paths and Y-up metre units. The web character has 19 runtime
skeletal joints generated from the actual anatomical landmarks in
`js/three/rig-data.js`; GLB/USDA exports contain rest meshes, not a baked animation
or an exported UsdSkel. Hair, skirt, tail and flippers deform in the real-time
renderer. Cetacean tail motion is vertical.

Run `/home/spark/env_isaaclab/bin/python assets/scripts/rebuild_realistic.py`.
The historical `generate_usd_from_style.py` command delegates to this generator.

The reusable data in `assets/sources/makehuman` comes from
[MakeHuman hm08](https://github.com/makehumancommunity/makehuman/tree/master/makehuman/data).
The base mesh header explicitly releases the asset as CC0, crediting Data
Collection AB, Joel Palmius and Jonas Hauquier. Female macro targets come from
the same distributed data collection. The whale, garment, hair geometry and
surface maps were created for this reconstruction. Three.js r170 is vendored
locally under its MIT license.

Original visual reference:
[IMAGO / Incheon Airport Media Tower — Girl and Whale](https://www.behance.net/gallery/248368373/Incheon-Airport-Media-Tower-Girl-and-Whale).
Reference screenshots are not used as substitutes for 3D geometry.

## Verification

`assets/previews/v2/verification.json`: browser exception and failed local
resource checks, skeletal mesh and joint counts, animation changes, and manual
game controls. Actual rendered screenshots cover model detail, five animation
phases and mobile gameplay. Rendering QA uses Chromium WebGL software rendering;
hardware performance on mobile is not benchmarked. USDs are independently
parsed with the installed OpenUSD libraries. The revised Isaac camera axis
conversion is code-checked; a new Isaac RTX cinematic was not rendered.
