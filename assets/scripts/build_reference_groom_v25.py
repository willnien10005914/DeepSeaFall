"""Layered long groom with feathered side-swept bangs, loose waves and curled tips, game Y-up.

The foundation and individual fibres share the same continuous curves. Native
UV fields provide fibre colour/coverage; reference photographs are not baked.
"""
from pathlib import Path
import json,math
import numpy as np
from scipy.spatial import cKDTree
from PIL import Image
ROOT=Path(__file__).resolve().parents[2];TEX=ROOT/'assets/usd/textures'
D=json.loads((ROOT/'assets/refined/girl_portrait_source_v25.json').read_text())
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
 if name.endswith('_l') or '_l_' in name:faces=[list(reversed(f)) for f in faces]
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

# Layered fall: inner lengths reach the waist, with two shorter outer
# layers. Each surface and all of its fibres evaluate the same 3D curve.
BACK_ENDS=(.480,.398,.318)
def back_curtain(t,phi,layer=0,end=.48):
 t,phi=np.broadcast_arrays(t,phi);join=.29;start=.20;stop=1.82
 theta=start+(stop-start)*np.minimum(t/join,1);pad=.005+layer*.0042
 crown=scalp(theta,phi,pad);anchor=scalp(np.full_like(t,stop),phi,pad)
 # A continuous scalp tangent avoids jumps from nearest-neighbour radius
 # samples when ear/cheek positions change during portrait sculpting.
 radius=np.linalg.norm(anchor-centre,axis=-1)
 tangent=np.stack([np.cos(stop)*np.sin(phi),np.full_like(t,-np.sin(stop)),np.cos(stop)*np.cos(phi)],-1)
 der=tangent*radius[...,None]*(stop-start)/join
 u=np.clip((t-join)/(1-join),0,1)
 endp=np.stack([(.119+layer*.004)*np.sin(phi),np.full_like(t,1.425-end),-.101+(.046+layer*.001)*np.cos(phi)],-1)
 end_tangent=np.stack([np.zeros_like(t),np.full_like(t,-end*.60),np.zeros_like(t)],-1)
 h00=2*u**3-3*u**2+1;h10=u**3-2*u**2+u;h01=-2*u**3+3*u**2;h11=u**3-u**2
 falling=h00[...,None]*anchor+h10[...,None]*der*(1-join)+h01[...,None]*endp+h11[...,None]*end_tangent
 result=np.where((t<=join)[...,None],crown,falling);result[...,2]-=.022*smooth((t-join)/.18)
 # Broad S wave transitions into a restrained 3D curl in the final third.
 # Displacement starts with a zero tangent, preserving a smooth root join.
 envelope=smooth((u-.17)/.56);curl=smooth((u-.59)/.41)
 phase=.28*np.sin(phi*2.7)+layer*.32
 broad=np.sin((u-.17)*math.tau*1.10+phase)-np.sin(phase)
 turn=(u-.59)/.41*math.tau*.83+phase
 curl_x=(np.cos(turn)-np.cos(phase))*.0105*curl
 curl_z=np.sin(turn)*.0125*curl
 radial_wave=(.0075+layer*.0013)*broad*envelope
 result[...,0]+=np.sin(phi)*radial_wave+np.cos(phi)*curl_x
 result[...,2]+=np.cos(phi)*radial_wave-np.sin(phi)*curl_x+curl_z
 result[...,1]+=.0055*(1-np.cos(turn))*curl
 return result

def back_end(phi,layer):
 return BACK_ENDS[layer]+.019*np.sin(phi*7.4+.4)+.009*np.sin(phi*17)
def back_lock(t,u,lock):
 # Separate gathered locks avoid an uninterrupted horizontal sheet hem.
 centre_u=(lock+.5)/12
 width=(1.045/12)*(1-.965*smooth((t-.69)/.31))
 phi=1.62+(math.tau-3.24)*(centre_u+(u-.5)*width)
 return back_curtain(np.array(.260+.740*t),np.array(phi),0,back_end(phi,0))
for lock in range(12):
 name='hair_long_core' if lock==0 else 'hair_long_core_lock_'+str(lock)
 surface(name,lambda t,u,lock=lock:back_lock(t,u,lock),70,8)
s=np.linspace(0,1,56)
for i in range(600):
 layer=i%3;phi=1.62+(math.tau-3.24)*((i*.61803398875)%1)
 end=back_end(phi,layer)+rng.uniform(-.006,.006)
 p=back_curtain(.21+.79*s,np.full_like(s,phi),layer+.40,end)
 guide('long_back',p,.0024+rng.uniform(0,.0015),[0,0,-1])

# Both front/side curtains are present, with a softly unequal part and
# different lengths. Lateral locks stay outside the cheek silhouette.
SIDE_ENDS=(.982,1.060,1.132)
def side_curtain(t,u,side,layer=0):
 t,u=np.broadcast_arrays(t,u);join=.34;alpha=-1.02+.76*u
 beta=.026+1.30*np.minimum(t/join,1)
 p=parted(alpha+.06*smooth(t/join),beta,side,.005+layer*.0025)
 anchor=parted(alpha+.06,np.full_like(t,1.326),side,.005+layer*.0025)
 q=np.clip((t-join)/(1-join),0,1)
 tip=np.stack([side*(.119+.029*u+layer*.002),np.full_like(t,SIDE_ENDS[min(int(layer),2)])+.038*u+.014*np.sin(u*16+side)+.009*(side>0),.133+.023*u+layer*.005],-1)
 c1=anchor+np.array([side*.017,-.12,-.010]);c2=np.stack([tip[...,0],tip[...,1]+.15,tip[...,2]],-1)
 falling=bezier(anchor,c1,c2,tip,q)
 envelope=smooth((q-.15)/.57);curl=smooth((q-.56)/.44)
 phase=u*.80+layer*.35+(side>0)*.25
 broad=(np.sin((q-.15)*math.tau*1.02+phase)-np.sin(phase))*envelope
 turn=(q-.56)/.44*math.tau*.77+phase
 falling[...,0]+=side*(.009*broad+.010*(np.cos(turn)-np.cos(phase))*curl)
 falling[...,2]+=.010*broad+.013*np.sin(turn)*curl
 falling[...,1]+=.005*(1-np.cos(turn))*curl
 return np.where((t<=join)[...,None],p,falling)
for side,label in [(-1,'l'),(1,'r')]:
 for lock in range(7):
  name='hair_long_side_'+label if lock==0 else 'hair_long_side_'+label+'_lock_'+str(lock)
  def lock_surface(t,u,side=side,lock=lock):
   centre_u=(lock+.5)/7;w=(1.035/7)*(1-.97*smooth((t-.66)/.34))
   return side_curtain(np.array(.21+.79*t),np.array(centre_u+(u-.5)*w),side,0)
  surface(name,lock_surface,68,7)
 for i in range(225):
  layer=i%3;u=((i*.61803398875)+.5/225)%1
  p=side_curtain(.11+.89*s,np.full_like(s,u),side,layer+.30)
  guide('long_side',p,.00165+rng.uniform(0,.0010),[0,0,1])

# Dense, coherent crown fibres reveal the parted direction, without a ring
# of independently jittered roots or triangles reflecting as white dots.
for side in [-1,1]:
 for i in range(290):
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
 surface('hair_sideburn_base_'+label,lambda t,u:sideburn(t,.5+(u-.5)*.30*(1-.96*t**4),side,0),30,18,'hair',0)
 for i in range(75):
  u=(i+.5)/75;p=np.array([sideburn(t,u,side,rng.uniform(.3,1.)) for t in s])
  p[:,1]-=rng.uniform(0,.008)*smooth(s)
  guide('sideburn_'+label,p,.00017+rng.uniform(0,.00015))
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
# Three staggered families of side-swept bangs curve from the part into the
# temple, rather than ending along one straight plane. The shortest layer
# stops above the brow; the other two turn outside the eye silhouette.
# Every root follows the scalp and has a long feathered width transition.
fringe_counts=(48,42,36)
fringe_tip_ranges=[]
for side,label in [(-1,'l'),(1,'r')]:
 for layer,count in enumerate(fringe_counts):
  for i in range(count):
   u=(i+.5)/count;offset=.5+.5*np.sin(u*8.1+layer*1.7+side*.6)
   a=parted(np.array(-.85+.19*u+.025*layer),np.array(.055+.13*u+.035*layer),side,.0070+layer*.0008)
   b=parted(np.array(-1.12+.07*u),np.array(.42+.12*u+.045*layer),side,.0077+layer*.0007)
   tip_y=(1.491,1.450,1.405)[layer]+(.014,.016,.023)[layer]*u+.003*np.sin(u*11+layer+side)
   tip_x=(.060,.075,.076)[layer]+(.010,.008,.008)[layer]*u
   tip_z=(.132,.111,.097)[layer]+.006*(1-u)
   c=np.array([side*(.054+.019*u+.006*layer),1.502-.018*layer+.008*u,.143-.011*layer+.002*offset])
   d=np.array([side*tip_x,tip_y,tip_z])
   p=bezier(a,b,c,d,s)
   # A small coherent bend releases the ends from the face without jitter.
   release=smooth((s-.55)/.45)
   p[:,0]+=side*.0018*np.sin(s*math.pi*1.3+u*.6)*release
   p[:,2]+=.0017*np.sin(s*math.pi*1.1+u*.4)*release
   direction=p-centre;distance=np.linalg.norm(direction,axis=1);direction/=distance[:,None]
   support=radial(direction,.0069+layer*.0005)
   # The brow-length portion follows the actual forehead, rather than
   # hovering as a flat sheet in front of it. Below the temple it releases
   # gradually into a free wisp with a separate curled end.
   follow=1-.84*smooth((1.451-p[:,1])/.058)
   p=p*(1-follow[:,None])+support*follow[:,None]
   guide('temple_sweep_'+label,p,.00048+rng.uniform(0,.00038),[0,0,1])
   fringe_tip_ranges.append(p[-1])
 # A few longer face-frame wisps bridge the bangs into the existing long
 # curtains. Unequal lengths and a restrained S bend avoid a blunt edge.
 for i in range(22):
  u=(i+.5)/22
  a=parted(np.array(-.64+.11*u),np.array(.81+.18*u),side,.0076)
  b=parted(np.array(-.61+.08*u),np.array(1.24),side,.0084)
  c=np.array([side*(.083+.006*u),1.444,.108+.004*u])
  d=np.array([side*(.076+.010*u),1.361+.057*u,.097+.006*np.sin(u*6)])
  p=bezier(a,b,c,d,s)
  p[:,0]+=side*.0032*np.sin(s*math.pi*1.6)*smooth((s-.28)/.72)
  p[:,2]+=.003*np.sin(s*math.pi*1.3)*smooth((s-.33)/.67)
  guide('temple_sweep_'+label,p,.00030+rng.uniform(0,.00020),[0,0,1])
  fringe_tip_ranges.append(p[-1])
parts=[('long_back','hair_long_layers'),('long_side','hair_long_side_layers'),('crown','hair_crown'),('hairline','hair_fringe'),('sideburn_l','hair_sideburn_l'),('sideburn_r','hair_sideburn_r'),('loose_l','hair_loose_l'),('loose_r','hair_loose_r'),('temple_sweep_l','hair_fringe_sweep_l'),('temple_sweep_r','hair_fringe_sweep_r')]
for part,name in parts:
 vs=[];uv=[];faces=[]
 for g in(g for g in guides if g['part']==part):
  start=len(vs)
  for i,p in enumerate(g['points']):
   t=i/(len(s)-1);width=g['width']*smooth(t/(.28 if part.startswith('temple_sweep') else .045))*(1-.96*smooth((t-.90)/.10))
   if part.startswith('temple_sweep'):width*=1-.60*smooth((t-.40)/.60)
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
D['hair_style']='soft off-centre part, three staggered side-swept bang lengths and loose face-frame wisps; full bilateral long hair in overlapping S-wave layers with softly curled tips'
(ROOT/'assets/refined/girl_portrait_hair_v25.json').write_text(json.dumps(D,separators=(',',':')))
hair_meshes=[m for m in D['meshes'] if m['name'].startswith('hair')]
long_guides=[g for g in guides if g['part'] in ('long_back','long_side')]
lengths=np.array([np.linalg.norm(np.diff(g['points'],axis=0),axis=1).sum() for g in long_guides])
report={'revision':24,'style':D['hair_style'],'guide_count':len(guides),'long_guide_count':len(long_guides),
 'side_swept_bang_guides':sum(g['part'].startswith('temple_sweep') for g in guides),
 'bang_layer_guides_per_side':list(fringe_counts),'long_face_frame_wisps_per_side':22,
 'fringe_tip_height_range':[float(np.min(np.array(fringe_tip_ranges)[:,1])),float(np.max(np.array(fringe_tip_ranges)[:,1]))],
 'temple_sideburn_guides':sum(g['part'].startswith('sideburn') for g in guides),
 'back_layer_tip_heights':[float(1.425-e) for e in BACK_ENDS],
 'side_layer_tip_heights':list(SIDE_ENDS),
 'bilateral_side_guides':{'left':int(sum(g['part']=='long_side' and g['points'][-1,0]<0 for g in guides)),'right':int(sum(g['part']=='long_side' and g['points'][-1,0]>0 for g in guides))},
 'long_guide_length_range':[float(lengths.min()),float(lengths.max())],
 'hair_meshes':[m['name'] for m in hair_meshes],
 'native_hair_vertex_count':sum(len(m['vertices']) for m in hair_meshes),
 'native_hair_face_count':sum(len(m['faces']) for m in hair_meshes),
 'min_hair_y':float(min(min(p[1] for p in m['vertices']) for m in hair_meshes)),
 'finite':all(np.isfinite(m['vertices']).all() for m in D['meshes']),
 'support_and_fibres_share_curve':True,
 'texture_uv':'native root-v1/tip-v0; glTF export flips V',
 'no_reference_photo_baked':True}
assert 300000<report['native_hair_vertex_count']<450000,report['native_hair_vertex_count']
assert report['finite']
assert report['bilateral_side_guides']['left']==225 and report['bilateral_side_guides']['right']==225
# Independent geometric measurements of authored lower-third curvature.
sags=[];turns=[]
for g in long_guides:
 q=np.asarray(g['points'])[int(len(g['points'])*.68):];a=q[0];v=q[-1]-a
 deviation=q-(a+np.linspace(0,1,len(q))[:,None]*v)
 sags.append(np.max(np.linalg.norm(deviation,axis=1)))
 tangents=np.diff(q,axis=0);tangents/=np.linalg.norm(tangents,axis=1)[:,None]
 turns.append(np.arccos(np.clip((tangents[1:]*tangents[:-1]).sum(1),-1,1)).sum())
report['measured_curve_qa']={'lower_third_curve_sag_median_mm':float(np.median(sags)*1000),
 'lower_third_curve_sag_range_mm':[float(min(sags)*1000),float(max(sags)*1000)],
 'lower_third_total_turn_median_degrees':float(np.median(turns)*180/np.pi),
 'separate_tapered_support_lock_count':sum(m['material']=='haircap' and 'hair_long' in m['name'] for m in hair_meshes),
 'no_bun_or_ponytail_meshes':not any('bun' in m['name'] or 'ponytail' in m['name'] for m in D['meshes'])}
(ROOT/'assets/refined/long_hair_v25_report.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
