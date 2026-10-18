"""Elemental light dynamics and clipped PPO for Deep Sea Fall attack poses.

Isaac Lab is already running the Q1 backflip trainer on this GPU, and Blender
is not installed. Flame, ice and cold-fire light motion is simulated here with
buoyancy, drag and curl noise, then a short gradient fit matches each
element's chromaticity to the reference attack art. Attack joints use clipped
PPO with the same spring integrator the browser runs.
"""
from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path

import torch
import torch.nn as nn

ROOT = Path(__file__).resolve().parents[2]
POLICY = ROOT / "assets" / "policy"
SEED = 44
DT = 1 / 30
FRAMES = 24
PARTICLES = 36
MOVES = [
    ("spiral-kick", "fire"),
    ("cross-blades", "ice"),
    ("diagonal-slash", "ice"),
    ("crescent-kick", "fire"),
    ("palm-wave", "fire"),
    ("lotus-burst", "cold-fire"),
    ("halo-guard", "cold-fire"),
    ("twin-kick", "fire"),
    ("sword-dance", "ice"),
    ("tidal-release", "cold-fire"),
]
ELEMENTS = ["fire", "ice", "cold-fire"]
BONES = [
    "spine", "chest", "neck",
    "l_shoulder", "l_elbow", "l_wrist",
    "r_shoulder", "r_elbow", "r_wrist",
    "l_thigh", "l_knee", "l_ankle",
    "r_thigh", "r_knee", "r_ankle",
]
JOINTS = [f"{bone}_{axis}" for bone in BONES for axis in "xyz"]
LIMITS = {
    "spine": 0.65, "chest": 0.65, "neck": 0.65,
    "l_shoulder": 2.5, "l_elbow": 2.5, "l_wrist": 1.2,
    "r_shoulder": 2.5, "r_elbow": 2.5, "r_wrist": 1.2,
    "l_thigh": 2.5, "l_knee": 2.5, "l_ankle": 1.0,
    "r_thigh": 2.5, "r_knee": 2.5, "r_ankle": 1.0,
}
SCALES = {
    "spine": 0.16, "chest": 0.14, "neck": 0.10,
    "l_shoulder": 0.22, "l_elbow": 0.18, "l_wrist": 0.16,
    "r_shoulder": 0.22, "r_elbow": 0.18, "r_wrist": 0.16,
    "l_thigh": 0.20, "l_knee": 0.16, "l_ankle": 0.12,
    "r_thigh": 0.20, "r_knee": 0.16, "r_ankle": 0.12,
}
CHARGE = {
    "spiral-kick": 1.0, "cross-blades": 1.2, "diagonal-slash": 0.95, "crescent-kick": 1.1,
    "palm-wave": 1.15, "lotus-burst": 1.8, "halo-guard": 1.5, "twin-kick": 1.3,
    "sword-dance": 1.7, "tidal-release": 2.0,
}
DURATION = {
    "spiral-kick": 1.35, "cross-blades": 1.35, "diagonal-slash": 1.25, "crescent-kick": 1.4,
    "palm-wave": 1.3, "lotus-burst": 1.65, "halo-guard": 1.5, "twin-kick": 1.5,
    "sword-dance": 1.85, "tidal-release": 2.0,
}
RECOVER = 0.7
ANCHORS = ["chest", "l_wrist", "r_wrist", "l_ankle", "r_ankle"]


def smoothstep(x, edge0, edge1):
    t = max(0.0, min(1.0, (x - edge0) / (edge1 - edge0)))
    return t * t * (3 - 2 * t)


def lerp(a, b, t):
    return a + (b - a) * t


def charge_pose():
    pose = {bone: [0.0, 0.0, 0.0] for bone in BONES}
    pose.update({
        "spine": [0.16, 0, 0], "chest": [0.10, 0, 0], "neck": [0.08, 0, 0],
        "l_shoulder": [0.2, -1.0, 0.35], "r_shoulder": [0.2, 1.0, -0.35],
        "l_elbow": [0.35, 0, 0], "r_elbow": [0.35, 0, 0],
        "l_wrist": [-0.45, 0.35, 0.55], "r_wrist": [-0.45, -0.35, -0.55],
        "l_thigh": [-0.05, 0, 0.10], "r_thigh": [-0.05, 0, -0.10],
        "l_knee": [0.25, 0, 0], "r_knee": [0.35, 0, 0],
        "l_ankle": [-0.30, 0, 0], "r_ankle": [-0.30, 0, 0],
    })
    return pose


def strike_pose(move, u):
    wave = math.sin(math.pi * u)
    a = math.sin(u * math.pi * 2)
    p = charge_pose()
    p.update({
        "spine": [-0.10, 0, 0.12 * a], "chest": [-0.08, 0, 0], "neck": [-0.06, 0, 0],
        "l_shoulder": [0.1, -0.1, -0.35], "r_shoulder": [0.1, 0.1, 0.35],
        "l_elbow": [0.25, 0, 0], "r_elbow": [0.25, 0, 0],
        "l_thigh": [0.1, 0, 0.14], "r_thigh": [-0.1, 0, -0.14],
        "l_knee": [0.22, 0, 0], "r_knee": [0.28, 0, 0],
        "l_ankle": [-0.35, 0, 0], "r_ankle": [-0.35, 0, 0],
    })
    if move == "spiral-kick":
        p["spine"] = [-0.28, 0.25, 0.16 * a]
        p["l_thigh"] = [-0.85 * wave, 0, 0.55 * wave]
        p["l_knee"] = [0.14, 0, 0]
        p["r_thigh"] = [0.30, 0, -0.10]
        p["r_knee"] = [0.85, 0, 0]
        p["l_shoulder"] = [0, 0, 0.3]
        p["r_shoulder"] = [0, 0, -0.3]
    elif move == "cross-blades":
        p["spine"] = [-0.15, 0.45 * a, 0.18 * a]
        p["l_shoulder"] = [0.25, -0.75, 0.7 - 1.5 * u]
        p["r_shoulder"] = [0.25, 0.75, -0.7 + 1.5 * u]
        p["l_elbow"] = p["r_elbow"] = [0.35, 0, 0]
        p["r_knee"] = [0.65, 0, 0]
    elif move == "diagonal-slash":
        p["spine"] = [-0.22, 0.35 * a, 0.25 * a]
        p["r_shoulder"] = [0.2, 0.8, -0.7 + 1.6 * u]
        p["r_elbow"] = [0.2 + 0.4 * (1 - wave), 0, 0]
        p["l_thigh"] = [-0.25, 0, 0.25]
        p["r_thigh"] = [0.3, 0, -0.2]
    elif move == "crescent-kick":
        p["spine"] = [-0.12, 0, -0.10 * wave]
        p["l_thigh"] = [-0.8 * wave, 0, 0.8 * wave]
        p["l_knee"] = [0.12, 0, 0]
        p["r_knee"] = [0.55, 0, 0]
        p["l_shoulder"] = [0, -0.2, 0.7]
    elif move == "palm-wave":
        p["spine"] = [0.12 - 0.38 * wave, 0, 0]
        p["l_shoulder"] = [0.15, -1.4, -0.12]
        p["r_shoulder"] = [0.15, 1.4, 0.12]
        p["l_elbow"] = p["r_elbow"] = [0.85 * (1 - wave) + 0.12, 0, 0]
        p["l_thigh"] = [0.28, 0, 0.2]
        p["r_thigh"] = [0.28, 0, -0.2]
    elif move == "lotus-burst":
        p["spine"] = [-0.34 * wave, 0, 0]
        p["l_shoulder"] = [0, -0.25, 0.8 * wave]
        p["r_shoulder"] = [0, 0.25, -0.8 * wave]
        p["l_thigh"] = [-0.14, 0, 0.55 * wave]
        p["r_thigh"] = [-0.14, 0, -0.55 * wave]
        p["l_knee"] = p["r_knee"] = [0.10, 0, 0]
    elif move == "halo-guard":
        p["l_shoulder"] = [0.1, -0.35, 1.25]
        p["r_shoulder"] = [0.1, 0.35, -1.25]
        p["l_elbow"] = p["r_elbow"] = [0.65, 0, 0]
        p["spine"] = [-0.24, 0.24 * a, 0.26 * a]
        p["r_knee"] = [0.8, 0, 0]
    elif move == "twin-kick":
        p["spine"] = [-0.25, 0, 0.22 * a]
        for prefix, offset in (("l_", 0.0), ("r_", math.pi)):
            kick = 0.5 + 0.5 * math.sin(u * math.pi * 3 + offset)
            p[prefix + "thigh"] = [-0.9 * kick, 0, 0.22 if prefix == "l_" else -0.22]
            p[prefix + "knee"] = [1.1 * (1 - kick) + 0.12, 0, 0]
        p["l_shoulder"] = [0, 0, 0.25]
        p["r_shoulder"] = [0, 0, -0.25]
    elif move == "sword-dance":
        p["spine"] = [-0.18, 0.25 * a, 0.18 * a]
        p["l_shoulder"] = [0.2, -0.8, 0.7 + math.sin(u * 9) * 0.5]
        p["r_shoulder"] = [0.2, 0.8, -0.7 + math.cos(u * 9) * 0.5]
        p["l_elbow"] = [0.3, 0, 0]
        p["r_elbow"] = [0.4, 0, 0]
        p["l_thigh"] = [0.25, 0, 0.22]
        p["r_thigh"] = [-0.25, 0, -0.2]
        p["l_knee"] = [0.55, 0, 0]
    elif move == "tidal-release":
        p["spine"] = [-0.36 * wave, 0, 0]
        p["chest"] = [-0.16, 0, 0]
        p["neck"] = [-0.18, 0, 0]
        p["l_shoulder"] = [0, -0.2, 1.35 * wave]
        p["r_shoulder"] = [0, 0.2, -1.35 * wave]
        p["l_thigh"] = [0, 0, 0.42 * wave]
        p["r_thigh"] = [0, 0, -0.42 * wave]
        p["l_knee"] = p["r_knee"] = [0.12, 0, 0]
    extension = math.sin(math.pi * u) ** 0.7
    kicks = {"spiral-kick", "crescent-kick", "twin-kick"}
    for side in ("l_", "r_"):
        if move != "palm-wave":
            p[side + "elbow"][0] *= 1 - extension * 0.55
        if move in kicks:
            p[side + "thigh"][0] *= 1.20
            p[side + "ankle"][0] = -0.48
            if p[side + "knee"][0] < 0.3:
                p[side + "knee"][0] = lerp(p[side + "knee"][0], 0.055, extension)
    element = dict(MOVES)[move]
    if element == "fire":
        p["l_wrist"] = [-0.2, 0.45, 0.7]
        p["r_wrist"] = [-0.2, -0.45, -0.7]
    elif element == "cold-fire":
        p["l_wrist"] = [-0.62, 0.28, 0.48 * wave]
        p["r_wrist"] = [-0.62, -0.28, -0.48 * wave]
    else:
        p["l_wrist"] = [0.15, 0.2, 0.35]
        p["r_wrist"] = [0.15, -0.2, -0.35]
    return p


def reference_angles(move, stage, progress):
    charge = charge_pose()
    if stage == "charge":
        pose = charge
    elif stage == "strike":
        strike = strike_pose(move, progress)
        release = smoothstep(progress, 0.0, 0.22)
        pose = {bone: [lerp(charge[bone][i], strike[bone][i], release) for i in range(3)] for bone in BONES}
    else:
        pose = strike_pose(move, 1.0)
    return [pose[bone][axis] for bone in BONES for axis in range(3)]


def blend_for(stage, progress):
    if stage == "charge":
        return smoothstep(progress, 0.0, 1.0)
    if stage == "recover":
        return 1 - smoothstep(progress, 0.0, 1.0)
    return 1.0


def hash_noise(x, y, z):
    n = math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453
    return n - math.floor(n)


def noise3(x, y, z):
    x0, y0, z0 = math.floor(x), math.floor(y), math.floor(z)
    fx, fy, fz = x - x0, y - y0, z - z0

    def fade(t):
        return t * t * t * (t * (t * 6 - 15) + 10)

    def sample(ix, iy, iz):
        return hash_noise(ix, iy, iz)

    ux, uy, uz = fade(fx), fade(fy), fade(fz)
    x00 = lerp(sample(x0, y0, z0), sample(x0 + 1, y0, z0), ux)
    x10 = lerp(sample(x0, y0 + 1, z0), sample(x0 + 1, y0 + 1, z0), ux)
    x01 = lerp(sample(x0, y0, z0 + 1), sample(x0 + 1, y0, z0 + 1), ux)
    x11 = lerp(sample(x0, y0 + 1, z0 + 1), sample(x0 + 1, y0 + 1, z0 + 1), ux)
    return lerp(lerp(x00, x10, uy), lerp(x01, x11, uy), uz)


def curl(x, y, z, time):
    e = 0.08
    dx = noise3(x, y + e, z + time) - noise3(x, y - e, z + time)
    dy = noise3(x + e, y, z + time) - noise3(x - e, y, z + time)
    dz = noise3(x + time, y + e, z) - noise3(x + time, y - e, z)
    return (dz - dy) / (2 * e), (dx - dz) / (2 * e), (dy - dx) / (2 * e)


def simulate_element(element):
    spec = {
        "fire": {"buoyancy": 1.55, "drag": 1.7, "curl": 1.35, "life": 0.85, "gravity": -0.05, "heat": 1.0},
        "ice": {"buoyancy": 0.08, "drag": 0.55, "curl": 0.25, "life": 1.35, "gravity": -0.35, "heat": 0.0},
        "cold-fire": {"buoyancy": 0.72, "drag": 1.15, "curl": 0.85, "life": 1.15, "gravity": -0.02, "heat": 0.45},
    }[element]
    particles = []
    for i in range(PARTICLES):
        side = -1 if i % 2 else 1
        if element == "ice":
            anchor = 1 if i < 18 else 2
            origin = (side * 0.02, 0.05 + (i % 6) * 0.01, 0.16)
            velocity = (side * (0.35 + (i % 5) * 0.08), 0.15 + (i % 4) * 0.05, 0.8 + (i % 3) * 0.15)
        elif element == "fire" and i % 5 == 0:
            anchor = 3 if i % 2 == 0 else 4
            origin = (0.0, 0.02, 0.05)
            velocity = (side * 0.25, 0.7, 0.35)
        else:
            anchor = 1 if i % 2 == 0 else 2
            origin = (0.0, 0.04, 0.08)
            velocity = (side * 0.18, 0.55 + (i % 4) * 0.12, 0.22)
        particles.append({"anchor": anchor, "p": list(origin), "v": list(velocity), "seed": i * 0.17})
    frames = []
    for frame in range(FRAMES):
        time = frame / (FRAMES - 1)
        sample = []
        for particle in particles:
            cx, cy, cz = curl(particle["p"][0] * 3.0, particle["p"][1] * 3.0, particle["p"][2] * 3.0 + particle["seed"], time * 2.0)
            buoyancy = spec["buoyancy"] * (0.35 + 0.65 * max(0.0, 1.0 - time / spec["life"]))
            particle["v"][0] += (cx * spec["curl"] - particle["v"][0] * spec["drag"]) * 0.08
            particle["v"][1] += (buoyancy + cy * spec["curl"] * 0.35 + spec["gravity"] - particle["v"][1] * spec["drag"] * 0.45) * 0.08
            particle["v"][2] += (cz * spec["curl"] * 0.6 - particle["v"][2] * spec["drag"] * 0.3) * 0.08
            for axis in range(3):
                particle["p"][axis] += particle["v"][axis] * 0.045
            heat = max(0.0, 1.0 - time / spec["life"])
            flicker = 0.82 + 0.18 * math.sin(time * 18 + particle["seed"] * 12)
            if element == "fire":
                color = (1.0, 0.42 + 0.40 * heat, 0.08 + 0.12 * heat)
                size = (0.16 + 0.34 * heat) * flicker
            elif element == "ice":
                color = (0.72 + 0.15 * heat, 0.90, 1.0)
                size = 0.07 + 0.09 * (1.0 - time * 0.35)
            else:
                core = heat ** 0.65
                color = (0.55 + 0.45 * core, 0.78 + 0.22 * core, 1.0)
                size = (0.12 + 0.28 * heat) * flicker
            alpha = max(0.0, heat) * (0.55 if element == "ice" else 0.9)
            sample.append([
                particle["anchor"],
                *[round(v, 4) for v in particle["p"]],
                round(size, 4), round(size * (1.6 if element != "ice" else 1.15), 4),
                *[round(c, 4) for c in color],
                round(alpha, 4),
            ])
        frames.append(sample)
    return frames


def fit_lights(element, frames):
    """Gradient fit of four local lights toward the reference palette."""
    target = {
        "fire": torch.tensor([1.00, 0.42, 0.08]),
        "ice": torch.tensor([0.62, 0.86, 1.00]),
        "cold-fire": torch.tensor([0.55, 0.78, 1.00]),
    }[element]
    core_weight = {"fire": 1.15, "ice": 0.72, "cold-fire": 1.35}[element]
    color = torch.tensor([0.8, 0.8, 0.8], requires_grad=True)
    gain = torch.tensor(1.0, requires_grad=True)
    opt = torch.optim.Adam([color, gain], lr=0.08)
    samples = torch.tensor([[p[6], p[7], p[8], p[9]] for frame in frames for p in frame])
    rgb, alpha = samples[:, :3], samples[:, 3:4]
    for _ in range(80):
        opt.zero_grad()
        palette = torch.sigmoid(color)
        mixed = rgb * alpha * torch.sigmoid(gain) * 1.4
        mean = mixed.mean(dim=0)
        loss = (mean - target * core_weight).pow(2).mean() + 0.02 * (palette - target).pow(2).mean()
        loss.backward()
        opt.step()
    palette = torch.sigmoid(color).detach()
    strength = float(torch.sigmoid(gain).detach())
    lights = []
    for frame_index, frame in enumerate(frames):
        u = frame_index / (FRAMES - 1)
        envelope = math.sin(math.pi * min(1.0, u * 1.15)) ** 0.8
        warm = [round(float(palette[i]), 4) for i in range(3)]
        fill = [round(min(1.0, warm[i] * 0.75 + (0.35 if element != "fire" else 0.15)), 4) for i in range(3)]
        lights.append([
            [1, 0.02, 0.08, 0.12, round(7.5 * strength * envelope, 3), *warm],
            [2, 0.02, 0.08, 0.12, round(7.5 * strength * envelope, 3), *warm],
            [0, 0.0, 0.25, 0.05, round(3.2 * strength * envelope, 3), *fill],
            [3 if element == "fire" else 0, 0.0, 0.05, 0.2, round((5.5 if element == "fire" else 2.4) * strength * envelope, 3), *warm],
        ])
    return {"palette": [round(float(palette[i]), 4) for i in range(3)], "strength": round(strength, 4), "frames": lights}


def low_high():
    low, high, scale = [], [], []
    for bone in BONES:
        limit = LIMITS[bone]
        gain = SCALES[bone]
        for _axis in "xyz":
            low.append(-limit)
            high.append(limit)
            scale.append(gain)
    return low, high, scale


LOW, HIGH, SCALE = low_high()
LOW_T = torch.tensor(LOW)
HIGH_T = torch.tensor(HIGH)
SCALE_T = torch.tensor(SCALE)
OBS = 1 + 2 + 3 + 3 + 10 + len(JOINTS) * 3
ACT = len(JOINTS)


def one_hot(index, width):
    value = torch.zeros(width)
    value[index] = 1
    return value


class Policy(nn.Module):
    def __init__(self):
        super().__init__()
        self.fc1 = nn.Linear(OBS, 128)
        self.fc2 = nn.Linear(128, 128)
        self.fc3 = nn.Linear(128, ACT)
        self.log_std = nn.Parameter(torch.full((ACT,), -0.7))
        self.value = nn.Sequential(nn.Linear(OBS, 128), nn.Tanh(), nn.Linear(128, 128), nn.Tanh(), nn.Linear(128, 1))

    def features(self, obs):
        hidden = torch.tanh(self.fc1(obs))
        hidden = torch.tanh(self.fc2(hidden))
        return hidden

    def mean(self, obs):
        return torch.tanh(self.fc3(self.features(obs)))

    def act(self, obs):
        hidden = self.features(obs)
        pre = self.fc3(hidden)
        std = self.log_std.exp().clamp(0.04, 0.6)
        dist = torch.distributions.Normal(pre, std)
        pre_sample = dist.rsample()
        action = torch.tanh(pre_sample)
        logp = dist.log_prob(pre_sample).sum(-1) - torch.log(1 - action.pow(2) + 1e-6).sum(-1)
        return action, logp, self.value(obs).squeeze(-1)


def stage_at(move, time):
    charge, strike = CHARGE[move], DURATION[move]
    if time < charge:
        return "charge", time / charge
    if time < charge + strike:
        return "strike", (time - charge) / strike
    recover_t = time - charge - strike
    return "recover", min(1.0, recover_t / RECOVER)


def episode_length(move):
    return CHARGE[move] + DURATION[move] + RECOVER


def observe(q, qd, move_index, stage, progress):
    move, element = MOVES[move_index]
    stage_index = {"charge": 0, "strike": 1, "recover": 2}[stage]
    element_index = ELEMENTS.index(element)
    ref = torch.tensor(reference_angles(move, stage, progress), dtype=torch.float32)
    phase = progress * math.tau
    parts = [
        torch.tensor([blend_for(stage, progress), math.sin(phase), math.cos(phase)]),
        one_hot(stage_index, 3),
        one_hot(element_index, 3),
        one_hot(move_index, 10),
        q, qd, ref,
    ]
    return torch.cat(parts), ref


def step_joints(q, qd, action, ref, blend):
    target = (ref + action * SCALE_T).clamp(LOW_T, HIGH_T)
    target = torch.lerp(q, target, max(0.2, float(blend)))
    acc = (80 * (target - q) - 16 * qd).clamp(-18, 18)
    qd = (qd + acc * DT).clamp(-4, 4)
    q = (q + qd * DT).clamp(LOW_T, HIGH_T)
    return q, qd


def rollout(policy, envs, steps):
    obs_buf, act_buf, logp_buf, rew_buf, val_buf, done_buf = [], [], [], [], [], []
    q = torch.zeros(envs, ACT)
    qd = torch.zeros(envs, ACT)
    move_index = torch.randint(0, len(MOVES), (envs,))
    elapsed = torch.zeros(envs)
    for _ in range(steps):
        observations, refs, blends, rewards_weight = [], [], [], []
        for env in range(envs):
            move = MOVES[int(move_index[env])][0]
            stage, progress = stage_at(move, float(elapsed[env]))
            observation, ref = observe(q[env], qd[env], int(move_index[env]), stage, progress)
            observations.append(observation)
            refs.append(ref)
            blends.append(blend_for(stage, progress))
        obs = torch.stack(observations)
        ref = torch.stack(refs)
        with torch.no_grad():
            action, logp, value = policy.act(obs)
        new_q = []
        new_qd = []
        reward = []
        done = []
        for env in range(envs):
            nq, nqd = step_joints(q[env], qd[env], action[env], ref[env], blends[env])
            err = (nq - ref[env]).pow(2).mean()
            teacher = ((ref[env] - q[env]) / SCALE_T).clamp(-1, 1)
            shaped = blends[env] * (-err * 4 + torch.exp(-err / 0.01)) - 0.08 * (action[env] - teacher).pow(2).mean() - 0.002 * nqd.pow(2).mean()
            new_q.append(nq)
            new_qd.append(nqd)
            reward.append(shaped)
            elapsed[env] += DT
            finished = float(elapsed[env]) >= episode_length(MOVES[int(move_index[env])][0])
            done.append(finished)
            if finished:
                move_index[env] = torch.randint(0, len(MOVES), ()).item()
                elapsed[env] = 0
                new_q[-1] = torch.zeros(ACT)
                new_qd[-1] = torch.zeros(ACT)
        q = torch.stack(new_q).detach()
        qd = torch.stack(new_qd).detach()
        obs_buf.append(obs)
        act_buf.append(action)
        logp_buf.append(logp)
        rew_buf.append(torch.stack(reward))
        val_buf.append(value)
        done_buf.append(torch.tensor(done, dtype=torch.float32))
    return map(torch.stack, (obs_buf, act_buf, logp_buf, rew_buf, val_buf, done_buf))


def advantages(rewards, values, dones, gamma=0.99, lam=0.95):
    steps, envs = rewards.shape
    adv = torch.zeros_like(rewards)
    last = torch.zeros(envs)
    next_value = torch.zeros(envs)
    for t in reversed(range(steps)):
        mask = 1 - dones[t]
        delta = rewards[t] + gamma * next_value * mask - values[t]
        last = delta + gamma * lam * mask * last
        adv[t] = last
        next_value = values[t]
    returns = adv + values
    adv = (adv - adv.mean()) / adv.std().clamp_min(1e-6)
    return adv, returns


def evaluate(policy, episodes=20):
    errors = []
    baseline = []
    with torch.no_grad():
        for episode in range(episodes):
            move_index = episode % len(MOVES)
            move = MOVES[move_index][0]
            q = torch.zeros(ACT)
            qd = torch.zeros(ACT)
            bq = torch.zeros(ACT)
            bqd = torch.zeros(ACT)
            time = 0.0
            while time < episode_length(move):
                stage, progress = stage_at(move, time)
                obs, ref = observe(q, qd, move_index, stage, progress)
                action = policy.mean(obs.unsqueeze(0)).squeeze(0)
                q, qd = step_joints(q, qd, action, ref, blend_for(stage, progress))
                bq, bqd = step_joints(bq, bqd, torch.zeros(ACT), ref, blend_for(stage, progress))
                errors.append(float((q - ref).pow(2).mean().sqrt()))
                baseline.append(float((bq - ref).pow(2).mean().sqrt()))
                time += DT
    return sum(errors) / len(errors), sum(baseline) / len(baseline)


def export_policy(policy, report_name):
    layers = []
    for linear in (policy.fc1, policy.fc2, policy.fc3):
        weight = linear.weight.detach().cpu().tolist()
        bias = linear.bias.detach().cpu().tolist()
        layers.append({"weights": weight, "bias": bias})
    payload = {
        "version": 44,
        "algorithm": "PPO residual joint control",
        "backend": "PyTorch clipped PPO with the browser spring integrator",
        "control_hz": 30,
        "observation_size": OBS,
        "action_size": ACT,
        "joint_order": JOINTS,
        "limits_low": LOW,
        "limits_high": HIGH,
        "action_scales": SCALE,
        "observation_layout": ["blend", "sin_phase", "cos_phase", "stage_3", "element_3", "move_10", "q", "qd", "q_ref"],
        "layers": layers,
        "training_report": report_name,
    }
    text = json.dumps(payload, separators=(",", ":"))
    path = POLICY / "combat-ppo-v44.json"
    path.write_text(text)
    digest = hashlib.sha256(text.encode()).hexdigest()
    return path, digest


def main():
    torch.manual_seed(SEED)
    torch.set_num_threads(8)
    POLICY.mkdir(parents=True, exist_ok=True)
    dynamics = {"version": 44, "frames": FRAMES, "anchors": ANCHORS, "elements": {}}
    for element in ELEMENTS:
        frames = simulate_element(element)
        dynamics["elements"][element] = {"particles": frames, "lights": fit_lights(element, frames)}
        print(element, "palette", dynamics["elements"][element]["lights"]["palette"], "strength", dynamics["elements"][element]["lights"]["strength"])
    dynamics_path = POLICY / "elemental-dynamics-v44.json"
    dynamics_text = json.dumps(dynamics, separators=(",", ":"))
    dynamics_path.write_text(dynamics_text)
    dynamics_sha = hashlib.sha256(dynamics_text.encode()).hexdigest()

    policy = Policy()
    with torch.no_grad():
        policy.fc3.weight.mul_(0.01)
        policy.fc3.bias.zero_()
        policy.log_std.fill_(-2.2)
    dataset_obs, dataset_act = [], []
    for move_index, (move, _element) in enumerate(MOVES):
        for controller in ("teacher", "zero"):
            q = torch.zeros(ACT)
            qd = torch.zeros(ACT)
            time = 0.0
            while time < episode_length(move):
                stage, progress = stage_at(move, time)
                obs, ref = observe(q, qd, move_index, stage, progress)
                teacher = ((ref - q) / SCALE_T).clamp(-1, 1)
                dataset_obs.append(obs)
                dataset_act.append(teacher)
                action = teacher if controller == "teacher" else torch.zeros(ACT)
                q, qd = step_joints(q, qd, action, ref, blend_for(stage, progress))
                time += DT
    dataset_obs = torch.stack(dataset_obs)
    dataset_act = torch.stack(dataset_act)
    pretrain = torch.optim.Adam(policy.parameters(), lr=1e-3)
    for epoch in range(80):
        pred = policy.mean(dataset_obs)
        loss = (pred - dataset_act).pow(2).mean()
        pretrain.zero_grad()
        loss.backward()
        pretrain.step()
        if epoch % 20 == 0 or epoch == 79:
            rmse, baseline = evaluate(policy, episodes=10)
            print(f"pretrain {epoch:02d} loss {float(loss.detach()):.5f} rmse {rmse:.4f} baseline {baseline:.4f}")
    optimizer = torch.optim.Adam(policy.parameters(), lr=8e-5)
    updates = 12
    envs = 64
    steps = 48
    history = []
    best_rmse = 1e9
    best_state = {key: value.detach().clone() for key, value in policy.state_dict().items()}
    for update in range(updates):
        obs, actions, old_logp, rewards, values, dones = rollout(policy, envs, steps)
        adv, returns = advantages(rewards, values, dones)
        flat_obs = obs.reshape(-1, OBS)
        flat_act = actions.reshape(-1, ACT)
        flat_logp = old_logp.reshape(-1)
        flat_adv = adv.reshape(-1)
        flat_ret = returns.reshape(-1)
        indexes = torch.randperm(flat_obs.shape[0])
        last_loss = None
        for _epoch in range(4):
            for start in range(0, indexes.numel(), 1024):
                batch = indexes[start:start + 1024]
                new_action, new_logp, new_value = policy.act(flat_obs[batch])
                # Recompute log-prob of the stored squashed action through the current distribution.
                hidden = policy.features(flat_obs[batch])
                pre = policy.fc3(hidden)
                std = policy.log_std.exp().clamp(0.04, 0.6)
                stored = flat_act[batch].clamp(-0.999, 0.999)
                pre_action = 0.5 * torch.log((1 + stored) / (1 - stored))
                dist = torch.distributions.Normal(pre, std)
                logp = dist.log_prob(pre_action).sum(-1) - torch.log(1 - stored.pow(2) + 1e-6).sum(-1)
                ratio = torch.exp(logp - flat_logp[batch])
                clipped = torch.clamp(ratio, 0.8, 1.2) * flat_adv[batch]
                policy_loss = -torch.min(ratio * flat_adv[batch], clipped).mean()
                value_loss = 0.5 * (new_value - flat_ret[batch]).pow(2).mean()
                entropy = dist.entropy().sum(-1).mean()
                loss = policy_loss + value_loss - 0.003 * entropy
                optimizer.zero_grad()
                loss.backward()
                nn.utils.clip_grad_norm_(policy.parameters(), 0.5)
                optimizer.step()
                last_loss = float(loss.detach())
        if update % 6 == 0 or update == updates - 1:
            rmse, baseline = evaluate(policy)
            history.append({"update": update, "loss": last_loss, "rmse": rmse, "zero_residual_rmse": baseline})
            print(f"update {update:02d} loss {last_loss:.4f} rmse {rmse:.4f} baseline {baseline:.4f}")
            if rmse < best_rmse:
                best_rmse = rmse
                best_state = {key: value.detach().clone() for key, value in policy.state_dict().items()}
    policy.load_state_dict(best_state)
    final_rmse, baseline = evaluate(policy, episodes=30)
    _path, digest = export_policy(policy, "combat-ppo-training-v44.json")
    report = {
        "version": 44,
        "seed": SEED,
        "algorithm": "clipped PPO",
        "gamma": 0.99,
        "gae_lambda": 0.95,
        "clip": 0.2,
        "updates": updates,
        "envs": envs,
        "steps_per_update": steps,
        "control_hz": 30,
        "selected_rmse_rad": final_rmse,
        "zero_residual_rmse_rad": baseline,
        "improvement": baseline - final_rmse,
        "history": history,
        "policy_sha256": digest,
        "dynamics_sha256": dynamics_sha,
        "isaac_lab": "Not launched. The GPU already hosts Isaac-Q1-Native-Backflip training and a live Isaac play server.",
        "blender": "Not installed on this machine. Element motion is a curl-noise particle simulation with an 80-step palette fit.",
        "elements": {element: dynamics["elements"][element]["lights"]["palette"] for element in ELEMENTS},
        "moves": [{"id": move, "element": element} for move, element in MOVES],
    }
    (POLICY / "combat-ppo-training-v44.json").write_text(json.dumps(report, indent=2))
    print(json.dumps({"rmse": final_rmse, "baseline": baseline, "dynamics_bytes": dynamics_path.stat().st_size, "policy_bytes": (POLICY / "combat-ppo-v44.json").stat().st_size}, indent=2))


if __name__ == "__main__":
    main()
