"""Reference low ponytail: anatomical scalp, side/back gathering and loose locks."""
from pathlib import Path
import json,math
import numpy as np
from scipy.spatial import cKDTree
from scipy.ndimage import gaussian_filter1d
from PIL import Image
ROOT=Path(__file__).resolve().parents[2];TEX=ROOT/'assets/usd/textures'
DATA=json.loads((ROOT/'assets/refined/girl_swim_source_v8.json').read_text());DATA['meshes']=[m for m in DATA['meshes'] if not m['name'].startswith('hair')]
skin=DATA['meshes'][0];body=np.array(skin['vertices'])[np.unique([v for face in skin['faces'] for v in face])];head=body[(body[:,1]>1.374)&(body[:,1]<1.566)]
# Avoid fitting the scalp over the outer ear or cheek rather than the skull.
head=head[~((abs(head[:,0])>.080)&(head[:,1]<1.445)&(head[:,2]>-.012))]
center=np.array([0,1.466,.054]);radial=head-center;length=np.linalg.norm(radial,axis=1);unit=radial/length[:,None];tree=cKDTree(unit)
rng=np.random.default_rng(101);guides=[]
def smooth(t):t=np.clip(t,0,1);return t*t*(3-2*t)
def boundary(phi):
 a=abs(phi);return float(np.interp(a,[0,.65,1.05,1.35,1.65,2.0,math.pi],[1.10,1.35,1.65,1.73,1.91,2.32,2.43]))
def scalp(theta,phi,lift=.007):
 theta,phi=np.broadcast_arrays(theta,phi);direction=np.stack([np.sin(theta)*np.sin(phi),np.cos(theta),np.sin(theta)*np.cos(phi)],-1)
 dist,ids=tree.query(direction.reshape(-1,3),k=64);weights=np.exp(-dist**2/.07);r=(length[ids]*weights).sum(1)/weights.sum(1)
 r+=np.broadcast_to(lift,theta.shape).reshape(-1)
 return (center+direction.reshape(-1,3)*r[:,None]).reshape(direction.shape)
def add(name,vs,faces,uv,material='hair',subdivision=0):
 DATA['meshes'].append({'name':name,'vertices':np.asarray(vs).tolist(),'faces':faces,'face_uv':faces,'uvs':np.asarray(uv).tolist(),'material':material,'subdivision':subdivision})
def guide(part,points,width):
 points=gaussian_filter1d(points,1.1,axis=0,mode='nearest');tangent=np.gradient(points,axis=0);tangent/=np.maximum(np.linalg.norm(tangent,axis=1)[:,None],1e-8)
 normal=points-center;normal/=np.maximum(np.linalg.norm(normal,axis=1)[:,None],1e-8)
 if part=='ponytail':normal=np.tile([0,0,-1.],(len(points),1))
 across=np.cross(normal,tangent);across/=np.maximum(np.linalg.norm(across,axis=1)[:,None],1e-8)
 for i in range(1,len(across)):
  if across[i]@across[i-1]<0:across[i]*=-1
 guides.append({'part':part,'points':points.tolist(),'normals':normal.tolist(),'across':across.tolist(),'width':width})
# Closed, smoothly varying scalp coverage; the side/rear edge reaches behind
# the ears and to the nape instead of ending on a horizontal half-cap line.
vs=[];uv=[];faces=[];rows=58;cols=144
for i in range(rows+1):
 for j in range(cols+1):
  phi=-math.pi+j/cols*math.tau;t=.002+i/rows*(boundary(phi)-.002)
  pad=.006+.004*np.sin(t)**2+.0012*np.sin(phi*11+t*2.8)*np.sin(t)
  vs.append(scalp(t,phi,pad));uv.append([j/cols,1-i/rows])
for i in range(rows):
 for j in range(cols):
  a=i*(cols+1)+j;b=a+cols+1;faces.append([a,a+1,b+1,b])
faces=[[f[0],f[3],f[2],f[1]] for f in faces]
add('hair_cap',vs,faces,uv,'haircap',1)
s=np.linspace(0,1,36);tie=np.array([0,1.429,-.067])
# Locks follow the head surface, then meet at the low occipital gathering.
for part,count in [('swept',360),('side_l',75),('side_r',75),('back',115)]:
 for i in range(count):
  if part=='swept':phi=-math.pi+math.tau*((i*.61803398875)%1);theta=.05+(boundary(phi)-.15)*np.sqrt((i*.754877666)%1)
  elif part.startswith('side'):phi=(1 if part.endswith('l') else -1)*rng.uniform(.92,1.93);theta=rng.uniform(.65,1.87)
  else:phi=(1 if i%2 else -1)*rng.uniform(2.0,math.pi);theta=rng.uniform(.72,2.27)
  side=1 if phi>=0 else -1;endphi=side*(math.pi-.045)
  phis=phi+(endphi-phi)*smooth(s);thetas=theta+(2.00-theta)*s
  pad=.010+.006*np.sin(s*math.pi)+.0013*np.sin(i*1.2+s*9)
  points=scalp(thetas,phis,pad)
  gather=smooth((s-.84)/.16)[:,None];end=tie+np.array([rng.uniform(-.012,.012),rng.uniform(-.008,.008),rng.uniform(-.006,.006)])
  points=points*(1-gather)+end*gather
  guide(part,points,.0043 if part!='back' else .0038)
# Natural side part and fringe, with individually staggered soft ends.
for i in range(130):
 u=(i+.5)/130;endphi=-1.08+2.16*u;theta_end=1.39+.12*abs(endphi)+.045*np.sin(u*24+.5)-.10*np.exp(-((u-.35)/.15)**2)
 phis=(-.40+.14*u)+(endphi+.40-.14*u)*smooth(s);thetas=.25+(theta_end-.25)*s
 points=scalp(thetas,phis,.012+.009*np.sin(s*math.pi));guide('fringe',points,.0030)
# Face-framing wisps end near the jaw/ear; behind-ear wisps cover the nape.
for side in [-1,1]:
 for i in range(20):
  phi=side*(.96+(i/20)*.22);thetas=1.04+(2.05+(.12*np.sin(i*1.7))-1.04)*s
  points=scalp(thetas,phi+.08*s,.009+.003*s);points[:,0]+=side*.005*s**3;points[:,2]-=.009*s**4
  guide('loose_l' if side>0 else 'loose_r',points,.0018)
 for i in range(12):
  phi=side*(2.07+i*.028);points=scalp(1.52+(2.40-1.52)*s,phi,.009);points[:,1]-=.008*s**3
  guide('nape',points,.0016)
# Compact hair-wrapped knot, rather than a string attached to a shaved rear.
vs=[];uv=[];faces=[];rows=20;cols=48
for i in range(rows+1):
 t=.002+(math.pi-.004)*i/rows
 for j in range(cols+1):
  p=j/cols*math.tau;r=1+.045*np.sin(p*7+t*5)
  vs.append(tie+np.array([.024*np.sin(t)*np.cos(p),.015*np.cos(t),.013*np.sin(t)*np.sin(p)])*r);uv.append([j/cols,i/rows])
for i in range(rows):
 for j in range(cols):
  a=i*(cols+1)+j;b=a+cols+1;faces.append([a,a+1,b+1,b])
add('hair_knot',vs,faces,uv,'haircap',1)
for i in range(32):
 a=i/32*math.tau;points=tie+np.stack([.024*np.cos(a+s*.8),.015*np.sin(a+s*.8),-.004+.011*np.sin(s*math.pi)],1);guide('knot',points,.0027)
def tail_center(t):return np.stack([.005*np.sin(t*math.pi),1.429-.107*t,-.067-.026*np.sin(t*math.pi*.75)],-1)
# A tapered volume under the fibre cards retains the silhouette from the back.
vs=[];uv=[];faces=[];rows=30;cols=44
for i in range(rows+1):
 t=i/rows;c=tail_center(np.array(t));radius=.021*(.60+.65*np.sin(t*math.pi))*(1-.90*t**5)
 for j in range(cols+1):
  a=j/cols*math.tau;noise=1+.10*np.sin(a*7+t*8)
  vs.append(c+np.array([math.cos(a)*radius*noise,0,math.sin(a)*radius*.64*noise]));uv.append([j/cols,1-t])
for i in range(rows):
 for j in range(cols):
  a=i*(cols+1)+j;b=a+cols+1;faces.append([a,b,b+1,a+1])
faces=[[f[0],f[3],f[2],f[1]] for f in faces]
add('hair_ponytail_core',vs,faces,uv,'haircap',1)
for i in range(170):
 a=i*2.399963;r=np.sqrt((i+.5)/170);spread=.022*(.65+.65*np.sin(s*math.pi))*(1-.86*s**5)
 points=tail_center(s)+np.stack([np.cos(a)*r*spread,np.sin(a)*r*spread*.22,np.sin(a)*r*spread*.66],1)
 points[:,0]+=.002*np.sin(s*8+i)*s;points[:,1]-=rng.uniform(0,.010)*s**4
 guide('ponytail',points,.0031)
for part in ['swept','side_l','side_r','back','fringe','loose_l','loose_r','nape','knot','ponytail']:
 vs=[];uv=[];faces=[]
 for g in (g for g in guides if g['part']==part):
  points=np.array(g['points']);across=np.array(g['across']);start=len(vs)
  for i,p in enumerate(points):
   t=i/(len(points)-1);w=g['width']*(1-.78*t**8)
   for j in [0,1]:vs.append(p+across[i]*(j-.5)*w);uv.append([j,1-t])
  for i in range(len(points)-1):a=start+i*2;faces.append([a,a+1,a+3,a+2])
 add('hair_knot_wrap' if part=='knot' else 'hair_'+part,vs,faces,uv)

# Raised, rounded locks give the collected hair a true 3D flow instead of
# relying on flat alpha cards over a smooth cap.
lock_vs=[];lock_uv=[];lock_faces=[]
for index,g in enumerate(guides):
 if g['part'] not in ['swept','side_l','side_r','back'] or index%7:continue
 points=np.array(g['points']);across=np.array(g['across']);normals=np.array(g['normals']);start=len(lock_vs);columns=6
 for i,p in enumerate(points):
  t=i/(len(points)-1);taper=.38+.62*np.sin(t*math.pi)**.6
  radius=(.0021+.0005*np.sin(index*2.3))*taper
  for j in range(columns+1):
   a=-math.pi/2+j/columns*math.pi
   lock_vs.append(p+across[i]*np.sin(a)*radius+normals[i]*np.cos(a)*radius*.23)
   lock_uv.append([j/columns,1-t])
 for i in range(len(points)-1):
  for j in range(columns):
   a=start+i*(columns+1)+j;b=a+columns+1;lock_faces.append([a,a+1,b+1,b])
add('hair_collected_locks',lock_vs,lock_faces,lock_uv,'haircap')
# A physical gathering sleeve bridges the occipital hair and the low tie.
vs=[];uv=[];faces=[];rows=12;cols=40
for i in range(rows+1):
 t=i/rows;c=np.array([0,1.431-.002*t,-.049-.018*t]);rx=.030*(1-t)+.019*t;ry=.018*(1-t)+.011*t
 for j in range(cols+1):
  a=j/cols*math.tau;vs.append(c+np.array([rx*np.cos(a),ry*np.sin(a),0]));uv.append([j/cols,1-t])
for i in range(rows):
 for j in range(cols):
  a=i*(cols+1)+j;b=a+cols+1;faces.append([a,a+1,b+1,b])
add('hair_gather',vs,faces,uv,'haircap',1)

# Fibre detail is embedded into the foundation material as well as the cards.
h,w=1024,1024;y,x=np.mgrid[0:h,0:w];u=x/w;v=y/h
strand=np.sin(math.tau*(u*150+.15*np.sin(v*5)+v*.30));locks=np.sin(math.tau*(u*21+.15*np.sin(v*4)))
color=np.stack([64+strand*5+locks*5,45+strand*3.8+locks*4,31+strand*2.8+locks*3],-1)
edge=smooth(np.clip((1-v)/.065,0,1));rgba=np.concatenate([np.clip(color,0,255),edge[...,None]*255],-1)
Image.fromarray(np.uint8(rgba)).save(TEX/'groom_foundation.png')
Image.fromarray(np.uint8(np.clip(128+strand*35+locks*10,0,255))).save(TEX/'groom_foundation_height.png')
# Low-alpha flyaway ribbons have real fibre gaps, not solid painted edges.
h,w=1024,256;u,v=np.meshgrid(np.linspace(0,1,w),np.linspace(0,1,h));alpha=np.zeros((h,w))
for k in range(18):
 c=(k+.5)/18+.003*np.sin(v[:,0]*7+k);line=np.exp(-((u-c[:,None])/.009)**2);line*=np.clip((.91+rng.uniform(0,.08)-v)/.065,0,1);alpha=np.maximum(alpha,line)
alpha*=np.clip(u*28,0,1)*np.clip((1-u)*28,0,1)
variation=np.sin(u*150)*4+rng.normal(0,.5,(h,w));rgb=np.stack([72+variation,50+variation*.7,33+variation*.5],-1)
Image.fromarray(np.uint8(np.concatenate([np.clip(rgb,0,255),alpha[...,None]*255],-1))).save(TEX/'groom_color.png')
DATA['hair_guides']=guides;DATA['hair_pivot']=[0,1.429,-.067]
(ROOT/'assets/refined/girl_hair_source_v10.json').write_text(json.dumps(DATA,separators=(',',':')))
report={'revision':10,'guide_count':len(guides),'parts':[m['name'] for m in DATA['meshes'] if m['name'].startswith('hair')],'pony_pivot':DATA['hair_pivot'],'source':'User front/side/back reference photographs','fitting':'Anatomical scalp surface fitted to existing unchanged character head; side, nape and back coverage added'}
(ROOT/'assets/refined/hair_v10_report.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
