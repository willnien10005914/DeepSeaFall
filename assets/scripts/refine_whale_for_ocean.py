"""Rebuild a broad headed humpback and non-striped, anatomical skin maps."""
from pathlib import Path
import json,math
import numpy as np
from scipy.ndimage import gaussian_filter,zoom
from PIL import Image
import trimesh
import rebuild_realistic as base

root=Path(__file__).resolve().parents[2];folder=root/'assets/usd/textures'
rng=np.random.default_rng(124);n=1024
u,v=np.meshgrid(np.linspace(0,1,n),np.linspace(0,1,n))
# Multiscale random fields avoid the periodic bands in the earlier sine texture.
mottle=np.zeros((n,n))
for size,weight in [(8,1.0),(24,.40),(80,.16),(256,.06)]:
 field=zoom(rng.normal(0,1,(size,size)),n/size,order=3)[:n,:n]
 mottle+=field*weight
grain=rng.normal(0,1,(n,n));color=np.clip(50+mottle*8+grain*1.4,26,79)
rgb=np.stack([color*.84,color*.97,color*1.02],-1)
# UV v is the angular coordinate. Positive sin is the dorsal surface; it stays dark.
ventral=np.clip((-np.sin(v*math.tau)-.18)*3.0+mottle*.12,0,1)
front=np.clip((u-.36)/.20,0,1)
pale=np.clip(ventral*front,0,1)[...,None]
light=np.stack([color*1.40+42,color*1.42+47,color*1.38+47],-1)
rgb=rgb*(1-pale)+light*pale
for _ in range(52):
 x=int(rng.integers(60,n-60));y=int(rng.integers(20,n-20));length=int(rng.integers(5,22))
 for j in range(length):rgb[max(0,y+j//5):y+j//5+1,x+j]=rgb[y,x]*.65+np.array([70,74,72])*.35
Image.fromarray(np.uint8(np.clip(rgb,0,255))).save(folder/'whale_color.jpg',quality=95)
rough=np.uint8(np.clip(124+mottle*12+grain*3,93,165))
Image.fromarray(np.stack([np.full_like(rough,255),rough,np.zeros_like(rough)],-1)).save(folder/'whale_roughness.png')
height=gaussian_filter(grain,.55)*.09+mottle*.14
dy,dx=np.gradient(height);normal=np.stack([-dx,-dy,np.ones_like(height)],-1);normal/=np.linalg.norm(normal,axis=-1)[...,None]
Image.fromarray(np.uint8(np.clip((normal*.5+.5)*255,0,255))).save(folder/'whale_normal.png')
maps={'baseColorTexture':Image.open(folder/'whale_color.jpg'),'normalTexture':Image.open(folder/'whale_normal.png'),'metallicRoughnessTexture':Image.open(folder/'whale_roughness.png')}
base.textures['whale']=maps;base.textures['belly']=maps
parts=base.whale()
orientation={}
for name,mesh in parts.items():
 p=mesh.vertices
 if name=='whale_body':radial=np.column_stack([np.zeros(len(p)),p[:,1]-.14,p[:,2]])
 elif name.startswith('pectoral'):
  s=np.clip((abs(p[:,2])-1.10)/3.60,0,1)
  radial=np.column_stack([p[:,0]-(.95-1.7*s+.28*np.sin(s*math.pi)),p[:,1]-(-.35-.5*s),np.zeros(len(p))])
 elif name.startswith('fluke'):
  s=np.clip((abs(p[:,2])-.04)/2.13,0,1)
  radial=np.column_stack([p[:,0]-(-5.85+.25*s-.3*np.sin(math.pi*s)),p[:,1]-(.04+.16*s*s),np.zeros(len(p))])
 elif name=='dorsal':
  s=np.clip((p[:,1]-.98)/.76,0,1);radial=np.column_stack([p[:,0]-(-2.0-.62*s),np.zeros(len(p)),p[:,2]])
 else:continue
 dot=np.sum(mesh.vertex_normals*radial,axis=1);value=float(np.median(dot))
 if value<0:mesh.invert()
 orientation[name]={'original_outward_dot':value,'inverted':value<0,'final_outward_dot':float(np.median(np.sum(mesh.vertex_normals*radial,axis=1)))}
 assert orientation[name]['final_outward_dot']>=0,name
assert all(np.isfinite(mesh.vertices).all() for mesh in parts.values())
base.pbr(parts,root/'assets/usd/whale.glb');base.textured_usd(parts,root/'assets/usd/whale.usda','Whale')
report=json.loads((root/'assets/usd/rebuild_report.json').read_text())
report['whale']={'revision':4,'meshes':len(parts),'vertices':sum(len(m.vertices) for m in parts.values()),'triangles':sum(len(m.faces) for m in parts.values()),'bounds_m':trimesh.Scene(list(parts.values())).bounds.tolist(),'glb_bytes':(root/'assets/usd/whale.glb').stat().st_size,'skin':'dark dorsal, mottled pale ventral, non-periodic pores','head_width_m':3.22,'surface_orientation':orientation}
(root/'assets/usd/rebuild_report.json').write_text(json.dumps(report,indent=2));print(json.dumps(report['whale'],indent=2))
