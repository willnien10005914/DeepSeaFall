from pathlib import Path
import numpy as np,json
r=Path(__file__).resolve().parents[2];d=json.loads((r/'assets/refined/girl_portrait_source_v28.json').read_text());m=next(v for v in d['meshes'] if v['name']=='dress_skirt');old=np.array(m['vertices']).reshape(101,121,3);rows,cols=64,80;vs=[];uv=[];faces=[]
for i in range(rows+1):
 a=i/rows*100;ia=min(int(a),99);fa=a-ia
 for j in range(cols+1):
  b=j/cols*120;ib=min(int(b),119);fb=b-ib
  p=(old[ia,ib]*(1-fb)+old[ia,ib+1]*fb)*(1-fa)+(old[ia+1,ib]*(1-fb)+old[ia+1,ib+1]*fb)*fa
  vs.append(p.tolist());uv.append([j/cols,i/rows])
for i in range(rows):
 for j in range(cols):a=i*(cols+1)+j;b=a+cols+1;faces.append([a,a+1,b+1,b])
m.update(vertices=vs,uvs=uv,faces=faces,face_uv=faces,subdivision=0)
for strap in [v for v in d['meshes'] if v['name'].startswith('dress_strap')]:
 pts=np.array(strap['vertices']).reshape(35,7,3);side=np.sign(pts[:,:,0].mean());pts[:,:,0]=side*.108+(pts[:,:,0]-side*.116)*.75
 for i in range(35):
  t=i/34
  pts[i,:,1]=pts[0,:,1]*(1-t)+pts[-1,:,1]*t+.085*np.sin(np.pi*t)
  pts[i,:,2]=pts[0,:,2]*(1-t)+pts[-1,:,2]*t
 strap['vertices']=pts.reshape(-1,3).tolist();strap['subdivision']=0
(r/'assets/refined/girl_portrait_source_v29.json').write_text(json.dumps(d,separators=(',',':')));print('Contact garment vertices',len(vs))
