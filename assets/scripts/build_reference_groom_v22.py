"""Swept-back, softly feathered updo fitted to the native portrait scalp.

The silhouette, supporting volumes and individual curved fibres are native
geometry. No photograph is projected onto the character. Coordinates are Y-up.
"""
from pathlib import Path
import json, math
import numpy as np
from scipy.spatial import cKDTree
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
TEX = ROOT / 'assets/usd/textures'
D = json.loads((ROOT / 'assets/refined/girl_portrait_source_v22.json').read_text())
D['meshes'] = [m for m in D['meshes'] if not m['name'].startswith('hair')]
skin = D['meshes'][0]
body = np.array(skin['vertices'])[np.unique([i for f in skin['faces'] for i in f])]
head = body[(body[:, 1] > 1.385) & (body[:, 1] < 1.572)]
head = head[~((abs(head[:, 0]) > .078) & (head[:, 1] < 1.445) & (head[:, 2] > -.010))]
centre = np.array([0., 1.466, .050])
r = head - centre
length = np.linalg.norm(r, axis=1)
tree = cKDTree(r / length[:, None])
rng = np.random.default_rng(2207)
guides = []
s = np.linspace(0, 1, 40)


def smooth(x):
    x = np.clip(x, 0, 1)
    return x * x * (3 - 2 * x)


def radial(direction, pad=.0035):
    direction = np.asarray(direction)
    shape = direction.shape
    flat = direction.reshape(-1, 3)
    flat = flat / np.maximum(np.linalg.norm(flat, axis=1)[:, None], 1e-9)
    dist, ids = tree.query(flat, k=64)
    weights = np.exp(-dist ** 2 / .055)
    radius = (length[ids] * weights).sum(1) / weights.sum(1)
    radius += np.broadcast_to(pad, shape[:-1]).reshape(-1)
    return (centre + flat * radius[:, None]).reshape(shape)


def direction(theta, phi):
    theta, phi = np.broadcast_arrays(theta, phi)
    return np.stack([np.sin(theta) * np.sin(phi), np.cos(theta),
                     np.sin(theta) * np.cos(phi)], axis=-1)


def scalp(theta, phi, pad=.0035):
    return radial(direction(theta, phi), pad)


def hairline(phi):
    # A continuous rounded forehead and gently lowered temple/nape boundary.
    # Millimetric low-frequency variation avoids a ruler-straight cap edge.
    front = (phi + math.pi) % math.tau - math.pi
    widow = .031 * np.exp(-((front + .075) / .24) ** 2)
    corners = -.028 * np.exp(-((abs(front) - .51) / .22) ** 2)
    return (1.005 + .635 * (1 - np.cos(phi)) + widow + corners
            + .017 * np.sin(phi * 3 + .35) + .009 * np.sin(phi * 7 - .8)
            + .003 * np.sin(phi * 19 + .4))


def add(name, vertices, faces, uvs, material='hair', subdivision=0):
    if not len(vertices):
        return
    D['meshes'].append({'name': name, 'vertices': np.asarray(vertices).tolist(),
                        'faces': faces, 'face_uv': faces,
                        'uvs': np.asarray(uvs).tolist(), 'material': material,
                        'subdivision': subdivision})


def surface(name, fn, rows, cols, material='haircap', subdivision=1):
    vertices, uvs, faces = [], [], []
    for i in range(rows + 1):
        for j in range(cols + 1):
            vertices.append(fn(i / rows, j / cols))
            uvs.append([j / cols, 1 - i / rows])
    for i in range(rows):
        for j in range(cols):
            a = i * (cols + 1) + j
            b = a + cols + 1
            faces.append([a, b, b + 1, a + 1])
    add(name, vertices, faces, uvs, material, subdivision)


def guide(part, points, width, normal_centre=centre):
    tangent = np.gradient(points, axis=0)
    tangent /= np.maximum(np.linalg.norm(tangent, axis=1)[:, None], 1e-9)
    normal = points - normal_centre
    normal /= np.maximum(np.linalg.norm(normal, axis=1)[:, None], 1e-9)
    across = np.cross(normal, tangent)
    across /= np.maximum(np.linalg.norm(across, axis=1)[:, None], 1e-9)
    for i in range(1, len(across)):
        if across[i] @ across[i - 1] < 0:
            across[i] *= -1
    guides.append({'part': part, 'points': points, 'across': across,
                   'normals': normal, 'width': width})


def bezier(a, b, c, d, t):
    t = np.asarray(t)[..., None]
    return ((1 - t) ** 3 * a + 3 * (1 - t) ** 2 * t * b
            + 3 * (1 - t) * t ** 2 * c + t ** 3 * d)


def slerp(a, b, t):
    angle = np.arccos(np.clip(a @ b, -.9999, .9999))
    t = np.asarray(t)[..., None]
    return (np.sin((1 - t) * angle) * a + np.sin(t * angle) * b) / np.sin(angle)


# A single continuous underfill avoids a bald centre groove. It sits close to
# the real scalp; its root edge fades underneath separately tapered fibres.
def crown_surface(phi_u, root_u):
    phi = math.tau * phi_u
    theta = .012 + (hairline(phi) - .012) * (1 - root_u)
    pad = .0026 + .0016 * np.sin(math.pi * root_u) ** 2
    return scalp(theta, phi, pad)


surface('hair_cap_swept', crown_surface, 96, 42, 'hairlinecap', 1)

# Each crown lock follows the forehead backwards and converges at the knot.
# The roots have slight asymmetric staggering without a broad middle part.
for i in range(580):
    phi = math.tau * ((i * .61803398875) % 1)
    theta = hairline(phi) - rng.uniform(.005, .07)
    a = direction(theta, phi)
    b = direction(.87 + rng.uniform(-.08, .10), math.pi + rng.uniform(-.18, .18))
    directions = slerp(a, b, s)
    p = radial(directions, .0045 + rng.uniform(0, .0008)
               + .0011 * np.sin(s * math.pi))
    guide('swept_crown', p, rng.uniform(.0008, .00135))

# Compact rear-upper knot. Overlapping elliptical coils give it a real volume
# rather than a dark ball with a seam. It remains attached to the head bone.
bun_centre = np.array([-.005, 1.525, -.043])
bun_radii = np.array([.034, .027, .032])


def bun_point(theta, phi, pad=0):
    theta, phi = np.broadcast_arrays(theta, phi)
    d = direction(theta, phi)
    ripple = 1 + .024 * np.sin(phi * 5 + theta * 2) * np.sin(theta) ** 2
    return bun_centre + d * (bun_radii + pad) * np.asarray(ripple)[..., None]


surface('hair_bun_core',
        lambda u, v: bun_point(.008 + (math.pi - .016) * u, math.tau * v),
        36, 64, 'haircap', 1)
for i in range(180):
    base = .14 + (math.pi - .28) * ((i * .61803398875) % 1)
    phase = rng.uniform(0, math.tau)
    phi = phase + math.tau * 1.08 * s
    theta = base + .13 * np.sin(s * math.tau + phase)
    theta = np.clip(theta, .04, math.pi - .04)
    p = bun_point(theta, phi, rng.uniform(.0006, .0012))
    guide('bun_coils', p, rng.uniform(.0009, .0015), bun_centre)

# Fine baby hairs are only a few millimetres long. They blend the contour into
# the skin without horizontal stripes laid over the forehead.
for i in range(150):
    phi = math.tau * ((i * .61803398875) % 1)
    edge = hairline(phi)
    theta = edge - .035 + (.045 + rng.uniform(0, .030)) * s
    twist = rng.uniform(-.025, .025) * np.sin(s * math.pi / 2)
    p = scalp(theta, phi + twist, .0035 + .0007 * np.sin(s * math.pi))
    guide('hairline', p, rng.uniform(.00012, .00022))

# Short, thin ear-front wisps replace the old wide planar cheek curtains.
for side, label in [(-1, 'l'), (1, 'r')]:
    for i in range(45):
        u = (i + .5) / 45
        phi = side * (.95 + .30 * u)
        a = scalp(hairline(phi) - .13, phi, .0044)
        d = np.array([side * (.078 + .004 * u),
                      1.449 + .016 * u + rng.uniform(-.003, .003),
                      .079 - .022 * u])
        b = a + np.array([side * .003, -.011, -.004])
        c = d + np.array([side * .002, .014, -.004])
        p = bezier(a, b, c, d, s)
        guide('sideburn_' + label, p, rng.uniform(.00018, .00034))
    for i in range(10):
        phi = side * rng.uniform(.9, 1.25)
        a = scalp(hairline(phi) - .05, phi, .0045)
        d = a + np.array([side * rng.uniform(.002, .005),
                          -rng.uniform(.017, .027), -.002])
        p = bezier(a, a + [side * .006, -.005, .003],
                   d + [side * .002, .006, -.002], d, s)
        guide('loose_' + label, p, rng.uniform(.00012, .00020))

# Restrained silhouette flyaways break perfect symmetry and the helmet edge.
for i in range(48):
    phi = rng.uniform(-math.pi, math.pi)
    theta = rng.uniform(.3, min(hairline(phi), 1.65))
    a = direction(theta, phi)
    b = direction(max(.1, theta - rng.uniform(.12, .3)), phi + .13)
    p = radial(slerp(a, b, s), .005 + rng.uniform(.001, .003) * np.sin(math.pi * s))
    guide('flyaway', p, rng.uniform(.00007, .00012))

parts = [('swept_crown', 'hair_crown_swept'), ('bun_coils', 'hair_bun_coils'),
         ('hairline', 'hair_fringe'), ('sideburn_l', 'hair_sideburn_l'),
         ('sideburn_r', 'hair_sideburn_r'), ('loose_l', 'hair_loose_l'),
         ('loose_r', 'hair_loose_r'), ('flyaway', 'hair_flyaways')]
for part, name in parts:
    vertices, uvs, faces = [], [], []
    for g in (g for g in guides if g['part'] == part):
        start = len(vertices)
        for i, p in enumerate(g['points']):
            t = i / (len(s) - 1)
            taper = smooth(t / .12) * (1 - .98 * smooth((t - .78) / .22))
            width = g['width'] * taper
            for j in [0, 1]:
                vertices.append(p + g['across'][i] * (j - .5) * width)
                uvs.append([j, 1 - t])
        for i in range(len(s) - 1):
            a = start + i * 2
            faces.append([a, a + 1, a + 3, a + 2])
    add(name, vertices, faces, uvs)

# Separate fine fibres provide continuity under close inspection without
# making each broad card conspicuous. The fine material is naturally opaque.
for part, name in [('swept_crown', 'hair_fine_crown_swept'),
                   ('bun_coils', 'hair_fine_bun'),
                   ('sideburn_l', 'hair_fine_sideburn_l'),
                   ('sideburn_r', 'hair_fine_sideburn_r'),
                   ('hairline', 'hair_fine_fringe'),
                   ('flyaway', 'hair_fine_flyaways')]:
    vertices, uvs, faces = [], [], []
    for k, g in enumerate(g for g in guides if g['part'] == part):
        if k % 2:
            continue
        start = len(vertices)
        offset = rng.uniform(-.00014, .00014)
        for i, p in enumerate(g['points']):
            t = i / (len(s) - 1)
            p = p + g['across'][i] * offset + g['normals'][i] * .00018
            width = .000035 * smooth(t / .08) * (1 - .97 * t ** 6)
            for j in [0, 1]:
                vertices.append(p + g['across'][i] * (2 * j - 1) * width)
                uvs.append([j, 1 - t])
        for i in range(len(s) - 1):
            a = start + i * 2
            faces.append([a, a + 1, a + 3, a + 2])
    add(name, vertices, faces, uvs, 'hairfine')

# Native fibre maps: low contrast in the underfill, narrow irregular alpha
# strands in each lock, and a genuinely feathered scalp boundary.
h, w = 2048, 256
u, v = np.meshgrid(np.linspace(0, 1, w), np.linspace(0, 1, h))
alpha = np.zeros((h, w))
for k in range(9):
    c = (k + .5 + rng.uniform(-.22, .22)) / 9 + .003 * np.sin(v[:, 0] * 4 + k)
    strand = np.exp(-((u - c[:, None]) / (.014 + rng.uniform(0, .008))) ** 2)
    strand *= smooth(((1 - v) - rng.uniform(.005, .035)) / .055)
    alpha = np.maximum(alpha, strand)
alpha *= smooth(u * 20) * smooth((1 - u) * 20)
fiber = np.sin(u * 61) * .5 + np.sin(v * 7 + u * 15) * .3
rgb = np.stack([16 + fiber, 12 + fiber * .7, 13 + fiber * .8], axis=-1)
Image.fromarray(np.uint8(np.concatenate([rgb, alpha[..., None] * 255], axis=-1))).save(TEX / 'groom_color.png')
h, w = 2048, 1024
y, x = np.mgrid[0:h, 0:w]
u, v = x / w, y / h
fiber = np.sin(math.tau * (u * 160 + .045 * np.sin(v * 3)))
soft = np.sin(math.tau * (u * 37 + .018 * np.sin(v * 3)))
rgb = np.stack([15 + fiber * .30 + soft * .35,
                11 + fiber * .25 + soft * .25,
                12 + fiber * .25 + soft * .30], axis=-1)
Image.fromarray(np.uint8(np.concatenate([rgb, np.full((h, w, 1), 255)], axis=-1))).save(TEX / 'groom_foundation.png')
root_jitter = .008 + .005 * np.sin(v * math.tau * 11) + .0025 * np.sin(v * math.tau * 37)
coverage = smooth((u - root_jitter) / .028)
Image.fromarray(np.uint8(np.concatenate([rgb, coverage[..., None] * 255], axis=-1))).save(TEX / 'groom_scalp.png')
Image.fromarray(np.uint8(np.clip(128 + fiber * 2 + soft, 0, 255))).save(TEX / 'groom_foundation_height.png')

D['hair_guides'] = [{**g, 'points': g['points'].tolist(),
                     'across': g['across'].tolist(), 'normals': g['normals'].tolist()}
                    for g in guides]
D['hair_style'] = 'Swept-back natural hairline, compact rear-upper coiled bun and fine temple wisps'
(ROOT / 'assets/refined/girl_portrait_hair_v22.json').write_text(json.dumps(D, separators=(',', ':')))
hair_meshes = [m for m in D['meshes'] if m['name'].startswith('hair')]
report = {'revision': 22, 'style': D['hair_style'], 'guide_count': len(guides),
          'temple_sideburn_guides': sum(g['part'].startswith('sideburn') for g in guides),
          'hair_meshes': [m['name'] for m in hair_meshes],
          'hair_vertices': sum(len(m['vertices']) for m in hair_meshes),
          'min_hair_y': min(min(p[1] for p in m['vertices']) for m in hair_meshes),
          'max_hair_y': max(max(p[1] for p in m['vertices']) for m in hair_meshes),
          'bun_centre': bun_centre.tolist(), 'bun_radii': bun_radii.tolist(),
          'finite': all(np.isfinite(m['vertices']).all() for m in D['meshes'])}
assert report['finite'] and report['hair_vertices'] < 200000
(ROOT / 'assets/refined/long_hair_v22_report.json').write_text(json.dumps(report, indent=2))
print(json.dumps(report, indent=2))
