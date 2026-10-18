#!/usr/bin/env python3
"""Generate original Girl + Humpback Whale USD with UsdPreviewSurface materials.

Style inspiration (not assets) from Incheon Airport Media Tower Girl & Whale:
small girl, massive wet humpback, surreal deep-sea scale contrast.
"""

from __future__ import annotations

import math
from pathlib import Path

import numpy as np
import trimesh

OUT = Path(__file__).resolve().parents[1] / "usd"
PREVIEWS = Path(__file__).resolve().parents[1] / "previews"
OUT.mkdir(parents=True, exist_ok=True)
PREVIEWS.mkdir(parents=True, exist_ok=True)

# Realistic-leaning PBR presets:
# (diffuse, roughness, metallic, emissive, clearcoat, clearcoatRoughness, ior, specular)
MATS = {
    "skin": ((0.96, 0.74, 0.62), 0.38, 0.0, (0.08, 0.03, 0.02), 0.22, 0.32, 1.4, 0.45),
    "hair": ((0.08, 0.04, 0.03), 0.48, 0.08, (0.015, 0.008, 0.005), 0.35, 0.28, 1.45, 0.5),
    "dress": ((0.22, 0.78, 0.92), 0.22, 0.12, (0.05, 0.16, 0.22), 0.55, 0.14, 1.5, 0.55),
    "whale": ((0.18, 0.28, 0.36), 0.18, 0.22, (0.025, 0.06, 0.08), 0.78, 0.08, 1.45, 0.65),
    "belly": ((0.92, 0.95, 0.98), 0.28, 0.06, (0.04, 0.05, 0.06), 0.5, 0.18, 1.4, 0.55),
    "eye": ((0.03, 0.04, 0.05), 0.1, 0.45, (0.01, 0.015, 0.02), 0.9, 0.04, 1.5, 0.8),
    "knob": ((0.16, 0.22, 0.28), 0.45, 0.12, (0.015, 0.025, 0.03), 0.4, 0.3, 1.4, 0.4),
}

PART_MAT = {
    "head": "skin", "arm_l": "skin", "arm_r": "skin", "leg_l": "skin", "leg_r": "skin",
    "hair": "hair", "hair_l": "hair", "hair_r": "hair",
    "body": "dress", "skirt": "dress",
    "body_w": "whale", "head_w": "whale", "dorsal": "whale", "fluke": "whale",
    "fluke_l": "whale", "fluke_r": "whale", "pectoral_l": "whale", "pectoral_r": "whale",
    "belly": "belly", "eye": "eye",
}


def _transform(mesh, translate=(0, 0, 0), scale=(1, 1, 1), rotate_y=0.0):
    m = mesh.copy()
    T = np.eye(4)
    T[:3, :3] = np.diag(scale)
    if rotate_y:
        c, s = math.cos(rotate_y), math.sin(rotate_y)
        T[:3, :3] = np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]]) @ T[:3, :3]
    T[:3, 3] = translate
    m.apply_transform(T)
    return m


def _ellipsoid(radius=1.0, subdivisions=2, scale=(1, 1, 1), **kw):
    m = trimesh.creation.icosphere(subdivisions=subdivisions, radius=radius)
    return _transform(m, scale=scale, **kw)


def build_girl():
    parts = {}
    parts["head"] = _ellipsoid(0.13, 3, scale=(1.0, 1.15, 0.95), translate=(0, 1.55, 0))
    parts["hair"] = _ellipsoid(0.16, 3, scale=(1.15, 1.45, 1.05), translate=(0, 1.58, -0.02))
    parts["hair_l"] = _ellipsoid(0.07, 2, scale=(0.7, 2.3, 0.7), translate=(-0.15, 1.12, -0.05))
    parts["hair_r"] = _ellipsoid(0.07, 2, scale=(0.7, 2.3, 0.7), translate=(0.15, 1.12, -0.05))
    parts["body"] = _ellipsoid(0.16, 3, scale=(0.85, 1.4, 0.65), translate=(0, 1.15, 0))
    skirt = trimesh.creation.cone(radius=0.3, height=0.4, sections=28)
    skirt.apply_transform(trimesh.transformations.rotation_matrix(math.pi, [1, 0, 0]))
    skirt.apply_translation([0, 0.95, 0])
    parts["skirt"] = skirt
    parts["arm_l"] = _ellipsoid(0.04, 2, scale=(0.7, 2.5, 0.7), translate=(-0.23, 1.2, 0.02))
    parts["arm_r"] = _ellipsoid(0.04, 2, scale=(0.7, 2.5, 0.7), translate=(0.23, 1.2, 0.02))
    parts["leg_l"] = _ellipsoid(0.045, 2, scale=(0.7, 2.3, 0.7), translate=(-0.07, 0.7, 0))
    parts["leg_r"] = _ellipsoid(0.045, 2, scale=(0.7, 2.3, 0.7), translate=(0.07, 0.7, 0))
    return parts


def build_humpback():
    parts = {}
    parts["body_w"] = _ellipsoid(1.0, 3, scale=(2.7, 1.05, 1.25), translate=(0, 1.2, 0))
    parts["belly"] = _ellipsoid(0.85, 3, scale=(2.15, 0.55, 0.95), translate=(0.15, 0.82, 0.05))
    parts["head_w"] = _ellipsoid(0.72, 3, scale=(1.35, 0.85, 1.0), translate=(2.4, 1.25, 0))
    for i, x in enumerate(np.linspace(1.95, 2.75, 5)):
        parts[f"knob_{i}"] = _ellipsoid(0.055, 1, scale=(1, 1, 1), translate=(x, 0.98, 0.28 if i % 2 == 0 else -0.28))
        PART_MAT[f"knob_{i}"] = "knob"
    fin_l = trimesh.creation.cone(radius=0.22, height=2.3, sections=18)
    fin_l.apply_transform(trimesh.transformations.rotation_matrix(math.pi / 2, [0, 0, 1]))
    fin_l.apply_transform(trimesh.transformations.rotation_matrix(-0.35, [1, 0, 0]))
    fin_l.apply_translation([0.2, 0.95, 1.4])
    parts["pectoral_l"] = fin_l
    fin_r = fin_l.copy()
    fin_r.apply_transform(np.diag([1, 1, -1, 1]))
    parts["pectoral_r"] = fin_r
    parts["dorsal"] = _ellipsoid(0.26, 2, scale=(0.95, 0.75, 0.35), translate=(-0.3, 2.08, 0))
    parts["fluke"] = _transform(trimesh.creation.box(extents=(0.22, 0.14, 2.1)), translate=(-2.55, 1.15, 0))
    parts["fluke_l"] = _ellipsoid(0.22, 2, scale=(0.65, 0.35, 1.25), translate=(-2.6, 1.15, 0.9))
    parts["fluke_r"] = _ellipsoid(0.22, 2, scale=(0.65, 0.35, 1.25), translate=(-2.6, 1.15, -0.9))
    parts["eye"] = _ellipsoid(0.09, 2, scale=(1, 1, 1), translate=(2.6, 1.38, 0.55))
    return parts


def _mat_block(root: str, mat_id: str, indent="    ") -> str:
    d, rough, metal, em, cc, ccr, ior, spec = MATS[mat_id]
    path = f"/{root}/Looks/{mat_id}"
    return f"""{indent}def Material "{mat_id}"
{indent}{{
{indent}    token outputs:surface.connect = <{path}/Shader.outputs:surface>
{indent}    def Shader "Shader"
{indent}    {{
{indent}        uniform token info:id = "UsdPreviewSurface"
{indent}        color3f inputs:diffuseColor = ({d[0]:.3f}, {d[1]:.3f}, {d[2]:.3f})
{indent}        color3f inputs:emissiveColor = ({em[0]:.3f}, {em[1]:.3f}, {em[2]:.3f})
{indent}        float inputs:roughness = {rough}
{indent}        float inputs:metallic = {metal}
{indent}        float inputs:clearcoat = {cc}
{indent}        float inputs:clearcoatRoughness = {ccr}
{indent}        float inputs:ior = {ior}
{indent}        float inputs:specular = {spec}
{indent}        float inputs:opacity = 1
{indent}        int inputs:useSpecularWorkflow = 0
{indent}        token outputs:surface
{indent}    }}
{indent}}}
"""


def _wrap_tokens(tokens: list[str], per_line: int = 24, indent: str = "        ") -> str:
    """Break long USDA arrays across lines — single mega-lines fail Omniverse parse."""
    lines = []
    for i in range(0, len(tokens), per_line):
        chunk = ", ".join(tokens[i : i + per_line])
        lines.append(f"{indent}{chunk}")
    return ",\n".join(lines)


def mesh_to_usda_geom(name: str, mesh: trimesh.Trimesh, mat_id: str, root: str, indent="    ") -> str:
    mesh = mesh.copy()
    mesh.merge_vertices()
    pts = mesh.vertices
    faces = mesh.faces
    counts = _wrap_tokens(["3"] * len(faces), per_line=48, indent=indent + "        ")
    indices = _wrap_tokens([str(int(i)) for i in faces.reshape(-1)], per_line=36, indent=indent + "        ")
    points = _wrap_tokens(
        [f"({p[0]:.4f}, {p[1]:.4f}, {p[2]:.4f})" for p in pts],
        per_line=6,
        indent=indent + "        ",
    )
    normals = _wrap_tokens(
        [f"({n[0]:.4f}, {n[1]:.4f}, {n[2]:.4f})" for n in mesh.vertex_normals],
        per_line=6,
        indent=indent + "        ",
    )
    d = MATS[mat_id][0]
    mn, mx = pts.min(0), pts.max(0)
    return f"""{indent}def Mesh "{name}"
{indent}{{
{indent}    int[] faceVertexCounts = [
{counts}
{indent}    ]
{indent}    int[] faceVertexIndices = [
{indices}
{indent}    ]
{indent}    point3f[] points = [
{points}
{indent}    ]
{indent}    normal3f[] normals = [
{normals}
{indent}    ] (
{indent}        interpolation = "vertex"
{indent}    )
{indent}    color3f[] primvars:displayColor = [({d[0]:.3f}, {d[1]:.3f}, {d[2]:.3f})] (
{indent}        interpolation = "constant"
{indent}    )
{indent}    rel material:binding = </{root}/Looks/{mat_id}>
{indent}    uniform token subdivisionScheme = "none"
{indent}    float3[] extent = [({mn[0]:.4f}, {mn[1]:.4f}, {mn[2]:.4f}), ({mx[0]:.4f}, {mx[1]:.4f}, {mx[2]:.4f})]
{indent}}}
"""


def write_character_usda(path: Path, root_name: str, parts: dict):
    used_mats = sorted({PART_MAT[n] for n in parts})
    looks = "\n".join(_mat_block(root_name, m, indent="        ") for m in used_mats)
    geoms = []
    for name, mesh in parts.items():
        mat_id = PART_MAT[name]
        geoms.append(mesh_to_usda_geom(name, mesh, mat_id, root_name, indent="    "))
    doc = f"""#usda 1.0
(
    defaultPrim = "{root_name}"
    metersPerUnit = 1
    upAxis = "Y"
    doc = "Original DeepSeaFall PBR asset. Inspired by Girl+Whale mood; not from Behance binaries."
)

def Xform "{root_name}" (
    kind = "component"
)
{{
    def Scope "Looks"
    {{
{looks}
    }}

{"".join(geoms)}}}
"""
    path.write_text(doc)
    print(f"Wrote {path} ({path.stat().st_size/1024:.1f} KB, parts={len(parts)}, mats={used_mats})")


def write_stage(path: Path):
    path.write_text(
        """#usda 1.0
(
    defaultPrim = "DeepSeaStage"
    metersPerUnit = 1
    upAxis = "Y"
)

def Xform "DeepSeaStage" {
    def Xform "Girl" ( prepend references = @girl.usda@ ) {
        double3 xformOp:translate = (0, 0, 0)
        float3 xformOp:scale = (1, 1, 1)
        uniform token[] xformOpOrder = ["xformOp:translate", "xformOp:scale"]
    }
    def Xform "Whale" ( prepend references = @whale.usda@ ) {
        double3 xformOp:translate = (1.4, 0.05, -0.9)
        float3 xformOp:scale = (1.15, 1.15, 1.15)
        uniform token[] xformOpOrder = ["xformOp:translate", "xformOp:scale"]
    }
}
"""
    )
    print(f"Wrote {path}")


def export_glb(parts: dict, path: Path):
    scene = trimesh.Scene()
    for name, mesh in parts.items():
        m = mesh.copy()
        d = MATS[PART_MAT[name]][0]
        m.visual.face_colors = [int(d[0] * 255), int(d[1] * 255), int(d[2] * 255), 255]
        scene.add_geometry(m, node_name=name)
    scene.export(path)
    print(f"Wrote {path}")


def write_preview_readme():
    (PREVIEWS / "README.md").write_text(
        """# Character previews (Isaac USD renders)

PNG stills rendered from the generated `girl.usda` / `whale.usda` with
UsdPreviewSurface materials (skin, wet whale clearcoat, dress fabric).

Regenerate assets:
```bash
python assets/scripts/generate_usd_from_style.py
cd isaac_cinematic && ./run_cinematic.sh 16
# then copy showcase frames into this folder (or use scripts/export_character_previews.sh)
```
"""
    )


def main():
    girl = build_girl()
    whale = build_humpback()
    write_character_usda(OUT / "girl.usda", "Girl", girl)
    write_character_usda(OUT / "whale.usda", "Whale", whale)
    write_stage(OUT / "deep_sea_stage.usda")
    export_glb(girl, OUT / "girl.glb")
    export_glb(whale, OUT / "whale.glb")
    write_preview_readme()
    (OUT / "README.md").write_text(
        """# DeepSeaFall USD (original PBR)

- `girl.usda` / `whale.usda` — multi-mesh + UsdPreviewSurface (skin, hair, dress, wet whale)
- `*.glb` — same geometry for Three.js Web 3D
- Previews on GitHub: [`../previews/`](../previews/)

```bash
python assets/scripts/generate_usd_from_style.py
```
"""
    )
    print("Done.")


if __name__ == "__main__":
    # Preserve the historical command while generating the rebuilt anatomy.
    from rebuild_realistic import main as rebuild
    rebuild()
