"""Reference fitted quad meshes and source UVs for Blender character refinement.

Uses the distributed CC0 hm08 topology, morphs and explicitly CC0 system assets.
Keeps source UV seams and authored hair/eye/eyelash geometry intact.
"""
from pathlib import Path
import json, shutil, math
import numpy as np
from scipy.interpolate import PchipInterpolator
from PIL import Image
from continuous_groom import make_groom

ROOT=Path(__file__).resolve().parents[2]
SOURCE=ROOT/'assets/sources/makehuman'
SYSTEM=ROOT/'assets/sources/makehuman-system'
OUT=ROOT/'assets/refined';OUT.mkdir(exist_ok=True)
TEX=ROOT/'assets/usd/textures';TEX.mkdir(exist_ok=True)

MORPHS={
 'caucasian-female-young':.86,'caucasian-female-child':.14,
 'universal-female-young-minmuscle-averageweight':.86,
 'universal-female-child-averagemuscle-averageweight':.14,
 'head-age-decr':.08,'head-oval':.12,
 'chin-width-decr':.18,'chin-height-decr':.14,'chin-prognathism-decr':.10,
 'l-cheek-volume-incr':.10,'r-cheek-volume-incr':.10,
 'nose-scale-horiz-decr':.16,'nose-scale-vert-decr':.09,'nose-point-up':.035,
 'mouth-scale-horiz-decr':.06,'mouth-lowerlip-volume-incr':.07,
 'mouth-upperlip-volume-incr':.07,'mouth-angles-up':.04,
 'l-eye-height2-incr':.08,'r-eye-height2-incr':.08,
 'l-eye-bag-decr':.18,'r-eye-bag-decr':.18,
}

def obj(path):
 vs=[];uv=[];groups={};g='body'
 for line in path.read_text().splitlines():
  a=line.split()
  if not a:continue
  if a[0]=='v':vs.append(list(map(float,a[1:4])))
  elif a[0]=='vt':uv.append(list(map(float,a[1:3])))
  elif a[0]=='g':g=a[1]
  elif a[0]=='f':
   f=[x.split('/') for x in a[1:]]
   groups.setdefault(g,[]).append(([int(x[0])-1 for x in f],[int(x[1])-1 if len(x)>1 and x[1] else 0 for x in f]))
 return np.array(vs),np.array(uv),groups

base,uv,groups=obj(SOURCE/'base.obj')
raw=base.copy()
for name,weight in MORPHS.items():
 for line in (SOURCE/(name+'.target')).read_text().splitlines():
  a=line.split()
  if len(a)==4 and not line.startswith('#'):raw[int(a[0])]+=np.array(list(map(float,a[1:])))*weight
body_indices=np.unique([i for face,_ in groups['body'] for i in face])
bottom=float(raw[body_indices,1].min());scale=1.56/(raw[body_indices,1].max()-bottom)

def transform(points):
 p=np.array(points,dtype=float).copy();p[:,1]-=bottom;p*=scale
 # Match the reference's narrow shoulders and slender limbs while retaining anatomy.
 head=np.clip((p[:,1]-1.33)/.045,0,1)
 p[:,0]*=.93+.07*head
 # Bring the neutral leg stance under the hips, matching the reference's parallel legs.
 leg=np.clip((.85-p[:,1])/.76,0,1)
 p[:,0]-=np.sign(p[:,0])*.082*leg
 return p

body_vertices=transform(raw)
skin_points=body_vertices[body_indices]
meshes=[]
def add(name,vertices,faces,faceuv,uvs,material,subdivision=0):
 meshes.append({'name':name,'vertices':np.asarray(vertices).tolist(),'faces':faces,'face_uv':faceuv,'uvs':np.asarray(uvs).tolist(),'material':material,'subdivision':subdivision})

# A continuous garment closes over hidden body faces; exposed shoulders stay visible.
visible=[]
for f,t in groups['body']:
 c=body_vertices[f].mean(0);angle=math.atan2(c[2]-.035,c[0])
 neckline=1.218-.077*abs(math.cos(angle))**12
 is_arm=c[1]>.90 and abs(c[0])>(.140+.060*np.clip((1.20-c[1])/.25,0,1))
 covered=.515<c[1]<neckline-.025 and not is_arm
 covered=covered or (.515<c[1]<neckline-.005 and abs(c[0])<.135 and c[2]>.04)
 if not covered:visible.append((f,t))
add('skin_body',body_vertices,[f for f,t in visible],[t for f,t in visible],uv,'skin',1)

def proxy(relative,name,material,select=None,edit=None):
 folder=SYSTEM/relative;clo=next(folder.glob('*.mhclo'))
 rows=[];scales=np.ones(3);active=False
 for line in clo.read_text().splitlines():
  a=line.split()
  if not a or a[0].startswith('#'):continue
  if a[0] in ['x_scale','y_scale','z_scale']:
   axis={'x_scale':0,'y_scale':1,'z_scale':2}[a[0]]
   scales[axis]=abs(raw[int(a[1]),axis]-raw[int(a[2]),axis])/float(a[3])
  elif a[0]=='verts':active=True
  elif active and len(a)==9:
   rows.append((list(map(int,a[:3])),list(map(float,a[3:6])),list(map(float,a[6:9]))))
  elif active and len(a)==1 and a[0].isdigit():rows.append(([int(a[0])]*3,[1,0,0],[0,0,0]))
  elif active and a[0] in ['delete_verts','weights']:active=False
 v,tu,gr=obj(next(folder.glob('*.obj')))
 assert len(rows)==len(v),(name,len(rows),len(v))
 fitted=np.array([(raw[idx]*np.array(w)[:,None]).sum(0)+np.array(off)*scales for idx,w,off in rows])
 fitted=transform(fitted)
 if edit:fitted=edit(fitted)
 faces=[];fuv=[]
 for pairs in gr.values():
  for f,t in pairs:
   if select is None or select(fitted[f].mean(0)):
    faces.append(f);fuv.append(t)
 add(name,fitted,faces,fuv,tu,material)
 print(name,'bounds',fitted.min(0).round(4),fitted.max(0).round(4),'faces',len(faces))

def pony_edit(p):
 # Short, low ponytail rather than a waist-length tail.
 p=p.copy()
 weight=np.clip((1.535-p[:,1])/.05,0,1)*np.clip((-p[:,2]-.060)/.035,0,1)*np.exp(-(p[:,0]/.067)**4)
 lowered=1.46+(p[:,1]-1.515)*.36
 p[:,1]=p[:,1]*(1-weight)+lowered*weight
 p[:,1]=np.where(p[:,1]<1.425,1.425+(p[:,1]-1.425)*.35,p[:,1])
 return p
# The layered fringe is an authored textured mesh, softly overlapping the cap.
def fringe_edit(p):
 p=p.copy()
 front=np.clip((p[:,2]-.065)/.05,0,1)*np.clip((1.57-p[:,1])/.06,0,1)
 # Keep tapered ends just above the eyes, retaining the authored side swept flow.
 p[:,1]=np.where(p[:,1]>1.43,np.maximum(1.475,p[:,1]-.019*front),p[:,1])
 return p
proxy('eyebrows/eyebrow005','eyebrows','brows')
proxy('eyelashes/eyelashes02','eyelashes','lashes')
proxy('eyes/high-poly','eyes','eyes')
groom=make_groom(add,body_vertices,groups['body'],uv,TEX)

def grid(name,fun,rows,cols,mat,subdivision=1):
 vs=[];uvs=[];faces=[];fuv=[]
 for i in range(rows+1):
  for j in range(cols+1):
   vs.append(fun(i/rows,j/cols));uvs.append([j/cols,i/rows])
 for i in range(rows):
  for j in range(cols):
   a=i*(cols+1)+j;b=a+cols+1
   f=[a,a+1,b+1,b];faces.append(f);fuv.append(f)
 add(name,vs,faces,fuv,uvs,mat,subdivision)

def dress(s,t):
 a=t*math.tau
 top=1.218-.077*abs(np.cos(a))**12
 if s<.31:
  k=s/.31;y=top*(1-k)+.985*k
  # Square neckline and a restrained, youthful bodice silhouette.
  rx=.134*(1-k)+.113*k+.006*np.sin(k*math.pi)
  rz=.091*(1-k)+.076*k+.008*np.sin(k*math.pi)
  fold=.0015*np.sin(10*a+.6)*np.sin(k*math.pi)
 else:
  k=(s-.31)/.69;y=.985-.48*k
  rx=.113+.100*k**.75;rz=.076+.075*k**.8
  fold=(.002+.013*k)*np.sin(11*a+.5+.32*np.sin(3*a))+(.004*k)*np.sin(7*a+.4)
 exponent=.70+.30*min(1,s/.31)
 x=(rx+fold)*np.sign(np.cos(a))*abs(np.cos(a))**exponent
 z=.038+(rz+fold*.8)*np.sign(np.sin(a))*abs(np.sin(a))**exponent
 if s<.31 and np.sin(a)<0:
  local=skin_points[(abs(skin_points[:,0]-x)<.020)&(abs(skin_points[:,1]-y)<.020)]
  if len(local):
   fitted=local[:,2].min()-.004
   z=min(z,z+(fitted-z)*(1-s/.31)**2)
 if s>.31:y+=.008*k*k*np.sin(3*a+.6)
 return [x,y,z]
grid('dress_skirt',dress,100,120,'dress')
for side,label in [(-1,'l'),(1,'r')]:
 def strap(s,t,side=side):
  a=math.pi*s
  x=side*.116+(t-.5)*.024
  phi=np.arccos(np.clip((abs(x)/.134)**(1/.70),0,1))
  front=dress(0,phi/math.tau);back=dress(0,1-phi/math.tau)
  y=front[1]*(1-s)+back[1]*s+.091*np.sin(a)
  z=front[2]*(1-s)+back[2]*s
  local=skin_points[(abs(skin_points[:,0]-x)<.016)&(abs(skin_points[:,1]-y)<.012)]
  if len(local):
   fitted=local[:,2].max()+.003 if s<.5 else local[:,2].min()-.003
   if s<.5:z=max(z,z+(fitted-z)*np.sin(a)**.25)
   else:z=min(z,z+(fitted-z)*np.sin(a)**.25)
  return [x,y,z]
 grid('dress_strap_'+label,strap,34,6,'dress')

joint=lambda n:body_vertices[np.unique([i for f,t in groups['joint-'+n] for i in f])].mean(0).tolist()
rig=[('hips',None,'pelvis'),('spine','hips','spine-3'),('chest','spine','spine-1'),('neck','chest','neck'),('head','neck','head')]
for side in ['l','r']:
 rig.extend([(side+'_shoulder','chest',side+'-shoulder'),(side+'_elbow',side+'_shoulder',side+'-elbow'),(side+'_wrist',side+'_elbow',side+'-hand'),(side+'_thigh','hips',side+'-upper-leg'),(side+'_knee',side+'_thigh',side+'-knee'),(side+'_ankle',side+'_knee',side+'-ankle'),(side+'_foot',side+'_ankle',side+'-foot-1')])
rigdata=[{'name':n,'parent':p,'position':joint(g)} for n,p,g in rig]
(ROOT/'js/three/rig-data.js').write_text('export const rigData = '+json.dumps(rigdata)+';\n')
files={'skin_color.png':'skins/young_caucasian_female2/young_lightskinned_female_diffuse2.png','hair_color.png':'hair/ponytail01/ponytail01_diffuse.png','fringe_color.png':'hair/short03/short03_diffuse.png','brows_color.png':'eyebrows/eyebrow005/eyebrow005.png','lashes_color.png':'eyelashes/eyelashes02/eyelashes02.png','eyes_color.png':'eyes/materials/brown_eye.png'}
for dest,source in files.items():shutil.copy2(SYSTEM/source,TEX/dest)
# Preserve authored fiber coverage but soften the black eyebrow/eyelash albedo.
for file,color in [('brows_color.png',(77,50,30)),('lashes_color.png',(48,31,20))]:
 a=np.array(Image.open(TEX/file).convert('RGBA'));a[:,:,:3]=color
 Image.fromarray(a).save(TEX/file)
manifest={'height_m':1.56,'morphs':MORPHS,'rig':rigdata,'meshes':meshes,'textures':files,'hair_guides':groom}
(OUT/'girl_quad_source.json').write_text(json.dumps(manifest,separators=(',',':')))
print('Prepared',len(meshes),'quad meshes; head',joint('head'),'eye',joint('l-eye'))
