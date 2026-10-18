"""Native reference groom: separate hairline/bangs, C1 straight curtain."""
from pathlib import Path
import json,math
import numpy as np
from scipy.spatial import cKDTree
from PIL import Image
ROOT=Path(__file__).resolve().parents[2];TEX=ROOT/'assets/usd/textures'
D=json.loads((ROOT/'assets/refined/girl_portrait_source_v12.json').read_text());D['meshes']=[m for m in D['meshes'] if not m['name'].startswith('hair')]
skin=D['meshes'][0];body=np.array(skin['vertices'])[np.unique([i for f in skin['faces'] for i in f])]
head=body[(body[:,1]>1.377)&(body[:,1]<1.570)];head=head[~((abs(head[:,0])>.078)&(head[:,1]<1.445)&(head[:,2]>-.010))]
centre=np.array([0,1.466,.050]);r=head-centre;length=np.linalg.norm(r,axis=1);tree=cKDTree(r/length[:,None]);rng=np.random.default_rng(121);guides=[]
def smooth(x):
 x=np.clip(x,0,1);return x*x*(3-2*x)
def boundary(phi):
 # Opaque foundation stops at anatomical hairline, well above the eyebrows.
 return np.interp(abs(phi),[0,.45,.82,1.15,1.45,1.85,math.pi],[.80,.84,1.10,1.41,1.77,1.90,1.93])
def scalp(theta,phi,pad=.005):
 theta,phi=np.broadcast_arrays(theta,phi);d=np.stack([np.sin(theta)*np.sin(phi),np.cos(theta),np.sin(theta)*np.cos(phi)],-1)
 dist,ids=tree.query(d.reshape(-1,3),k=64);w=np.exp(-dist**2/.055);radius=(length[ids]*w).sum(1)/w.sum(1)+np.broadcast_to(pad,theta.shape).reshape(-1)
 return (centre+d.reshape(-1,3)*radius[:,None]).reshape(d.shape)
def add(name,vs,faces,uv,material='hair',subdivision=0):
 D['meshes'].append({'name':name,'vertices':np.asarray(vs).tolist(),'faces':faces,'face_uv':faces,'uvs':np.asarray(uv).tolist(),'material':material,'subdivision':subdivision})
def guide(part,p,width):
 tangent=np.gradient(p,axis=0);tangent/=np.maximum(np.linalg.norm(tangent,axis=1)[:,None],1e-9);normal=p-centre
 if part=='long_layers':
  target=np.array([0,0,1. if p[-1,2]>.05 else -1.]);blend=smooth((1.44-p[:,1])/.10)[:,None];normal=normal/np.maximum(np.linalg.norm(normal,axis=1)[:,None],1e-9)*(1-blend)+target*blend
 normal/=np.maximum(np.linalg.norm(normal,axis=1)[:,None],1e-9);across=np.cross(normal,tangent);across/=np.maximum(np.linalg.norm(across,axis=1)[:,None],1e-9)
 for i in range(1,len(across)):
  if across[i]@across[i-1]<0:across[i]*=-1
 guides.append({'part':part,'points':p,'across':across,'normals':normal,'width':width})
def grid(name,vs,uv,rows,cols):
 faces=[]
 for i in range(rows):
  for j in range(cols):a=i*(cols+1)+j;b=a+cols+1;faces.append([a,b,b+1,a+1])
 add(name,vs,faces,uv,'haircap',1)
vs=[];uv=[];rows=52;cols=128
for i in range(rows+1):
 for j in range(cols+1):
  phi=-math.pi+j/cols*math.tau;theta=.005+i/rows*(boundary(phi)-.005)
  vs.append(scalp(theta,phi,.008+.002*np.sin(theta)**2));uv.append([j/cols,1-i/rows])
grid('hair_cap',vs,uv,rows,cols)
def curtain(t,phi,layer=0,end=.49,starttheta=.20):
 # Shared crown/curtain value and derivative: no independent nape plate.
 t,phi=np.broadcast_arrays(t,phi);join=.29;stop=1.81;a=np.minimum(t/join,1);theta=starttheta+(stop-starttheta)*a
 crown=scalp(theta,phi,.006+layer*.0028);anchor=scalp(np.full_like(t,stop),phi,.006+layer*.0028)
 eps=.001;der=(scalp(stop+eps,phi,.006+layer*.0028)-scalp(stop-eps,phi,.006+layer*.0028))/(2*eps)*(stop-starttheta)/join
 u=np.clip((t-join)/(1-join),0,1)
 endp=np.stack([(.114+layer*.002)*np.sin(phi),np.full_like(t,1.425-end),-.092+(.043+layer*.001)*np.cos(phi)],-1)
 end_tangent=np.stack([np.zeros_like(t),np.full_like(t,-end*.90),np.zeros_like(t)],-1)
 h00=2*u**3-3*u**2+1;h10=u**3-2*u**2+u;h01=-2*u**3+3*u**2;h11=u**3-u**2
 falling=h00[...,None]*anchor+h10[...,None]*der*(1-join)+h01[...,None]*endp+h11[...,None]*end_tangent
 result=np.where((t<=join)[...,None],crown,falling)
 result[...,2]-=.019*smooth((t-join)/.18)
 return result
vs=[];uv=[];rows=84;cols=112
for i in range(rows+1):
 t=.252+.748*i/rows
 for j in range(cols+1):
  phi=1.65+(math.tau-2*1.65)*j/cols;end=.49+.020*np.sin(phi*5+.4)+.007*np.sin(phi*17)
  vs.append(curtain(np.array(t),np.array(phi),0,end));uv.append([j/cols,1-t])
grid('hair_long_core',vs,uv,rows,cols)
s=np.linspace(0,1,64)
for i in range(680):
 phi=1.65+(math.tau-2*1.65)*((i*.61803398875)%1);end=.49+.020*np.sin(phi*5+.4)+.007*np.sin(phi*17)+rng.uniform(-.008,.008);layer=rng.uniform(.7,2.0)
 ss=.17+.83*s;p=curtain(ss,np.full_like(s,phi),layer,end,.20);phase=rng.uniform(0,math.tau);p[:,0]+=.0006*np.sin(s*4+phase)*s**2
 guide('long_layers',p,.0030+rng.uniform(0,.0020))
for i in range(190):
 phi=-math.pi+math.tau*((i*.754877666)%1);end=boundary(phi)-.035
 start=.12+rng.uniform(0,.38);p=scalp(start+(end-start)*s,phi+.04*np.sin(s*math.pi),.010);guide('crown',p,.0015+rng.uniform(0,.0010))
for clump,c in enumerate(np.linspace(-1.035,1.035,10)):
 for j in range(70):
  phi=c+rng.uniform(-.112,.112);rootphi=-.16+c*.36+rng.uniform(-.070,.070)
  endtheta=1.66+.024*np.sin(clump*1.4)+rng.uniform(-.009,.009)
  p=scalp(.54+(endtheta-.54)*s,rootphi+(phi-rootphi)*smooth(s)+.040*np.sin(s*math.pi)**2,.012+.002*np.sin(s*math.pi))
  end=np.array([.077*np.sin(phi)/np.sin(1.08),1.464+.004*abs(phi)+.0017*np.sin(clump*2.4)+rng.uniform(-.0007,.0007),.148-.035*(abs(phi)/1.08)**2])
  p+=(end-p[-1])[None,:]*smooth((s-.58)/.42)[:,None]
  guide('fringe',p,.00090+rng.uniform(0,.00050))
for i in range(14):
 phi=-1.17+rng.uniform(-.11,.08);p=scalp(.80+1.03*np.minimum(s/.28,1),phi,.009)
 anchor=p[np.searchsorted(s,.28)].copy();u=np.clip((s-.28)/.72,0,1)
 tip=np.array([-.116+rng.uniform(-.016,.016),(1.16 if i>1 else 1.01)+rng.uniform(-.025,.025),.135+rng.uniform(-.006,.008)])
 c1=anchor+np.array([-.015,-.090,-.009]);c2=np.array([tip[0],1.13,.145])
 q=(1-u[:,None])**3*anchor+3*(1-u[:,None])**2*u[:,None]*c1+3*(1-u[:,None])*u[:,None]**2*c2+u[:,None]**3*tip
 p=np.where((s<.28)[:,None],p,q);guide('long_layers',p,.00035+rng.uniform(0,.00025))
for part,name in [('long_layers','hair_long_layers'),('crown','hair_crown'),('fringe','hair_fringe'),('loose_l','hair_loose_l'),('loose_r','hair_loose_r')]:
 vs=[];uv=[];faces=[]
 for g in (g for g in guides if g['part']==part):
  start=len(vs)
  for i,q in enumerate(g['points']):
   t=i/(len(s)-1);width=g['width']*smooth(t/.055)*(1-.97*smooth((t-(.82 if part=='fringe' else .94))/(.18 if part=='fringe' else .06)))
   for j in [0,1]:vs.append(q+g['across'][i]*(j-.5)*width);uv.append([j,1-t])
  for i in range(len(s)-1):a=start+i*2;faces.append([a,a+1,a+3,a+2])
 if vs and part!='crown':add(name,vs,faces,uv)
for part,name in [('long_layers','hair_fine_long'),('fringe','hair_fine_fringe')]:
 vs=[];uv=[];faces=[]
 for index,g in enumerate(g for g in guides if g['part']==part):
  if index%2:continue
  start=len(vs);offset=rng.uniform(-.0007,.0007);phase=rng.uniform(0,math.tau)
  for i,p in enumerate(g['points']):
   t=i/(len(s)-1);q=p+g['across'][i]*(offset+.00008*np.sin(t*5+phase))+g['normals'][i]*.0003;radius=.000045*(1-.94*t**8)
   for j in [0,1]:vs.append(q+g['across'][i]*(2*j-1)*radius);uv.append([j,1-t])
  for i in range(len(s)-1):a=start+i*2;faces.append([a,a+1,a+3,a+2])
 add(name,vs,faces,uv,'hairfine')
h,w=2048,256;u,v=np.meshgrid(np.linspace(0,1,w),np.linspace(0,1,h));alpha=np.zeros((h,w))
for k in range(12):
 c=(k+.4+rng.uniform(-.2,.2))/12+.004*np.sin((1-v[:,0])*4+k);line=np.exp(-((u-c[:,None])/(.012+rng.uniform(0,.008)))**2);tip=.005+rng.uniform(0,.035);line*=smooth(((1-v)-tip)/.05);alpha=np.maximum(alpha,line)
alpha*=smooth(u*18)*smooth((1-u)*18);var=np.sin(u*46)*.8+np.sin(v*8+u*25)*.5;rgb=np.stack([13+var,10+var*.7,12+var*.8],-1)
Image.fromarray(np.uint8(np.concatenate([rgb,alpha[...,None]*255],-1))).save(TEX/'groom_color.png')
h,w=2048,1024;y,x=np.mgrid[0:h,0:w];u=x/w;v=y/h;fiber=np.sin(math.tau*(u*150+.025*np.sin(v*3)));soft=np.sin(math.tau*(u*38+.035*np.sin(v*3)))
rgb=np.stack([12+fiber*.6+soft*.9,9+fiber*.5+soft*.7,11+fiber*.55+soft*.8],-1)
Image.fromarray(np.uint8(np.concatenate([rgb,np.full((h,w,1),255)],-1))).save(TEX/'groom_foundation.png');Image.fromarray(np.full((h,w),128,dtype=np.uint8)).save(TEX/'groom_foundation_height.png')
D['hair_guides']=[{**g,'points':g['points'].tolist(),'across':g['across'].tolist(),'normals':g['normals'].tolist()} for g in guides]
D['hair_style']='near-black continuous long straight hair with light separated side-swept bangs';D['hair_flow_root']=1.43
(ROOT/'assets/refined/girl_portrait_hair_v12.json').write_text(json.dumps(D,separators=(',',':')))
report={'revision':12,'style':D['hair_style'],'guide_count':len(guides),'smooth_fine_ribbons':True,'opaque_brow_cap_removed':True,'curtain_join':'C1 Hermite','hair_meshes':[m['name'] for m in D['meshes'] if m['name'].startswith('hair')],'min_hair_y':min(min(p[1] for p in m['vertices']) for m in D['meshes'] if m['name'].startswith('hair'))}
(ROOT/'assets/refined/long_hair_v12_report.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
