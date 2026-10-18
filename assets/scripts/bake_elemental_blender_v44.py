"""Bake fire, ice and cold-fire motion in the Spark Blender 5.1 build.

Uses Blender's particle systems plus wind and turbulence force fields.
Positions are exported in the same anchor-local layout the game already plays.
"""
import json
import math
import os
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(os.environ.get("DEEPSEA_PROJECT", "/home/spark/will/DeepSeaFall"))
OUT = ROOT / "assets" / "policy" / "elemental-dynamics-v44.json"
BLEND = ROOT / "assets" / "animation" / "elemental-combat-v44.blend"
FRAMES = 24
COUNT = 36

SPECS = {
    "fire": {
        "count": COUNT,
        "lifetime": 18,
        "normal": 1.35,
        "random": 0.55,
        "brownian": 2.4,
        "gravity": 0.05,
        "wind": 5.5,
        "turbulence": 3.2,
        "mass": 0.25,
        "size": 0.16,
    },
    "ice": {
        "count": COUNT,
        "lifetime": 24,
        "normal": 0.85,
        "random": 0.25,
        "brownian": 0.15,
        "gravity": 0.55,
        "wind": 0.35,
        "turbulence": 0.4,
        "mass": 0.8,
        "size": 0.09,
    },
    "cold-fire": {
        "count": COUNT,
        "lifetime": 22,
        "normal": 0.7,
        "random": 0.4,
        "brownian": 1.1,
        "gravity": 0.08,
        "wind": 2.4,
        "turbulence": 1.6,
        "mass": 0.35,
        "size": 0.13,
    },
}


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()
    for block in (bpy.data.meshes, bpy.data.particles, bpy.data.materials):
        for item in list(block):
            if item.users == 0:
                block.remove(item)


def add_force(kind, name, location, strength, size=1.0):
    bpy.ops.object.effector_add(type=kind, location=location)
    field = bpy.context.active_object
    field.name = name
    field.field.strength = strength
    field.field.size = size
    if hasattr(field.field, "flow"):
        field.field.flow = 0.35
    return field


def anchor_for(element, index):
    if element == "ice":
        return 1 if index < COUNT // 2 else 2
    if element == "fire" and index % 5 == 0:
        return 3 if index % 2 == 0 else 4
    return 1 if index % 2 == 0 else 2


def color_of(element, age):
    heat = max(0.0, 1.0 - age)
    if element == "fire":
        return (1.0, 0.38 + 0.5 * heat, 0.06 + 0.2 * heat, 0.35 + 0.6 * heat)
    if element == "ice":
        return (0.72, 0.9, 1.0, 0.45 + 0.35 * heat)
    core = heat ** 0.6
    return (0.5 + 0.5 * core, 0.75 + 0.25 * core, 1.0, 0.3 + 0.65 * heat)


def bake_element(element, spec):
    bpy.ops.mesh.primitive_plane_add(size=0.12, location=(0, 0, 0))
    emitter = bpy.context.active_object
    emitter.name = f"{element}-emitter"
    bpy.ops.object.particle_system_add()
    settings = emitter.particle_systems[0].settings
    settings.count = spec["count"]
    settings.frame_start = 1
    settings.frame_end = 6
    settings.lifetime = spec["lifetime"]
    settings.lifetime_random = 0.15
    settings.emit_from = "FACE"
    settings.normal_factor = spec["normal"]
    settings.factor_random = spec["random"]
    settings.brownian_factor = spec["brownian"]
    settings.particle_size = spec["size"]
    settings.size_random = 0.35
    settings.mass = spec["mass"]
    settings.physics_type = "NEWTON"
    settings.effector_weights.gravity = spec["gravity"]
    settings.use_rotations = True
    settings.angular_velocity_mode = "RAND"
    settings.angular_velocity_factor = 2.5 if element == "ice" else 0.8
    wind = add_force("WIND", f"{element}-wind", (0, 0, -0.4), spec["wind"], 2.0)
    turbulence = add_force("TURBULENCE", f"{element}-turbulence", (0, 0, 0.2), spec["turbulence"], 0.55 if element != "ice" else 1.4)
    scene = bpy.context.scene
    scene.frame_start = 1
    scene.frame_end = FRAMES
    frames = []
    for frame in range(1, FRAMES + 1):
        scene.frame_set(frame)
        depsgraph = bpy.context.evaluated_depsgraph_get()
        evaluated = emitter.evaluated_get(depsgraph)
        particles = evaluated.particle_systems[0].particles
        sample = []
        for index in range(spec["count"]):
            particle = particles[index]
            age = 0.0 if particle.lifetime <= 0 else max(0.0, min(1.0, particle.lifetime and (frame - particle.birth_time) / particle.lifetime))
            alive = particle.alive_state == "ALIVE"
            location = particle.location if alive else Vector((0, 0, 0))
            red, green, blue, alpha = color_of(element, age if alive else 1)
            size = settings.particle_size * (1.15 if element != "ice" else 1) * (0.45 + 0.7 * (1 - age if alive else 0))
            stretch = 1.7 if element != "ice" else 1.1
            sample.append([
                anchor_for(element, index),
                round(location.x, 4),
                round(location.z, 4),
                round(location.y, 4),
                round(size, 4),
                round(size * stretch, 4),
                round(red, 4),
                round(green, 4),
                round(blue, 4),
                round(alpha if alive else 0.0, 4),
            ])
        frames.append(sample)
    bpy.data.objects.remove(wind, do_unlink=True)
    bpy.data.objects.remove(turbulence, do_unlink=True)
    emitter.hide_render = True
    return frames


def lights_for(element, frames):
    totals = [0.0, 0.0, 0.0]
    weight = 0.0
    for frame in frames:
        for particle in frame:
            alpha = particle[9]
            totals[0] += particle[6] * alpha
            totals[1] += particle[7] * alpha
            totals[2] += particle[8] * alpha
            weight += alpha
    palette = [round(channel / max(weight, 1e-6), 4) for channel in totals]
    light_frames = []
    for index, frame in enumerate(frames):
        envelope = math.sin(math.pi * min(1.0, index / (FRAMES - 1) * 1.15)) ** 0.8
        warm = palette
        light_frames.append([
            [1, 0.02, 0.08, 0.12, round(8.0 * envelope, 3), *warm],
            [2, 0.02, 0.08, 0.12, round(8.0 * envelope, 3), *warm],
            [0, 0.0, 0.25, 0.05, round(3.4 * envelope, 3), *[round(min(1, c * 0.8 + 0.15), 4) for c in warm]],
            [3 if element == "fire" else 0, 0.0, 0.05, 0.2, round((6.0 if element == "fire" else 2.6) * envelope, 3), *warm],
        ])
    return {"palette": palette, "strength": 1.0, "frames": light_frames, "baker": "blender-5.1-particles"}


def main():
    clear_scene()
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.gravity = (0, 0, -2.2)
    elements = {}
    for name, spec in SPECS.items():
        print(f"baking {name}")
        frames = bake_element(name, spec)
        alive = sum(1 for particle in frames[8] if particle[9] > 0)
        print(f"  frame 9 alive {alive}")
        elements[name] = {"particles": frames, "lights": lights_for(name, frames)}
    payload = {
        "version": 44,
        "frames": FRAMES,
        "anchors": ["chest", "l_wrist", "r_wrist", "l_ankle", "r_ankle"],
        "source": "Blender 5.1 particle systems with wind and turbulence",
        "blender": bpy.app.version_string,
        "elements": elements,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, separators=(",", ":")))
    BLEND.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND))
    print("wrote", OUT, OUT.stat().st_size, "blend", BLEND, BLEND.stat().st_size)


if __name__ == "__main__":
    main()
