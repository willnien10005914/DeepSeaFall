#!/usr/bin/env python3
"""Generate original Girl + Humpback Whale USD assets inspired by the
Incheon Airport Media Tower 'Girl and Whale' mood (scale contrast, surreal
deep-sea guardian whale, small falling girl) — NOT a copy of Behance files.

Outputs ASCII .usda meshes loadable by Isaac Sim / OpenUSD.
"""

from __future__ import annotations

import math
from pathlib import Path

import numpy as np
import trimesh

OUT = Path(__file__).resolve().parents[1] / "usd"
OUT.mkdir(parents=True, exist_ok=True)


def _transform(mesh: trimesh.Trimesh, translate=(0, 0, 0), scale=(1, 1, 1), rotate_y=0.0):
    m = mesh.copy()
    T = np.eye(4)
    T[:3, :3] = np.diag(scale)
    if rotate_y:
        c, s = math.cos(rotate_y), math.sin(rotate_y)
        R = np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]])
        T[:3, :3] = R @ T[:3, :3]
    T[:3, 3] = translate
    m.apply_transform(T)
    return m


def _ellipsoid(radius=1.0, subdivisions=3, scale=(1, 1, 1), **kw):
    m = trimesh.creation.icosphere(subdivisions=subdivisions, radius=radius)
    return _transform(m, scale=scale, **kw)


def build_girl() -> dict[str, trimesh.Trimesh]:
    """Small stylized girl: head, hair, dress body, limbs — soft anime-adjacent proportions."""
    parts = {}
    parts["head"] = _ellipsoid(0.13, 2, scale=(1.0, 1.15, 0.95), translate=(0, 1.55, 0))
    parts["hair"] = _ellipsoid(0.16, 2, scale=(1.15, 1.4, 1.05), translate=(0, 1.58, -0.02))
    # twin strands / flowing locks
    parts["hair_l"] = _ellipsoid(0.07, 2, scale=(0.7, 2.2, 0.7), translate=(-0.14, 1.15, -0.05))
    parts["hair_r"] = _ellipsoid(0.07, 2, scale=(0.7, 2.2, 0.7), translate=(0.14, 1.15, -0.05))
    parts["body"] = _ellipsoid(0.16, 2, scale=(0.85, 1.4, 0.65), translate=(0, 1.15, 0))
    # dress flare
    skirt = trimesh.creation.cone(radius=0.28, height=0.38, sections=24)
    skirt = _transform(skirt, translate=(0, 0.95, 0), scale=(1, 1, 1))
    # cone points up by default in trimesh — flip
    skirt.apply_transform(trimesh.transformations.rotation_matrix(math.pi, [1, 0, 0]))
    skirt.apply_translation([0, 0.95, 0])
    parts["skirt"] = skirt
    parts["arm_l"] = _ellipsoid(0.04, 2, scale=(0.7, 2.4, 0.7), translate=(-0.22, 1.2, 0.02), rotate_y=0.2)
    parts["arm_r"] = _ellipsoid(0.04, 2, scale=(0.7, 2.4, 0.7), translate=(0.22, 1.2, 0.02), rotate_y=-0.2)
    parts["leg_l"] = _ellipsoid(0.045, 2, scale=(0.7, 2.2, 0.7), translate=(-0.07, 0.72, 0))
    parts["leg_r"] = _ellipsoid(0.045, 2, scale=(0.7, 2.2, 0.7), translate=(0.07, 0.72, 0))
    return parts


def build_humpback() -> dict[str, trimesh.Trimesh]:
    """Large humpback-inspired whale: elongated body, long pectorals, fluke, knobby head."""
    parts = {}
    # main body — long and massive relative to girl (~8x)
    parts["body"] = _ellipsoid(1.0, 2, scale=(2.6, 1.05, 1.25), translate=(0, 1.2, 0))
    parts["belly"] = _ellipsoid(0.85, 2, scale=(2.1, 0.55, 0.95), translate=(0.15, 0.85, 0.05))
    parts["head"] = _ellipsoid(0.7, 2, scale=(1.3, 0.85, 1.0), translate=(2.35, 1.25, 0))
    # tubercles / knobs along jaw
    for i, x in enumerate(np.linspace(1.9, 2.7, 4)):
        parts[f"knob_{i}"] = _ellipsoid(0.05, 1, scale=(1, 1, 1), translate=(x, 1.0, 0.25 if i % 2 == 0 else -0.25))
    # long pectoral fins (humpback signature)
    fin_l = trimesh.creation.cone(radius=0.22, height=2.2, sections=16)
    fin_l.apply_transform(trimesh.transformations.rotation_matrix(math.pi / 2, [0, 0, 1]))
    fin_l.apply_transform(trimesh.transformations.rotation_matrix(-0.35, [1, 0, 0]))
    fin_l.apply_translation([0.2, 0.95, 1.35])
    parts["pectoral_l"] = fin_l
    fin_r = fin_l.copy()
    fin_r.apply_transform(np.diag([1, 1, -1, 1]))
    parts["pectoral_r"] = fin_r
    # dorsal hump
    parts["dorsal"] = _ellipsoid(0.25, 2, scale=(0.9, 0.7, 0.35), translate=(-0.3, 2.05, 0))
    # fluke
    fluke = trimesh.creation.box(extents=(0.2, 0.15, 2.0))
    fluke.apply_translation([-2.5, 1.15, 0])
    # taper tips with spheres
    tip_l = _ellipsoid(0.2, 2, scale=(0.6, 0.35, 1.2), translate=(-2.55, 1.15, 0.85))
    tip_r = _ellipsoid(0.2, 2, scale=(0.6, 0.35, 1.2), translate=(-2.55, 1.15, -0.85))
    parts["fluke"] = fluke
    parts["fluke_l"] = tip_l
    parts["fluke_r"] = tip_r
    # eye
    parts["eye"] = _ellipsoid(0.08, 2, scale=(1, 1, 1), translate=(2.55, 1.35, 0.55))
    return parts


COLORS = {
    "girl": {
        "head": (0.98, 0.84, 0.76),
        "hair": (0.12, 0.07, 0.05),
        "hair_l": (0.12, 0.07, 0.05),
        "hair_r": (0.12, 0.07, 0.05),
        "body": (0.45, 0.82, 0.93),
        "skirt": (0.55, 0.88, 0.96),
        "arm_l": (0.98, 0.84, 0.76),
        "arm_r": (0.98, 0.84, 0.76),
        "leg_l": (0.98, 0.84, 0.76),
        "leg_r": (0.98, 0.84, 0.76),
    },
    "whale": {
        "default": (0.38, 0.52, 0.62),
        "belly": (0.90, 0.94, 0.98),
        "eye": (0.05, 0.07, 0.1),
        "knob": (0.32, 0.42, 0.5),
    },
}


def _merge_parts(parts: dict[str, trimesh.Trimesh], color_map: dict) -> trimesh.Trimesh:
    """Merge parts into one mesh with vertex colors (smaller / faster USDA)."""
    default_c = color_map.get("default", (0.5, 0.5, 0.5))
    meshes = []
    for name, mesh in parts.items():
        m = mesh.copy()
        m.merge_vertices()
        if name.startswith("knob"):
            c = color_map.get("knob", default_c)
        else:
            c = color_map.get(name, default_c)
        rgba = [int(c[0] * 255), int(c[1] * 255), int(c[2] * 255), 255]
        m.visual.vertex_colors = np.tile(rgba, (len(m.vertices), 1))
        meshes.append(m)
    return trimesh.util.concatenate(meshes)


def mesh_to_usda_geom(name: str, mesh: trimesh.Trimesh, indent="    ") -> str:
    mesh = mesh.copy()
    mesh.merge_vertices()
    pts = mesh.vertices
    faces = mesh.faces
    counts = " ".join(["3"] * len(faces))
    indices = " ".join(str(int(i)) for i in faces.reshape(-1))
    # Quantize a bit to keep file smaller
    points = ", ".join(f"({p[0]:.4f}, {p[1]:.4f}, {p[2]:.4f})" for p in pts)
    # average display color
    if hasattr(mesh.visual, "vertex_colors") and mesh.visual.vertex_colors is not None:
        avg = mesh.visual.vertex_colors[:, :3].mean(axis=0) / 255.0
        r, g, b = float(avg[0]), float(avg[1]), float(avg[2])
    else:
        r, g, b = 0.5, 0.55, 0.6
    return f"""{indent}def Mesh "{name}" {{
{indent}    int[] faceVertexCounts = [{counts}]
{indent}    int[] faceVertexIndices = [{indices}]
{indent}    point3f[] points = [{points}]
{indent}    color3f[] primvars:displayColor = [({r:.3f}, {g:.3f}, {b:.3f})] (
{indent}        interpolation = "constant"
{indent}    )
{indent}    uniform token subdivisionScheme = "none"
{indent}    float3[] extent = [({pts.min(0)[0]:.4f}, {pts.min(0)[1]:.4f}, {pts.min(0)[2]:.4f}), ({pts.max(0)[0]:.4f}, {pts.max(0)[1]:.4f}, {pts.max(0)[2]:.4f})]
{indent}}}
"""


def write_character_usda(path: Path, root_name: str, parts: dict[str, trimesh.Trimesh], color_map: dict):
    merged = _merge_parts(parts, color_map)
    geom = mesh_to_usda_geom("Mesh", merged)
    doc = f"""#usda 1.0
(
    defaultPrim = "{root_name}"
    metersPerUnit = 1
    upAxis = "Y"
    doc = "Original DeepSeaFall asset inspired by Girl+Whale media-tower mood. Not sourced from Behance binaries."
)

def Xform "{root_name}" (
    kind = "component"
)
{{
{geom}}}
"""
    path.write_text(doc)
    print(f"Wrote {path} ({path.stat().st_size/1024:.1f} KB, faces={len(merged.faces)})")


def write_stage(path: Path, girl_rel: str, whale_rel: str):
    doc = f"""#usda 1.0
(
    defaultPrim = "DeepSeaStage"
    metersPerUnit = 1
    upAxis = "Y"
    doc = "Composition stage: tiny girl + massive humpback for scale contrast."
)

def Xform "DeepSeaStage" {{
    def Xform "Girl" (
        prepend references = @{girl_rel}@
    ) {{
        double3 xformOp:translate = (0, 0, 0)
        float3 xformOp:scale = (1, 1, 1)
        uniform token[] xformOpOrder = ["xformOp:translate", "xformOp:scale"]
    }}

    def Xform "Whale" (
        prepend references = @{whale_rel}@
    ) {{
        double3 xformOp:translate = (1.2, 0.1, -0.8)
        float3 xformOp:scale = (1.15, 1.15, 1.15)
        uniform token[] xformOpOrder = ["xformOp:translate", "xformOp:scale"]
    }}
}}
"""
    path.write_text(doc)
    print(f"Wrote {path}")


def export_glb_combined(parts: dict[str, trimesh.Trimesh], path: Path, colors: dict):
    scene = trimesh.Scene()
    default_c = colors.get("default", (0.5, 0.5, 0.5))
    for name, mesh in parts.items():
        m = mesh.copy()
        if name.startswith("knob"):
            c = colors.get("knob", default_c)
        else:
            c = colors.get(name, default_c)
        m.visual.face_colors = [int(c[0] * 255), int(c[1] * 255), int(c[2] * 255), 255]
        scene.add_geometry(m, node_name=name)
    scene.export(path)
    print(f"Wrote {path}")


def main():
    girl = build_girl()
    whale = build_humpback()
    write_character_usda(OUT / "girl.usda", "Girl", girl, COLORS["girl"])
    write_character_usda(OUT / "whale.usda", "Whale", whale, COLORS["whale"])
    write_stage(OUT / "deep_sea_stage.usda", "girl.usda", "whale.usda")
    export_glb_combined(girl, OUT / "girl.glb", COLORS["girl"])
    export_glb_combined(whale, OUT / "whale.glb", COLORS["whale"])
    # also a simple README note
    (OUT / "README.md").write_text(
        """# DeepSeaFall USD assets (original)

Inspired by the *mood* of Incheon Airport Media Tower “Girl and Whale”
(small girl, massive humpback, vertical deep-sea journey) — **procedurally
generated originals**, not extracted from Behance / IMAGO xyz files.

Generate:
```bash
python assets/scripts/generate_usd_from_style.py
```

Load in Isaac cinematic via `UsdFileCfg(usd_path=...)`.
"""
    )
    print("Done.")


if __name__ == "__main__":
    main()
