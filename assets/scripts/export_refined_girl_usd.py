"""Mirror the reviewed Blender GLB into portable Y-up textured USD."""
from pathlib import Path
import json,importlib.util,math
import numpy as np
import trimesh

ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'assets/usd'
spec=importlib.util.spec_from_file_location('legacy',Path(__file__).with_name('generate_usd_from_style.py'))
legacy=importlib.util.module_from_spec(spec);spec.loader.exec_module(legacy)
scene=trimesh.load(OUT/'girl.glb',force='scene',process=False)
parts={};materials={}
texture_names={'skin':'skin_color.png','hair':'groom_color.png','brows':'brows_color.png','lashes':'lashes_color.png','eyes':'eyes_color.png'}
for node in scene.graph.nodes_geometry:
 transform,geometry=scene.graph[node];mesh=scene.geometry[geometry].copy();mesh.apply_transform(transform)
 # The USD writer deduplicates coincident vertices. Update the UV array in the
 # same operation before writing it, so both attributes use identical indices.
 mesh.merge_vertices()
 mat=mesh.visual.material;name=mat.name
 parts[node]=mesh;legacy.PART_MAT[node]=name
 factor=np.array(mat.baseColorFactor if mat.baseColorFactor is not None else [255]*4,dtype=float)/255
 color=tuple(factor[:3]);rough=float(mat.roughnessFactor if mat.roughnessFactor is not None else .5)
 materials[name]=(color,rough,0.,(0,0,0),0.,.15,1.45,.45)
legacy.MATS=materials
legacy.write_character_usda(OUT/'girl.usda','Girl',parts)
doc=(OUT/'girl.usda').read_text()
for name,file in texture_names.items():
 if name not in materials:continue
 start=doc.index('def Material "'+name+'"');end=doc.find('def Material ',start+15)
 if end<0:end=doc.index('    def Mesh ',start)
 block=doc[start:end]
 import re
 block=re.sub(r'color3f inputs:diffuseColor = \([^\n]+\)',
  f'color3f inputs:diffuseColor.connect = </Girl/Looks/{name}/Color.outputs:rgb>',block)
 alpha=name in ['hair','brows','lashes','eyes']
 if alpha:
  block=block.replace('float inputs:opacity = 1',f'float inputs:opacity.connect = </Girl/Looks/{name}/Color.outputs:a>\n                float inputs:opacityThreshold = {0.04 if name=="eyes" else .06}')
 cut=block.rfind('        }')
 nodes=f'''            def Shader "UV" {{
                uniform token info:id = "UsdPrimvarReader_float2"
                token inputs:varname = "st"
                float2 outputs:result
            }}
            def Shader "Color" {{
                uniform token info:id = "UsdUVTexture"
                asset inputs:file = @textures/{file}@
                token inputs:sourceColorSpace = "sRGB"
                float2 inputs:st.connect = </Girl/Looks/{name}/UV.outputs:result>
                float3 outputs:rgb
                float outputs:a
            }}
'''
 block=block[:cut]+nodes+block[cut:];doc=doc[:start]+block+doc[end:]
for name,mesh in parts.items():
 uv=mesh.visual.uv
 values=legacy._wrap_tokens([f'({u:.7f}, {v:.7f})' for u,v in uv],6)
 target='def Mesh "'+name+'"\n    {'
 text=target+'\n        bool doubleSided = true\n        texCoord2f[] primvars:st = [\n'+values+'\n        ] ( interpolation = "vertex" )'
 doc=doc.replace(target,text)
(OUT/'girl.usda').write_text(doc)
report=json.loads((OUT/'rebuild_report.json').read_text())
report['girl']={'revision':3,'meshes':len(parts),'vertices':sum(len(m.vertices) for m in parts.values()),'triangles':sum(len(m.faces) for m in parts.values()),'materials':sorted(materials),'bounds_m':scene.bounds.tolist(),'glb_bytes':(OUT/'girl.glb').stat().st_size,'editable_source':'assets/refined/girl_reference_v3.blend','film_hair_strands':len(json.loads((ROOT/'assets/refined/girl_quad_source.json').read_text())['hair_guides'])*28}
(OUT/'rebuild_report.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report['girl'],indent=2))
