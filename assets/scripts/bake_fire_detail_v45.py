"""Bake the fire attack from the Blender quick-smoke tutorial.

The tutorial (https://youtu.be/mh9tyFnzSUw) builds a realistic flame as separate
shader elements on one simulation:

- a sphere inflow set to Fire, fuel 2, surface emission 1
- a Clouds texture, contrast 5 and size 0.1, breaking the emission into clumps
- a modular cache, higher resolution, adaptive domain
- reaction speed 0.5 and vorticity 0.1
- density left at 0 in the shader, so only the heat shows
- a heat ramp whose last stop is a little darker, a fire color ramp, and a
  multiply that lifts the emission

Those stops become the game components: core, body, darker tips, and embers.
"""
import json
import os
import shutil
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(os.environ.get("DEEPSEA_PROJECT", "/home/spark/will/DeepSeaFall"))
SOURCE = ROOT / "assets" / "policy" / "elemental-dynamics-v44.json"
OUT = ROOT / "assets" / "policy" / "elemental-dynamics-v45.json"
BLEND = ROOT / "assets" / "animation" / "fire-detail-v45.blend"
CACHE = Path("/tmp/deepsea-fire-v45")
FRAMES = 24
RESOLUTION = 64
HEAT_MAX = 3.0
STRENGTH_RAMP = [(0.0, 0.0), (0.55, 1.0), (1.0, 0.72)]
COLOR_RAMP = [
    (0.0, (0.42, 0.05, 0.0)),
    (0.28, (1.0, 0.27, 0.02)),
    (0.62, (1.0, 0.62, 0.08)),
    (1.0, (1.0, 0.93, 0.72)),
]
LIMITS = {"core": 16, "body": 40, "tips": 32, "embers": 20}


def ramp(stops, value):
    value = max(0.0, min(1.0, value))
    for index in range(1, len(stops)):
        left, right = stops[index - 1], stops[index]
        if value <= right[0] or index == len(stops) - 1:
            span = max(1e-6, right[0] - left[0])
            blend = max(0.0, min(1.0, (value - left[0]) / span))
            if isinstance(left[1], tuple):
                return tuple(left[1][channel] + (right[1][channel] - left[1][channel]) * blend for channel in range(3))
            return left[1] + (right[1] - left[1]) * blend
    return stops[-1][1]


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()


def make_fire():
    if CACHE.exists():
        shutil.rmtree(CACHE)
    CACHE.mkdir(parents=True)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.18, location=(0, 0, 0))
    sphere = bpy.context.active_object
    sphere.name = "fire-sphere"
    bpy.ops.object.quick_smoke()
    domain = bpy.data.objects["Smoke Domain"]
    domain.scale = (0.85, 0.85, 1.85)
    domain.location = (0, 0, 0.95)
    flow = None
    for modifier in sphere.modifiers:
        if modifier.type == "FLUID" and modifier.fluid_type == "FLOW":
            flow = modifier.flow_settings
    flow.flow_type = "FIRE"
    flow.flow_behavior = "INFLOW"
    flow.fuel_amount = 2.0
    flow.surface_distance = 1.0
    texture = bpy.data.textures.new("fire-cloud", "CLOUDS")
    texture.noise_scale = 0.1
    texture.noise_depth = 2
    texture.contrast = 5.0
    flow.use_texture = True
    flow.noise_texture = texture
    flow.texture_size = 0.1
    settings = None
    for modifier in domain.modifiers:
        if modifier.type == "FLUID" and modifier.fluid_type == "DOMAIN":
            settings = modifier.domain_settings
    settings.domain_type = "GAS"
    settings.cache_type = "MODULAR"
    settings.resolution_max = RESOLUTION
    settings.use_adaptive_domain = True
    settings.burning_rate = 0.5
    settings.flame_vorticity = 0.1
    settings.flame_smoke = 0.0
    settings.cache_directory = str(CACHE)
    settings.cache_frame_start = 1
    settings.cache_frame_end = 36
    scene = bpy.context.scene
    scene.frame_start = 1
    scene.frame_end = 36
    print(
        "fire setup",
        "fuel", flow.fuel_amount,
        "surface", flow.surface_distance,
        "texture", texture.type, texture.contrast, texture.noise_scale,
        "resolution", settings.resolution_max,
        "speed", settings.burning_rate,
        "vorticity", settings.flame_vorticity,
        "smoke", settings.flame_smoke,
    )
    bpy.context.view_layer.objects.active = domain
    domain.select_set(True)
    bpy.ops.fluid.bake_data()
    return sphere


def sample_nodes(volume):
    group = bpy.data.node_groups.new("FireSample", "GeometryNodeTree")
    group.interface.new_socket(name="Geometry", in_out="OUTPUT", socket_type="NodeSocketGeometry")
    output = group.nodes.new("NodeGroupOutput")
    info = group.nodes.new("GeometryNodeObjectInfo")
    info.inputs["Object"].default_value = volume
    info.inputs["As Instance"].default_value = False
    flame_grid = group.nodes.new("GeometryNodeGetNamedGrid")
    flame_grid.data_type = "FLOAT"
    flame_grid.inputs["Name"].default_value = "flame"
    heat_grid = group.nodes.new("GeometryNodeGetNamedGrid")
    heat_grid.data_type = "FLOAT"
    heat_grid.inputs["Name"].default_value = "temperature"
    to_points = group.nodes.new("GeometryNodeGridToPoints")
    to_points.data_type = "FLOAT"
    sample = group.nodes.new("GeometryNodeSampleGrid")
    sample.data_type = "FLOAT"
    position = group.nodes.new("GeometryNodeInputPosition")
    store_flame = group.nodes.new("GeometryNodeStoreNamedAttribute")
    store_flame.data_type = "FLOAT"
    store_flame.domain = "POINT"
    store_flame.inputs["Name"].default_value = "flame"
    store_heat = group.nodes.new("GeometryNodeStoreNamedAttribute")
    store_heat.data_type = "FLOAT"
    store_heat.domain = "POINT"
    store_heat.inputs["Name"].default_value = "heat"
    to_vertices = group.nodes.new("GeometryNodePointsToVertices")
    links = group.links
    links.new(info.outputs["Geometry"], flame_grid.inputs["Volume"])
    links.new(info.outputs["Geometry"], heat_grid.inputs["Volume"])
    links.new(flame_grid.outputs["Grid"], to_points.inputs["Grid"])
    links.new(to_points.outputs["Value"], store_flame.inputs["Value"])
    links.new(to_points.outputs["Points"], store_flame.inputs["Geometry"])
    links.new(heat_grid.outputs["Grid"], sample.inputs["Grid"])
    links.new(position.outputs["Position"], sample.inputs["Position"])
    links.new(store_flame.outputs["Geometry"], store_heat.inputs["Geometry"])
    links.new(sample.outputs["Value"], store_heat.inputs["Value"])
    links.new(store_heat.outputs["Geometry"], to_vertices.inputs[0])
    links.new(to_vertices.outputs[0], output.inputs[0])
    bpy.ops.mesh.primitive_plane_add(size=0.01, location=(0, 0, 0))
    host = bpy.context.active_object
    host.name = "fire-sample"
    modifier = host.modifiers.new("sample", "NODES")
    modifier.node_group = group
    return host


def read_voxels(host):
    depsgraph = bpy.context.evaluated_depsgraph_get()
    evaluated = host.evaluated_get(depsgraph)
    mesh = evaluated.data
    if "flame" not in mesh.attributes or "heat" not in mesh.attributes:
        return []
    flames = mesh.attributes["flame"].data
    heats = mesh.attributes["heat"].data
    voxels = []
    for index, vertex in enumerate(mesh.vertices):
        flame = float(flames[index].value)
        if flame < 0.04:
            continue
        heat = float(heats[index].value) / HEAT_MAX
        voxels.append((Vector(vertex.co), flame, max(0.0, min(1.2, heat))))
    return voxels


def pick(voxels, count, cell):
    if len(voxels) <= count:
        return voxels
    chosen = []
    used = set()
    for voxel in sorted(voxels, key=lambda item: item[1], reverse=True):
        key = tuple(int(voxel[0][axis] / cell) for axis in range(3))
        if key in used:
            continue
        used.add(key)
        chosen.append(voxel)
        if len(chosen) == count:
            break
    return chosen


def classify(voxels):
    core, body, tips, embers = [], [], [], []
    for position, flame, heat in voxels:
        if heat >= 0.8 and flame < 0.55:
            embers.append((position, flame, heat))
        if heat >= 0.72 and flame >= 0.2:
            core.append((position, flame, heat))
        elif heat >= 0.38:
            body.append((position, flame, heat))
        else:
            tips.append((position, flame, heat))
    if len(core) < 6:
        core = sorted(voxels, key=lambda item: item[2], reverse=True)[:LIMITS["core"]]
    return {
        "core": pick(core, LIMITS["core"], 0.05),
        "body": pick(body, LIMITS["body"], 0.07),
        "tips": pick(tips, LIMITS["tips"], 0.08),
        "embers": pick(embers, LIMITS["embers"], 0.06),
    }


def shade(heat, flame):
    strength = ramp(STRENGTH_RAMP, min(1.0, heat))
    color = ramp(COLOR_RAMP, min(1.0, heat))
    # The tutorial multiplies emission strength and leaves the color ramp alone.
    alpha = (0.2 + 0.75 * strength) * (0.55 + 0.45 * min(1.0, flame))
    return color, max(0.0, min(0.95, alpha))


def particle(position, flame, heat, role, origin):
    local = position - origin
    # Blender Z rises. The game's anchor-local Y is up.
    point = (local.x, local.z, local.y)
    red, green, blue = shade(heat, flame)[0]
    alpha = shade(heat, flame)[1]
    width = {"core": 0.1, "body": 0.18, "tips": 0.11, "embers": 0.05}[role]
    height = {"core": 0.13, "body": 0.34, "tips": 0.46, "embers": 0.055}[role]
    width *= 0.75 + 0.5 * min(1.0, flame)
    height *= 0.8 + 0.45 * min(1.0, heat)
    return [0, point[0], point[1], point[2], width, height, red, green, blue, alpha]


def normalize(components):
    points = [particle for role in components.values() for frame in role for particle in frame]
    if not points:
        return components
    base = min(particle[2] for particle in points)
    top = max(particle[2] for particle in points)
    height = max(0.2, top - base)
    scale = 0.74 / height
    for role in components.values():
        for frame in role:
            for particle in frame:
                particle[1] = round(particle[1] * scale, 4)
                particle[2] = round((particle[2] - base) * scale, 4)
                particle[3] = round(particle[3] * scale, 4)
                particle[4] = round(particle[4] * scale, 4)
                particle[5] = round(particle[5] * scale, 4)
    return components


def bake_frames(host, origin):
    files = sorted((CACHE / "data").glob("fluid_data_*.vdb"))
    print("vdb", len(files))
    bpy.ops.object.volume_import(
        filepath=str(files[0]),
        directory=str(files[0].parent) + "/",
        files=[{"name": path.name} for path in files],
    )
    volume = bpy.context.active_object
    volume.data.is_sequence = True
    volume.data.frame_start = 1
    volume.data.frame_duration = len(files)
    # The node tree was built against this volume. Rebuild the host link.
    info = next(node for node in host.modifiers[0].node_group.nodes if node.bl_idname == "GeometryNodeObjectInfo")
    info.inputs["Object"].default_value = volume
    sampled = {}
    for frame in range(1, len(files) + 1):
        bpy.context.scene.frame_set(frame)
        voxels = read_voxels(host)
        print(f"frame {frame} voxels {len(voxels)}")
        if len(voxels) < 12:
            continue
        groups = classify(voxels)
        sampled[frame] = {role: [particle(position, flame, heat, role, origin) for position, flame, heat in groups[role]] for role in LIMITS}
    if len(sampled) < FRAMES:
        raise RuntimeError(f"only {len(sampled)} fire frames had enough voxels")
    ordered = [sampled[frame] for frame in sorted(sampled)]
    # Keep the developed flame, skipping the empty ignition frames.
    window = ordered[-FRAMES:]
    return {role: [frame[role] for frame in window] for role in LIMITS}


def main():
    clear_scene()
    sphere = make_fire()
    origin = Vector(sphere.location)
    host = sample_nodes(sphere)
    components = normalize(bake_frames(host, origin))
    payload = json.loads(SOURCE.read_text())
    fire = payload["elements"]["fire"]
    # The old 36 cards stay as a fallback made from the body component.
    fallback = []
    for frame in components["body"]:
        sample = list(frame)
        while len(sample) < 36:
            sample.append(sample[-1] if sample else [0, 0, 0.1, 0, 0.04, 0.08, 1, 0.4, 0.05, 0])
        fallback.append(sample[:36])
    fire["particles"] = fallback
    totals = [0.0, 0.0, 0.0]
    weight = 0.0
    for frame in components["body"]:
        for particle in frame:
            totals[0] += particle[6] * particle[9]
            totals[1] += particle[7] * particle[9]
            totals[2] += particle[8] * particle[9]
            weight += particle[9]
    palette = [round(channel / max(weight, 1e-6), 4) for channel in totals]
    for light_frame in fire["lights"]["frames"]:
        for light in light_frame:
            light[5], light[6], light[7] = palette
    fire["lights"]["palette"] = palette
    fire["lights"]["baker"] = "blender-5.1-quick-smoke-heat"
    fire["detail"] = {
        "baker": "blender-5.1-quick-smoke",
        "tutorial": "https://youtu.be/mh9tyFnzSUw",
        "settings": {
            "flow": "FIRE",
            "fuel": 2,
            "surfaceEmission": 1,
            "texture": "CLOUDS",
            "textureContrast": 5,
            "textureSize": 0.1,
            "cache": "MODULAR",
            "resolution": RESOLUTION,
            "adaptiveDomain": True,
            "reactionSpeed": 0.5,
            "vorticity": 0.1,
            "density": 0,
            "emissionMultiply": 4,
            "heatAttribute": "temperature",
        },
        "strengthRamp": STRENGTH_RAMP,
        "colorRamp": COLOR_RAMP,
        "components": components,
    }
    payload["version"] = 45
    payload["source"] = "Blender 5.1 quick smoke fire from the realistic-fire tutorial, with the v44 ice and cold-fire bakes kept"
    payload["blender"] = bpy.app.version_string
    OUT.write_text(json.dumps(payload, separators=(",", ":")))
    host.hide_render = True
    BLEND.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND))
    counts = {role: len(components[role][10]) for role in LIMITS}
    print("wrote", OUT, OUT.stat().st_size, "frame10", counts)


if __name__ == "__main__":
    main()
