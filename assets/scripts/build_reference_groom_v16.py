"""Centre-parted long groom with real temple/sideburn geometry, game Y-up.

The foundation and individual fibres share the same continuous curves. Native
UV fields provide fibre colour/coverage; reference photographs are not baked.
"""
from pathlib import Path
import json,math
import numpy as np
from scipy.spatial import cKDTree
from PIL import Image
ROOT=Path(__file__).resolve().parents[2];TEX=ROOT/'assets/usd/textures'
D=json.loads((ROOT/'assets/refined/girl_portrait_source_v16.json').read_text())
D['meshes']=[m for m in D['meshes'] if not m['name'].startswith('hair')]
skin=D['meshes'][0];body=np.array(skin['vertices'])[np.unique([i for f in skin['faces'] for i in f])]
head=body[(body[:,1]>1.385)&(body[:,1]<1.572)]
head=head[~((abs(head[:,0])>.078)&(head[:,1]<1.445)&(head[:,2]>-.010))]
centre=np.array([0,1.466,.050]);r=head-centre;length=np.linalg.norm(r,axis=1)
tree=cKDTree(r/length[:,None]);rng=np.random.default_rng(131);guides=[]
def smooth(x):
 x=np.clip(x,0,1);return x*x*(3-2*x)
def radial(d,pad=.005):
 d=np.asarray(d);shape=d.shape;dist,ids=tree.query(d.reshape(-1,3),k=64)
 w=np.exp(-dist**2/.055);radius=(length[ids]*w).sum(1)/w.sum(1)+np.broadcast_to(pad,shape[:-1]).reshape(-1)
 return (centre+d.reshape(-1,3)*radius[:,None]).reshape(shape)
def scalp(theta,phi,pad=.005):
 theta,phi=np.broadcast_arrays(theta,phi)
 d=np.stack([np.sin(theta)*np.sin(phi),np.cos(theta),np.sin(theta)*np.cos(phi)],-1)
 return radial(d,pad)
def parted(alpha,beta,side,pad=.005):
 # A longitudinal part and lateral strand direction replace the old polar fan.
 alpha,beta=np.broadcast_arrays(alpha,beta)
 d=np.stack([side*np.sin(beta),np.cos(beta)*np.cos(alpha),-np.cos(beta)*np.sin(alpha)],-1)
 p=radial(d,pad);p[...,0]+=side*.00015*(1-smooth(beta/.12))+(-.007+.003*np.sin(alpha*2.2))*np.cos(beta)**3
 return p
def add(name,vs,faces,uv,material='hair',subdivision=0):
 if not len(vs):return
 D['meshes'].append({'name':name,'vertices':np.asarray(vs).tolist(),'faces':faces,'face_uv':faces,'uvs':np.asarray(uv).tolist(),'material':material,'subdivision':subdivision})
def surface(name,fn,rows,cols,material='haircap',subdivision=1):
 vs=[];uv=[];faces=[]
 for i in range(rows+1):
  for j in range(cols+1):vs.append(fn(i/rows,j/cols));uv.append([j/cols,1-i/rows])
 for i in range(rows):
  for j in range(cols):a=i*(cols+1)+j;b=a+cols+1;faces.append([a,b,b+1,a+1])
 if name.endswith('_l'):faces=[list(reversed(f)) for f in faces]
 add(name,vs,faces,uv,material,subdivision)
def guide(part,p,width,orientation=None):
 tangent=np.gradient(p,axis=0);tangent/=np.maximum(np.linalg.norm(tangent,axis=1)[:,None],1e-9)
 normal=p-centre;normal/=np.maximum(np.linalg.norm(normal,axis=1)[:,None],1e-9)
 if orientation is not None:
  blend=smooth((1.45-p[:,1])/.11)[:,None];normal=normal*(1-blend)+np.array(orientation)*blend
 normal/=np.maximum(np.linalg.norm(normal,axis=1)[:,None],1e-9)
 across=np.cross(normal,tangent);across/=np.maximum(np.linalg.norm(across,axis=1)[:,None],1e-9)
 for i in range(1,len(across)):
  if across[i]@across[i-1]<0:across[i]*=-1
 guides.append({'part':part,'points':p,'across':across,'normals':normal,'width':width})
def bezier(a,b,c,d,t):
 t=np.asarray(t)[...,None];return(1-t)**3*a+3*(1-t)**2*t*b+3*(1-t)*t**2*c+t**3*d

# Two smooth halves have a narrow anatomical part. Their UVs run with the
# outward strand direction, so specular highlights follow the actual groom.
def hairline(beta):return -.98-.50*smooth(beta/1.43)
for side,label in [(-1,'l'),(1,'r')]:
 surface('hair_cap_'+label,lambda t,u:parted(hairline(.0007+1.4293*t)+(1.95-hairline(.0007+1.4293*t))*u,.0007+1.4293*t,side,.0048+.0015*np.sin(t*math.pi)),50,88,'hairlinecap')

def back_curtain(t,phi,layer=0,end=.49):
 t,phi=np.broadcast_arrays(t,phi);join=.29;start=.20;stop=1.82
 theta=start+(stop-start)*np.minimum(t/join,1);pad=.005+layer*.002
 crown=scalp(theta,phi,pad);anchor=scalp(np.full_like(t,stop),phi,pad)
 eps=.001;der=(scalp(stop+eps,phi,pad)-scalp(stop-eps,phi,pad))/(2*eps)*(stop-start)/join
 u=np.clip((t-join)/(1-join),0,1)
 endp=np.stack([(.114+layer*.002)*np.sin(phi),np.full_like(t,1.425-end),-.092+(.043+layer*.001)*np.cos(phi)],-1)
 end_tangent=np.stack([np.zeros_like(t),np.full_like(t,-end*.90),np.zeros_like(t)],-1)
 h00=2*u**3-3*u**2+1;h10=u**3-2*u**2+u;h01=-2*u**3+3*u**2;h11=u**3-u**2
 falling=h00[...,None]*anchor+h10[...,None]*der*(1-join)+h01[...,None]*endp+h11[...,None]*end_tangent
 result=np.where((t<=join)[...,None],crown,falling);result[...,2]-=.021*smooth((t-join)/.18)
 return result
def back(t,u):
 phi=1.62+(math.tau-3.24)*u;end=.49+.007*np.sin(phi*5+.4)+.005*np.sin(phi*17)
 return back_curtain(np.array(.260+.740*t),np.array(phi),0,end)
surface('hair_long_core',back,76,92)
s=np.linspace(0,1,52)
for i in range(650):
 phi=1.62+(math.tau-3.24)*((i*.61803398875)%1)
 end=.49+.007*np.sin(phi*5+.4)+.005*np.sin(phi*17)+rng.uniform(-.008,.008)
 p=back_curtain(.21+.79*s,np.full_like(s,phi),rng.uniform(.8,1.8),end)
 guide('long_back',p,.0024+rng.uniform(0,.0015),[0,0,-1])

# The left curtain sweeps directly from the part, over the temple, then falls
# naturally in front of the shoulder. It has a dark supporting surface.
def side_curtain(t,u,side,layer=0):
 t,u=np.broadcast_arrays(t,u);join=.34;alpha=-1.02+.76*u
 beta=.026+1.30*np.minimum(t/join,1)
 p=parted(alpha+.06*smooth(t/join),beta,side,.005+layer*.0016)
 anchor=parted(alpha+.06,np.full_like(t,1.326),side,.005+layer*.0016)
 q=np.clip((t-join)/(1-join),0,1)
 tip=np.stack([side*(.116+.027*u+layer*.001),.951+.032*u,.134+.025*u+layer*.001],-1)
 c1=anchor+np.array([side*.012,-.12,-.012]);c2=np.stack([tip[...,0],np.full_like(t,1.11),tip[...,2]],-1)
 falling=bezier(anchor,c1,c2,tip,q)
 return np.where((t<=join)[...,None],p,falling)
surface('hair_long_side_l',lambda t,u:side_curtain(np.array(.21+.79*t),np.array(u),-1,0),72,30)
for i in range(300):
 u=(i+.5)/300;p=side_curtain(.11+.89*s,np.full_like(s,u),-1,rng.uniform(.8,1.6))
 guide('long_side',p,.0016+rng.uniform(0,.0011),[0,0,1])

# Dense, coherent crown fibres reveal the parted direction, without a ring
# of independently jittered roots or triangles reflecting as white dots.
for side in [-1,1]:
 for i in range(330):
  alpha=-1.05+2.97*((i*.61803398875)%1);start=.02+rng.uniform(0,.20)
  beta=start+(1.415-start)*s
  p=parted(alpha+.06*smooth(s),beta,side,.0062+rng.uniform(0,.0007))
  guide('crown',p,.0010+rng.uniform(0,.0005))

# Temple roots and ear-front sideburns are real short 3D locks. They join the
# cap with a taper; their lower ends stop near the upper jaw, not at the neck.
def sideburn(t,u,side,layer=0):
 root=parted(np.array(-.69+.32*u),np.array(1.16),side,.006+layer*.0006)
 tip=np.array([side*(.073+.003*u),1.426+.008*u,.091-.012*u])
 c1=root+np.array([side*.004,-.026,.008]);c2=np.array([side*.084,1.447,.094-.014*u])
 p=bezier(root,c1,c2,tip,t);p[0]+=side*.0005*layer
 return p
for side,label in [(-1,'l'),(1,'r')]:
 surface('hair_sideburn_base_'+label,lambda t,u:sideburn(t,.5+(u-.5)*.48*(1-.95*t**4),side,0),30,18,'hair',0)
 for i in range(75):
  u=(i+.5)/75;p=np.array([sideburn(t,u,side,rng.uniform(.3,1.)) for t in s])
  p[:,1]-=rng.uniform(0,.008)*smooth(s)
  guide('sideburn_'+label,p,.00025+rng.uniform(0,.00025))
 # A few irregular ear-front flyaways soften the edge of the lock.
 for i in range(15):
  p=np.array([sideburn(t,rng.uniform(0,1),side,1.1) for t in s]);p[:,0]+=side*.0025*s**2
  guide('loose_'+label,p,.00020+rng.uniform(0,.00018))

# Irregular small forehead/temple baby hairs break the opaque hairline edge.
for side in [-1,1]:
 for i in range(110):
  beta=.025+1.31*((i*.61803398875)%1);edge=hairline(beta)
  alpha=edge+.070-(.075+rng.uniform(0,.030))*s
  p=parted(alpha,beta+.055*s**2,side,.0064)
  guide('hairline',p,.00024+rng.uniform(0,.00023))
# Continuous parted sweeps cover the forehead corners and meet the sideburns.
# Separate narrow fibre cards taper along curved temple paths.
for side,label in [(-1,'l'),(1,'r')]:
 for i in range(100):
  u=(i+.5)/100
  a=parted(np.array(-.85+.22*u),np.array(.055+.15*u),side,.0070)
  b=parted(np.array(-1.15+.06*u),np.array(.48+.15*u),side,.0076)
  c=np.array([side*(.070+.011*u),1.467+.015*u,.110+.004*(1-u)])
  d=np.array([side*(.068+.016*u),1.393+.031*u,.091+.010*(1-u)])
  p=bezier(a,b,c,d,s)
  direction=p-centre;distance=np.linalg.norm(direction,axis=1);direction/=distance[:,None]
  support=radial(direction,.0074);required=np.linalg.norm(support-centre,axis=1)
  p+=direction*(np.maximum(required-distance,0)*smooth((p[:,1]-1.425)/.030))[:,None]
  guide('temple_sweep_'+label,p,.00065+rng.uniform(0,.00045),[0,0,1])
parts=[('long_back','hair_long_layers'),('long_side','hair_long_side_layers'),('crown','hair_crown'),('hairline','hair_fringe'),('sideburn_l','hair_sideburn_l'),('sideburn_r','hair_sideburn_r'),('loose_l','hair_loose_l'),('loose_r','hair_loose_r'),('temple_sweep_l','hair_fringe_sweep_l'),('temple_sweep_r','hair_fringe_sweep_r')]
for part,name in parts:
 vs=[];uv=[];faces=[]
 for g in(g for g in guides if g['part']==part):
  start=len(vs)
  for i,p in enumerate(g['points']):
   t=i/(len(s)-1);width=g['width']*smooth(t/(.28 if part.startswith('temple_sweep') else .045))*(1-.96*smooth((t-.90)/.10))
   for j in [0,1]:vs.append(p+g['across'][i]*(j-.5)*width);uv.append([j,1-t])
  for i in range(len(s)-1):a=start+i*2;faces.append([a,a+1,a+3,a+2])
 add(name,vs,faces,uv)
for part,name in [('long_back','hair_fine_long'),('long_side','hair_long_fine_side'),('crown','hair_fine_crown'),('sideburn_l','hair_fine_sideburn_l'),('sideburn_r','hair_fine_sideburn_r'),('temple_sweep_l','hair_fine_fringe_sweep_l'),('temple_sweep_r','hair_fine_fringe_sweep_r')]:
 vs=[];uv=[];faces=[]
 for k,g in enumerate(g for g in guides if g['part']==part):
  if k%2:continue
  start=len(vs);offset=rng.uniform(-.00025,.00025)
  for i,p in enumerate(g['points']):
   t=i/(len(s)-1);p=p+g['across'][i]*offset+g['normals'][i]*.0003
   width=.000042*(1-.94*t**8)
   for j in [0,1]:vs.append(p+g['across'][i]*(2*j-1)*width);uv.append([j,1-t])
  for i in range(len(s)-1):a=start+i*2;faces.append([a,a+1,a+3,a+2])
 add(name,vs,faces,uv,'hairfine')

# Authored native fibre maps, with irregular strand spacing and soft tips.
h,w=2048,256;u,v=np.meshgrid(np.linspace(0,1,w),np.linspace(0,1,h));a=np.zeros((h,w))
for k in range(10):
 c=(k+.5+rng.uniform(-.22,.22))/10+.0025*np.sin(v[:,0]*4+k)
 strand=np.exp(-((u-c[:,None])/(.013+rng.uniform(0,.008)))**2)
 strand*=smooth(((1-v)-rng.uniform(.005,.040))/.055);a=np.maximum(a,strand)
a*=smooth(u*20)*smooth((1-u)*20)
fiber=np.sin(u*65)*.7+np.sin(v*7+u*15)*.4;rgb=np.stack([15+fiber,11+fiber*.7,13+fiber*.8],-1)
Image.fromarray(np.uint8(np.concatenate([rgb,a[...,None]*255],-1))).save(TEX/'groom_color.png')
h,w=2048,1024;y,x=np.mgrid[0:h,0:w];u=x/w;v=y/h
fiber=np.sin(math.tau*(u*160+.055*np.sin(v*3)));soft=np.sin(math.tau*(u*37+.018*np.sin(v*3)))
rgb=np.stack([14+fiber*.7+soft*.8,10+fiber*.5+soft*.6,12+fiber*.6+soft*.7],-1)
Image.fromarray(np.uint8(np.concatenate([rgb,np.full((h,w,1),255)],-1))).save(TEX/'groom_foundation.png')
edge=.004;coverage=smooth((u-edge)/.018)
Image.fromarray(np.uint8(np.concatenate([rgb,coverage[...,None]*255],-1))).save(TEX/'groom_scalp.png')
Image.fromarray(np.uint8(np.clip(128+fiber*5+soft*2,0,255))).save(TEX/'groom_foundation_height.png')
D['hair_guides']=[{**g,'points':g['points'].tolist(),'across':g['across'].tolist(),'normals':g['normals'].tolist()} for g in guides]
D['hair_style']='soft off-centre part with feathered natural hairline, temple locks and long straight curtains'
(ROOT/'assets/refined/girl_portrait_hair_v16.json').write_text(json.dumps(D,separators=(',',':')))
report={'revision':16,'style':D['hair_style'],'guide_count':len(guides),'temple_sideburn_guides':sum(g['part'].startswith('sideburn') for g in guides),'hair_meshes':[m['name'] for m in D['meshes'] if m['name'].startswith('hair')],'min_hair_y':min(min(p[1] for p in m['vertices']) for m in D['meshes'] if m['name'].startswith('hair')),'finite':all(np.isfinite(m['vertices']).all() for m in D['meshes'])}
(ROOT/'assets/refined/long_hair_v16_report.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
