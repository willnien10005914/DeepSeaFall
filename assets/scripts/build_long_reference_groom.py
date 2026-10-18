"""Layered straight long hair with fine fibres and airy, split bangs."""
from pathlib import Path
import json,math
import numpy as np
from scipy.spatial import cKDTree
from scipy.ndimage import gaussian_filter1d
from PIL import Image
ROOT=Path(__file__).resolve().parents[2];TEX=ROOT/'assets/usd/textures';D=json.loads((ROOT/'assets/refined/girl_portrait_source_v11.json').read_text());D['meshes']=[m for m in D['meshes'] if not m['name'].startswith('hair')]
skin=D['meshes'][0];body=np.array(skin['vertices'])[np.unique([i for f in skin['faces'] for i in f])];head=body[(body[:,1]>1.377)&(body[:,1]<1.570)]
head=head[~((abs(head[:,0])>.078)&(head[:,1]<1.445)&(head[:,2]>-.010))];centre=np.array([0,1.466,.050]);r=head-centre;length=np.linalg.norm(r,axis=1);tree=cKDTree(r/length[:,None]);rng=np.random.default_rng(111);guides=[]
def smooth(x):x=np.clip(x,0,1);return x*x*(3-2*x)
def boundary(phi):return np.interp(abs(phi),[0,.62,1.08,1.36,1.66,2.02,math.pi],[1.46,1.49,1.65,1.73,1.90,2.30,2.39])
def scalp(theta,phi,pad=.008):
 theta,phi=np.broadcast_arrays(theta,phi);d=np.stack([np.sin(theta)*np.sin(phi),np.cos(theta),np.sin(theta)*np.cos(phi)],-1);dist,ids=tree.query(d.reshape(-1,3),k=64);w=np.exp(-dist**2/.07);radius=(length[ids]*w).sum(1)/w.sum(1)+np.broadcast_to(pad,theta.shape).reshape(-1)
 return(centre+d.reshape(-1,3)*radius[:,None]).reshape(d.shape)
def add(name,vs,faces,uv,material='hair',subdivision=0):D['meshes'].append({'name':name,'vertices':np.asarray(vs).tolist(),'faces':faces,'face_uv':faces,'uvs':np.asarray(uv).tolist(),'material':material,'subdivision':subdivision})
def guide(part,p,width):
 p=gaussian_filter1d(p,.7,axis=0,mode='nearest');tangent=np.gradient(p,axis=0);tangent/=np.maximum(np.linalg.norm(tangent,axis=1)[:,None],1e-8);normal=p-centre
 if part.startswith('long'):normal=np.tile([0,0,-1.],(len(p),1))
 normal/=np.maximum(np.linalg.norm(normal,axis=1)[:,None],1e-8);across=np.cross(normal,tangent);across/=np.maximum(np.linalg.norm(across,axis=1)[:,None],1e-8)
 for i in range(1,len(across)):
  if across[i]@across[i-1]<0:across[i]*=-1
 guides.append({'part':part,'points':p,'across':across,'normals':normal,'width':width})
# Fine scalp volume has no corrugated rope-like raised locks.
vs=[];uv=[];faces=[];rows=54;cols=140
for i in range(rows+1):
 for j in range(cols+1):
  phi=-math.pi+j/cols*math.tau;theta=.002+i/rows*(boundary(phi)-.002)
  vs.append(scalp(theta,phi,.014+.002*np.sin(theta)**2));uv.append([j/cols,1-i/rows])
for i in range(rows):
 for j in range(cols):a=i*(cols+1)+j;b=a+cols+1;faces.append([a,b,b+1,a+1])
add('hair_cap',vs,faces,uv,'haircap',1)
# Underfill is a layered curtain behind the neck and shoulders. Individual
# fibre cards and strands provide the visible surface over this volume.
def drape(t,phi,layer=0,length=.49):
 y=1.43-length*t;rx=.083+.036*smooth(t/.55)+layer*.004;rz=.098*(1-smooth(t/.22))+.032*smooth(t/.22)
 zcentre=.035-.155*smooth(t/.30)-layer*.002
 x=rx*np.sin(phi)*(1-.10*t**6);z=zcentre+rz*np.cos(phi)
 return np.stack([x,y,z],-1)
vs=[];uv=[];faces=[];rows=56;cols=88
for i in range(rows+1):
 t=i/rows
 for j in range(cols+1):
  phi=1.19+(math.tau-2*1.19)*j/cols;end=.49+.025*np.sin(phi*5+.4)+.009*np.sin(phi*17)
  vs.append(drape(np.array(t),np.array(phi),0,end));uv.append([j/cols,1-t])
for i in range(rows):
 for j in range(cols):a=i*(cols+1)+j;b=a+cols+1;faces.append([a,a+1,b+1,b])
add('hair_long_core',vs,faces,uv,'haircap',1)
s=np.linspace(0,1,44)
# Every long card starts on the crown, flows around the side/back, then falls.
for i in range(930):
 phi=1.18+(math.tau-2*1.18)*((i*.61803398875)%1);wrapped=phi if phi<=math.pi else phi-math.tau
 starttheta=.08+rng.random()*1.7;join=.30+rng.random()*.08
 head_t=np.minimum(s/join,1);theta=starttheta+(1.95-starttheta)*smooth(head_t)
 crown=scalp(theta,wrapped+.07*np.sin(head_t*math.pi),.016+rng.random()*.004)
 tail_t=np.clip((s-join)/(1-join),0,1);end=.45+rng.uniform(-.02,.085);layer=rng.uniform(0,1.8)
 falling=drape(tail_t,np.full_like(s,phi),layer,end)
 blend=smooth(np.clip((s-join+.08)/.16,0,1))[:,None];p=crown*(1-blend)+falling*blend
 p[:,0]+=.0017*np.sin(s*6+i)*s**2;p[:,2]+=.0020*np.sin(s*7+i*.4)*s
 guide('long_layers',p,.0030+rng.uniform(0,.0030))
# Dense crown strands sweep along a soft centre/side split instead of a bun.
for i in range(360):
 phi=-math.pi+math.tau*((i*.754877666)%1);theta=.03+(boundary(phi)-.08)*rng.random();end=boundary(phi)-.02
 p=scalp(theta+(end-theta)*s,phi+.075*np.sin(s*math.pi),.016+.002*np.sin(s*math.pi));guide('crown',p,.0018)
# Light curtain bangs: a few fine strands reach brow level, with parted gaps.
for i in range(250):
 u=(i+.5)/250;phi=-1.11+2.22*u;startphi=-.22+.44*u
 endtheta=1.60+.038*np.sin(u*29)-.045*abs(phi)+.012*np.sin(u*53)
 p=scalp(.19+(endtheta-.19)*s,startphi+(phi-startphi)*smooth(s),.016+.004*np.sin(s*math.pi))
 guide('fringe',p,.0011+rng.uniform(0,.0013))
for side in [-1,1]:
 for i in range(34):
  phi=side*(1.02+i*.006);p=scalp(1.0+(2.05-1.0)*s,phi+.035*s,.010);p[:,0]+=side*.004*s**3;guide('loose_l' if side>0 else 'loose_r',p,.0012)
# Fine direct strands have geometric silhouettes, reducing reliance on painted
# strip patterns. Width is below 0.25 mm and tapers at the ends.
for part,name in [('long_layers','hair_long_layers'),('crown','hair_crown'),('fringe','hair_fringe'),('loose_l','hair_loose_l'),('loose_r','hair_loose_r')]:
 vs=[];uv=[];faces=[]
 for g in(g for g in guides if g['part']==part):
  start=len(vs);p=g['points'];across=g['across']
  for i,q in enumerate(p):
   t=i/(len(p)-1);width=g['width']*(1-.87*t**10)
   for j in [0,1]:vs.append(q+across[i]*(j-.5)*width);uv.append([j,1-t])
  for i in range(len(p)-1):a=start+i*2;faces.append([a,a+1,a+3,a+2])
 add(name,vs,faces,uv)
for part,name in [('long_layers','hair_fine_long'),('crown','hair_fine_crown'),('fringe','hair_fine_fringe')]:
 vs=[];uv=[];faces=[]
 relevant=[g for g in guides if g['part']==part]
 for index,g in enumerate(relevant):
  if index%2:continue
  p=g['points'][::2];across=g['across'][::2];normals=g['normals'][::2];start=len(vs);phase=rng.uniform(0,math.tau)
  for i,q in enumerate(p):
   t=i/(len(p)-1);radius=.000065*(1-.82*t**6)
   q=q+across[i]*rng.uniform(-.0006,.0006)+normals[i]*(.0008+.0005*np.sin(t*7+phase))
   for j in range(3):
    a=j/3*math.tau;vs.append(q+across[i]*math.cos(a)*radius+normals[i]*math.sin(a)*radius);uv.append([j/3,1-t])
  for i in range(len(p)-1):
   for j in range(3):a=start+i*3+j;b=start+i*3+(j+1)%3;faces.append([a,b,b+3,a+3])
 add(name,vs,faces,uv,'hairfine')
# Deterministic multi-resolution fibre atlases retain the hair direction and
# transparent ends. These are authored texture fields, not facial photo maps.
h,w=2048,512;u,v=np.meshgrid(np.linspace(0,1,w),np.linspace(0,1,h));alpha=np.zeros((h,w))
for k in range(28):
 c=(k+.5)/28+.002*np.sin(v[:,0]*5+k);line=np.exp(-((u-c[:,None])/.0080)**2);end=.86+rng.uniform(0,.13);line*=smooth(np.clip((end-v)/.06,0,1));alpha=np.maximum(alpha,line)
alpha*=smooth(np.clip(u*30,0,1))*smooth(np.clip((1-u)*30,0,1));var=np.sin(u*270)*2+np.sin(v*12+u*200)*1.2
rgb=np.stack([31+var,26+var*.86,29+var*.90],-1);Image.fromarray(np.uint8(np.concatenate([np.clip(rgb,0,255),alpha[...,None]*255],-1))).save(TEX/'groom_color.png')
h,w=2048,1024;y,x=np.mgrid[0:h,0:w];u=x/w;v=y/h;fiber=np.sin(math.tau*(u*260+.12*np.sin(v*5)));soft=np.sin(math.tau*(u*54+.06*np.sin(v*3)));edge=smooth(np.clip((1-v)/.065,0,1));rgb=np.stack([27+fiber*2+soft*2,23+fiber*1.7+soft*1.8,26+fiber*1.9+soft*2],-1)
Image.fromarray(np.uint8(np.concatenate([np.clip(rgb,0,255),edge[...,None]*255],-1))).save(TEX/'groom_foundation.png');Image.fromarray(np.uint8(np.clip(128+fiber*18+soft*8,0,255))).save(TEX/'groom_foundation_height.png')
D['hair_guides']=[{**g,'points':g['points'].tolist(),'across':g['across'].tolist(),'normals':g['normals'].tolist()} for g in guides];D['hair_style']='deep brown-black layered long straight hair with airy curtain bangs';D['hair_flow_root']=1.43
(ROOT/'assets/refined/girl_portrait_hair_v11.json').write_text(json.dumps(D,separators=(',',':')))
report={'revision':11,'style':D['hair_style'],'guide_count':len(guides),'fine_geometric_strands':sum(m['name'].startswith('hair_fine')*len(m['vertices'])//66 for m in D['meshes']),'hair_meshes':[m['name'] for m in D['meshes'] if m['name'].startswith('hair')],'min_hair_y':min(min(p[1] for p in m['vertices']) for m in D['meshes'] if m['name'].startswith('hair')),'maximum_head_y':float(head[:,1].max())}
(ROOT/'assets/refined/long_hair_v11_report.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
