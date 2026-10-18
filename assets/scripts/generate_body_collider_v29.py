from pathlib import Path
import json
r=Path(__file__).resolve().parents[2];d=json.loads((r/'assets/refined/girl_portrait_source_v29.json').read_text());v=d['meshes'][0]['vertices'];group='';tri=[]
for line in (r/'assets/sources/makehuman/base.obj').read_text().splitlines():
 b=line.split()
 if not b:continue
 if b[0]=='g':group=b[1]
 if b[0]=='f' and group=='body':
  f=[int(p.split('/')[0])-1 for p in b[1:]]
  if min(v[i][1] for i in f)>1.35:continue
  for i in range(1,len(f)-1):tri.extend([f[0],f[i],f[i+1]])
(r/'js/three/body-collider-data.js').write_text('export const bodyColliderData='+json.dumps({'positions':[a for p in v for a in p],'index':tri},separators=(',',':'))+';\n')
print('Collision triangles',len(tri)//3)

from pathlib import Path
import json,collections,numpy as np,trimesh
r=Path(__file__).resolve().parents[2];p=r/'js/three/body-collider-data.js';d=json.loads(p.read_text().split('=',1)[1].strip().rstrip(';'));v=np.array(d['positions']).reshape(-1,3).tolist();f=np.array(d['index']).reshape(-1,3).tolist();edges={};count=collections.Counter()
for face in f:
 for a,b in zip(face,face[1:]+face[:1]):key=tuple(sorted([a,b]));count[key]+=1;edges[key]=(a,b)
bound=[edges[k] for k,c in count.items() if c==1];adj=collections.defaultdict(list)
for a,b in bound:adj[a].append(b);adj[b].append(a)
unseen=set(adj);caps=0
while unseen:
 todo=[unseen.pop()];ids=[]
 while todo:
  a=todo.pop();ids.append(a)
  for b in adj[a]:
   if b in unseen:unseen.remove(b);todo.append(b)
 center=np.array([v[i] for i in ids]).mean(0);ci=len(v);v.append(center.tolist());caps+=1
 for a,b in bound:
  if a in ids:f.append([ci,b,a])
mesh=trimesh.Trimesh(v,f,process=False);print('Capped loops',caps,'closed',mesh.is_watertight,'winding',mesh.is_winding_consistent);assert mesh.is_watertight
p.write_text('export const bodyColliderData='+json.dumps({'positions':[a for row in v for a in row],'index':[a for row in f for a in row]},separators=(',',':'))+';\n')
