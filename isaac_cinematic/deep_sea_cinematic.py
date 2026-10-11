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
parser.add_argument(
    "--showcase",
    action="store_true",
    help="Orbit camera for clear character/material previews (girl + whale).",
)
AppLauncher.add_app_launcher_args(parser)
args_cli = parser.parse_args()
args_cli.enable_cameras = True

app_launcher = AppLauncher(args_cli)
simulation_app = app_launcher.app

import numpy as np
import torch

import isaaclab.sim as sim_utils
from isaaclab.sensors.camera import Camera, CameraCfg


def spawn_scene(showcase: bool = False):
    # Local geometry only — avoid Nucleus GroundPlane USD (can hang offline).
    floor = sim_utils.CuboidCfg(
        size=(40.0, 0.2, 40.0),
        visual_material=sim_utils.PreviewSurfaceCfg(diffuse_color=(0.02, 0.05, 0.09), roughness=1.0),
    )
    floor.func("/World/OceanFloor", floor, translation=(0.0, -0.1, 0.0))

    # Soft ocean fill + rim keys so clearcoat / skin read on camera
    dome = sim_utils.DomeLightCfg(intensity=1100.0 if showcase else 900.0, color=(0.18, 0.38, 0.48))
    dome.func("/World/Dome", dome)

    sun = sim_utils.DistantLightCfg(intensity=3200.0 if showcase else 2800.0, color=(0.72, 0.88, 1.0))
    sun.func("/World/SunShaft", sun, translation=(4.0, 16.0, 3.0))

    key = sim_utils.SphereLightCfg(intensity=28000.0 if showcase else 22000.0, color=(0.85, 0.95, 1.0), radius=0.5)
    key.func("/World/KeyLight", key, translation=(2.8, 3.0, 4.0))

    rim = sim_utils.SphereLightCfg(intensity=20000.0 if showcase else 16000.0, color=(0.35, 0.9, 1.0), radius=0.4)
    rim.func("/World/RimLight", rim, translation=(-2.6, 2.2, -1.8))

    warm = sim_utils.SphereLightCfg(intensity=14000.0 if showcase else 9000.0, color=(1.0, 0.84, 0.72), radius=0.35)
    warm.func("/World/WarmFill", warm, translation=(-0.4, 1.6, 2.6))

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

        def _ref(path: str, usd_file: Path, translate, scale=1.0, rotate_y_deg=0.0):
            prim = stage.DefinePrim(path, "Xform")
            prim.GetReferences().AddReference(str(usd_file))
            xform = UsdGeom.Xformable(prim)
            xform.ClearXformOpOrder()
            xform.AddTranslateOp().Set(Gf.Vec3d(*translate))
            if rotate_y_deg:
                xform.AddRotateYOp().Set(float(rotate_y_deg))
            xform.AddScaleOp().Set(Gf.Vec3f(scale, scale, scale))

        if showcase:
            # Side-by-side turnaround: girl readable, whale wet skin beside her
            _ref("/World/Girl", girl_usd, (-1.15, 0.0, 0.35), 1.45, rotate_y_deg=18.0)
            _ref("/World/Whale", whale_usd, (1.55, 0.05, -0.35), 0.78, rotate_y_deg=-12.0)
        else:
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

    if not showcase:
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
    else:
        # Sparse bioluminescence so characters stay the hero
        for i in range(8):
            ang = i / 8 * math.tau
            sim_utils.SphereCfg(radius=0.04, visual_material=orb_m).func(
                f"/World/Bio/Orb_{i}",
                sim_utils.SphereCfg(radius=0.04, visual_material=orb_m),
                translation=(math.cos(ang) * 3.4, 0.35 + (i % 3) * 0.35, math.sin(ang) * 2.8 - 0.2),
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

    showcase = bool(args_cli.showcase)
    sim_cfg = sim_utils.SimulationCfg(dt=1.0 / 30.0, device=args_cli.device)
    print("[cinematic] creating SimulationContext...", flush=True)
    sim = sim_utils.SimulationContext(sim_cfg)
    print("[cinematic] spawning local scene (no Nucleus)...", flush=True)
    spawn_scene(showcase=showcase)
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
    print(f"[cinematic] capturing {n} frames showcase={showcase} -> {out_dir}", flush=True)

    for i in range(n):
        t = i / max(1, n - 1)
        if showcase:
            # Orbit so girl (left) + whale (right) both stay in frame
            ang = t * math.tau + 0.35
            rad = 6.8
            eye = torch.tensor(
                [[math.cos(ang) * rad + 0.15, 1.85 + 0.35 * math.sin(ang), math.sin(ang) * rad + 0.55]],
                device=camera.device,
            )
            target = torch.tensor([[0.2, 1.35, 0.05]], device=camera.device)
        else:
            cam_y = 2.2 - t * 0.6
            cam_z = 6.2 - t * 0.4
            sway = math.sin(t * math.pi * 2.0) * 0.15
            eye = torch.tensor([[0.9 + sway, cam_y, cam_z]], device=camera.device)
            target = torch.tensor([[1.0, 1.3, -0.5]], device=camera.device)
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
        frame = np.clip(frame.astype(np.float32), 0, 255).astype(np.uint8).copy()
        if not showcase:
            # mild deep-sea grade (keep characters readable)
            grade = 1.0 - 0.18 * t
            frame = np.clip(frame.astype(np.float32) * grade, 0, 255).astype(np.uint8)
            frame[..., 2] = np.clip(frame[..., 2].astype(np.int16) + int(12 * t), 0, 255).astype(np.uint8)

        from PIL import Image

        Image.fromarray(frame).save(out_dir / f"frame_{i:04d}.png")
        if i % 5 == 0:
            print(f"[cinematic] frame {i}/{n} t={t:.2f}", flush=True)

    print(f"[cinematic] done -> {out_dir}", flush=True)


if __name__ == "__main__":
    try:
        main()
    finally:
        simulation_app.close()
