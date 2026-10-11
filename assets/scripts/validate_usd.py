"""Open generated USDA with pxr (run via isaaclab.sh -p)."""
from pathlib import Path

from pxr import Usd, UsdGeom

ROOT = Path(__file__).resolve().parents[1] / "usd"
for name in ("girl.usda", "whale.usda", "deep_sea_stage.usda"):
    path = ROOT / name
    stage = Usd.Stage.Open(str(path))
    if not stage:
        raise SystemExit(f"FAIL open {path}")
    meshes = [p.GetPath() for p in stage.Traverse() if p.IsA(UsdGeom.Mesh)]
    mats = [p.GetPath() for p in stage.Traverse() if p.GetTypeName() == "Material"]
    print(f"OK {name}: meshes={len(meshes)} materials={len(mats)}")
print("USD parse OK")
