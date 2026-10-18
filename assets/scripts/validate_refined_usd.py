"""Check portable USD mesh data and resolve every authored texture."""
from pathlib import Path
import json
from pxr import Usd,UsdGeom,UsdShade

root=Path(__file__).resolve().parents[2]
results={}
for name in ['girl.usda','whale.usda','deep_sea_stage.usda']:
    stage=Usd.Stage.Open(str(root/'assets/usd'/name));assert stage,name
    assert UsdGeom.GetStageUpAxis(stage)=='Y'
    assert UsdGeom.GetStageMetersPerUnit(stage)==1
    meshes=0;textures=0
    for prim in stage.Traverse():
        if prim.IsA(UsdGeom.Mesh):
            mesh=UsdGeom.Mesh(prim);points=mesh.GetPointsAttr().Get();normals=mesh.GetNormalsAttr().Get()
            assert len(normals)==len(points),(prim.GetPath(),'normals')
            uv=UsdGeom.PrimvarsAPI(prim).GetPrimvar('st')
            if uv:assert len(uv.Get())==len(points),(prim.GetPath(),'UV',len(uv.Get()),len(points))
            meshes+=1
        if prim.IsA(UsdShade.Shader):
            file=UsdShade.Shader(prim).GetInput('file')
            if file:
                asset=file.Get();assert asset.resolvedPath and Path(asset.resolvedPath).is_file(),asset
                textures+=1
    results[name]={'meshes':meshes,'resolvedTextures':textures,'normalsAndUV':'pass'}
output=root/'assets/previews/v4' if (root/'assets/previews/v4').exists() else root/'assets/previews/v3'
(output/'usd-verification.json').write_text(json.dumps(results,indent=2))
print(json.dumps(results,indent=2))
