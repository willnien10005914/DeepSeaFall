#!/usr/bin/env python3
"""Deep Sea Fall — Isaac Sim cinematic vertical dive (Girl & Whale mood).

Procedural proxies (spheres/cuboids) + teal lighting for a vertical media-tower
style descent. Writes RGB PNG frames for ffmpeg.

Usage:
  ./run_cinematic.sh --frames 90
  # or from IsaacLab:
  ./isaaclab.sh -p .../deep_sea_cinematic.py --headless --enable_cameras --frames 90
"""

from __future__ import annotations

import argparse
import math
from pathlib import Path

from isaaclab.app import AppLauncher

parser = argparse.ArgumentParser(description="Deep Sea Fall Isaac cinematic")
parser.add_argument("--frames", type=int, default=90)
parser.add_argument("--width", type=int, default=720)
parser.add_argument("--height", type=int, default=1280)
parser.add_argument("--out", type=str, default="")
AppLauncher.add_app_launcher_args(parser)
args_cli = parser.parse_args()
args_cli.enable_cameras = True

app_launcher = AppLauncher(args_cli)
simulation_app = app_launcher.app

import numpy as np
import torch

import isaaclab.sim as sim_utils
from isaaclab.sensors.camera import Camera, CameraCfg


def spawn_scene():
    # Local geometry only — avoid Nucleus GroundPlane USD (can hang offline).
    floor = sim_utils.CuboidCfg(
        size=(40.0, 0.2, 40.0),
        visual_material=sim_utils.PreviewSurfaceCfg(diffuse_color=(0.02, 0.05, 0.09), roughness=1.0),
    )
    floor.func("/World/OceanFloor", floor, translation=(0.0, -0.1, 0.0))

    dome = sim_utils.DomeLightCfg(intensity=500.0, color=(0.12, 0.32, 0.42))
    dome.func("/World/Dome", dome)

    sun = sim_utils.DistantLightCfg(intensity=1800.0, color=(0.5, 0.8, 0.95))
    sun.func("/World/SunShaft", sun, translation=(3.0, 14.0, 2.0))

    bio = sim_utils.SphereLightCfg(intensity=12000.0, color=(0.3, 0.95, 1.0), radius=0.35)
    bio.func("/World/BioLight", bio, translation=(0.4, 1.6, 1.0))

    rock_m = sim_utils.PreviewSurfaceCfg(diffuse_color=(0.16, 0.2, 0.26), roughness=0.95)
    lava_m = sim_utils.PreviewSurfaceCfg(diffuse_color=(0.4, 0.12, 0.06), roughness=0.85)
    orb_m = sim_utils.PreviewSurfaceCfg(diffuse_color=(0.45, 1.0, 0.75), roughness=0.2)

    # Original USD assets (visual reference only — avoid UsdFileCfg physics path)
    assets = Path(__file__).resolve().parents[1] / "assets" / "usd"
    girl_usd = assets / "girl.usda"
    whale_usd = assets / "whale.usda"
    if girl_usd.exists() and whale_usd.exists():
        print(f"[cinematic] referencing USD assets from {assets}", flush=True)
        import omni.usd
        from pxr import Gf, UsdGeom

        stage = omni.usd.get_context().get_stage()

        def _ref(path: str, usd_file: Path, translate, scale=1.0):
            prim = stage.DefinePrim(path, "Xform")
            prim.GetReferences().AddReference(str(usd_file))
            xform = UsdGeom.Xformable(prim)
            xform.ClearXformOpOrder()
            xform.AddTranslateOp().Set(Gf.Vec3d(*translate))
            xform.AddScaleOp().Set(Gf.Vec3f(scale, scale, scale))

        _ref("/World/Girl", girl_usd, (0.0, 0.0, 0.0), 1.0)
        _ref("/World/Whale", whale_usd, (0.8, 0.15, -1.0), 1.1)
        print("[cinematic] USD references attached", flush=True)
    else:
        print("[cinematic] USD missing — fallback proxies. Run assets/scripts/generate_usd_from_style.py", flush=True)
        skin = sim_utils.PreviewSurfaceCfg(diffuse_color=(0.98, 0.84, 0.76), roughness=0.45)
        dress = sim_utils.PreviewSurfaceCfg(diffuse_color=(0.42, 0.84, 0.94), roughness=0.35)
        whale_m = sim_utils.PreviewSurfaceCfg(diffuse_color=(0.4, 0.54, 0.64), roughness=0.4)
        sim_utils.SphereCfg(radius=0.14, visual_material=skin).func(
            "/World/Girl/Head", sim_utils.SphereCfg(radius=0.14, visual_material=skin), translation=(0.0, 1.55, 0.0)
        )
        sim_utils.CuboidCfg(size=(0.22, 0.48, 0.16), visual_material=dress).func(
            "/World/Girl/Body",
            sim_utils.CuboidCfg(size=(0.22, 0.48, 0.16), visual_material=dress),
            translation=(0.0, 1.15, 0.0),
        )
        sim_utils.SphereCfg(radius=0.95, visual_material=whale_m).func(
            "/World/Whale/Body",
            sim_utils.SphereCfg(radius=0.95, visual_material=whale_m),
            translation=(1.9, 1.05, -0.7),
        )

    for i, x in enumerate((-2.5, -1.7, 2.1, 2.9, -3.0, 3.3)):
        h = 1.3 + (i % 3) * 0.75
        mat = lava_m if i % 4 == 0 else rock_m
        sim_utils.CuboidCfg(size=(0.75, h, 0.75), visual_material=mat).func(
            f"/World/Rocks/Rock_{i}",
            sim_utils.CuboidCfg(size=(0.75, h, 0.75), visual_material=mat),
            translation=(x, h * 0.5, -1.6 - i * 0.45),
        )

    for i in range(16):
        ang = i / 16 * math.tau
        sim_utils.SphereCfg(radius=0.05, visual_material=orb_m).func(
            f"/World/Bio/Orb_{i}",
            sim_utils.SphereCfg(radius=0.05, visual_material=orb_m),
            translation=(math.cos(ang) * 2.6, 0.5 + (i % 5) * 0.45, math.sin(ang) * 2.1 - 1.0),
        )


def make_camera(width: int, height: int) -> Camera:
    sim_utils.create_prim("/World/CineCamOrigin", "Xform")
    cfg = CameraCfg(
        prim_path="/World/CineCamOrigin/Camera",
        update_period=0.0,
        height=height,
        width=width,
        data_types=["rgb"],
        spawn=sim_utils.PinholeCameraCfg(
            focal_length=16.0,
            focus_distance=5.0,
            horizontal_aperture=20.955,
            clipping_range=(0.05, 100.0),
        ),
    )
    return Camera(cfg=cfg)


def main():
    out_dir = Path(args_cli.out) if args_cli.out else Path(__file__).resolve().parent / "output" / "frames"
    out_dir.mkdir(parents=True, exist_ok=True)

    sim_cfg = sim_utils.SimulationCfg(dt=1.0 / 30.0, device=args_cli.device)
    print("[cinematic] creating SimulationContext...", flush=True)
    sim = sim_utils.SimulationContext(sim_cfg)
    print("[cinematic] spawning local scene (no Nucleus)...", flush=True)
    spawn_scene()
    print("[cinematic] creating camera...", flush=True)
    camera = make_camera(args_cli.width, args_cli.height)
    print("[cinematic] sim.reset...", flush=True)
    sim.reset()
    camera.reset()
    # Warmup a few steps so render products initialize
    for _ in range(5):
        sim.step()
        camera.update(dt=sim_cfg.dt)
    print("[cinematic] warmup done", flush=True)

    n = args_cli.frames
    print(f"[cinematic] capturing {n} vertical frames -> {out_dir}", flush=True)

    for i in range(n):
        t = i / max(1, n - 1)
        cam_y = 3.4 - t * 4.8
        cam_z = 5.8 - t * 1.0
        sway = math.sin(t * math.pi * 4.0) * 0.1
        eye = torch.tensor([[0.15 + sway, cam_y, cam_z]], device=camera.device)
        target = torch.tensor([[0.35, 1.25 - t * 0.7, -0.35]], device=camera.device)
        camera.set_world_poses_from_view(eye, target)

        sim.step()
        camera.update(dt=sim_cfg.dt)

        rgb = camera.data.output.get("rgb")
        if rgb is None:
            print(f"[cinematic] warn: no rgb at frame {i}")
            continue
        frame = rgb[0].detach().cpu().numpy()
        if frame.shape[-1] == 4:
            frame = frame[..., :3]
        # deepen color grade with depth
        grade = 1.0 - 0.4 * t
        frame = np.clip(frame.astype(np.float32) * grade, 0, 255).astype(np.uint8).copy()
        frame[..., 2] = np.clip(frame[..., 2].astype(np.int16) + int(24 * t), 0, 255).astype(np.uint8)
        frame[..., 0] = np.clip(frame[..., 0].astype(np.int16) - int(12 * t), 0, 255).astype(np.uint8)

        from PIL import Image

        Image.fromarray(frame).save(out_dir / f"frame_{i:04d}.png")
        if i % 10 == 0:
            print(f"[cinematic] frame {i}/{n} t={t:.2f}")

    print(f"[cinematic] done -> {out_dir}")


if __name__ == "__main__":
    try:
        main()
    finally:
        simulation_app.close()
