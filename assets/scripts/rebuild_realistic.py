#!/usr/bin/env python3
"""Reproducible anatomical assets, Y up, metres. No generated image stand-ins.

Human topology: MakeHuman hm08 CC0, with distributed female macro targets.
Whale, flowing garment, hair and texture maps: original procedural geometry.
Run with /home/spark/env_isaaclab/bin/python.
"""
from pathlib import Path
import json, math, importlib.util
import numpy as np
import trimesh
from PIL import Image
from scipy.interpolate import PchipInterpolator
from scipy.ndimage import gaussian_filter

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'assets/usd'
TEX = OUT / 'textures'
TEX.mkdir(exist_ok=True)
spec = importlib.util.spec_from_file_location('legacy', Path(__file__).with_name('generate_usd_from_style.py'))
legacy = importlib.util.module_from_spec(spec); spec.loader.exec_module(legacy)

MATERIALS = {
 'skin': ((.69,.43,.32),.65), 'lips': ((.45,.22,.19),.58),
 'hair': ((.043,.031,.019),.63), 'dress': ((.60,.66,.41),.86),
 'sclera': ((.64,.65,.59),.3), 'iris': ((.055,.033,.02),.25),
 'eye': ((.008,.011,.013),.12), 'whale': ((.075,.11,.125),.4),
 'belly': ((.56,.60,.57),.48), 'groove': ((.11,.15,.155),.48),
}
legacy.MATS = {k:(v[0],v[1],0.,(0,0,0),.15 if k=='whale' else 0.,.22,1.45,.45) for k,v in MATERIALS.items()}
parts_mat = legacy.PART_MAT
textures = {}

def maps():
 rng = np.random.default_rng(302)
 n=1024
 u,v=np.meshgrid(np.linspace(0,1,n),np.linspace(0,1,n))
 # Layered mottling, scratches and fine pores, rather than uniform plastic.
 broad=(np.sin(u*31+np.sin(v*14))*np.cos(v*45)+np.sin(u*89+v*48))*.5
 grain=rng.normal(0,1,(n,n))
 ridge=np.sin(v*240+np.sin(u*22)*3)
 c=np.clip(63+broad*12+grain*3+ridge*1.8,20,110)
 rgb=np.stack([c*.79,c*.96,c*1.04],-1)
 pale=(v>.53)&(v<.94)
 # Belly is on the same continuous surface; soft, irregular colour border.
 blend=np.clip((np.sin(v*math.tau)-.27)*7 + broad*.4,0,1)[...,None]
 rgb=rgb*(1-blend)+np.stack([c*1.8+37,c*1.8+44,c*1.7+43],-1)*blend
 for j in range(42):
  x=rng.integers(40,n-40);y=rng.integers(20,n-20)
  for k in range(rng.integers(5,40)):
   if x+k<n and y+k//5<n:rgb[y+k//5:y+k//5+2,x+k]=[135,143,139]
 Image.fromarray(np.uint8(np.clip(rgb,0,255))).save(TEX/'whale_color.jpg',quality=94)
 rough=np.uint8(np.clip(125+broad*12+grain*4,75,185))
 Image.fromarray(np.stack([np.ones_like(rough)*255,rough,np.zeros_like(rough)],-1)).save(TEX/'whale_roughness.png')
 h=grain*.08+broad*.2+ridge*.025
 dy,dx=np.gradient(h)
 normals=np.stack([-dx,-dy,np.ones_like(h)],-1);normals/=np.linalg.norm(normals,axis=-1)[...,None]
 Image.fromarray(np.uint8((normals*.5+.5)*255)).save(TEX/'whale_normal.png')
 weave=np.sin(u*math.tau*390)*np.sin(v*math.tau*390)
 fabric=np.clip(225+weave*9+grain*2,0,255).astype(np.uint8)
 Image.fromarray(np.stack([fabric*.72,fabric*.79,fabric*.53],-1).astype(np.uint8)).save(TEX/'fabric.jpg',quality=95)
 textures['whale']={'baseColorTexture':Image.open(TEX/'whale_color.jpg'),'normalTexture':Image.open(TEX/'whale_normal.png'),'metallicRoughnessTexture':Image.open(TEX/'whale_roughness.png')}
 textures['dress']={'baseColorTexture':Image.open(TEX/'fabric.jpg')}
 rock=gaussian_filter(rng.normal(0,1,(n,n)),12)*55+gaussian_filter(rng.normal(0,1,(n,n)),2)*13+grain*.6
 rock+=np.sin(v*170+np.sin(u*14)*3)*2
 albedo=np.clip(78+rock*5,35,125)
 Image.fromarray(np.stack([albedo*.83,albedo*.92,albedo],-1).astype(np.uint8)).save(TEX/'rock_color.jpg',quality=92)
 dy,dx=np.gradient(rock*.3);normal=np.stack([-dx,-dy,np.ones_like(dx)],-1);normal/=np.linalg.norm(normal,axis=-1)[...,None]
 Image.fromarray(np.uint8((normal*.5+.5)*255)).save(TEX/'rock_normal.png')

def mesh(name,vs,fs,mat,uv=None):
 m=trimesh.Trimesh(vertices=np.array(vs),faces=np.array(fs),process=False)
 m.remove_unreferenced_vertices()
 if uv is not None:
  # Callers generate referenced grids, so preserve indexing for UVs.
  m=trimesh.Trimesh(vertices=np.array(vs),faces=np.array(fs),process=False)
  m.visual=trimesh.visual.texture.TextureVisuals(uv=np.array(uv))
 parts_mat[name]=mat
 return m

def ell(name,center,radii,mat,sub=3):
 m=trimesh.creation.icosphere(subdivisions=sub)
 m.vertices=m.vertices*np.array(radii)+center
 parts_mat[name]=mat
 return m

def grid(name,func,rows,cols,mat):
 vs=[];uv=[];fs=[]
 for i in range(rows+1):
  for j in range(cols+1):
   vs.append(func(i/rows,j/cols));uv.append((i/rows,j/cols))
 for i in range(rows):
  for j in range(cols):
   a=i*(cols+1)+j;b=a+cols+1
   fs.extend([(a,a+1,b),(a+1,b+1,b)])
 m=mesh(name,vs,fs,mat,uv);m.fix_normals();return m

def tube(name,points,radii,mat,sides=10):
 pts=np.array(points);vs=[];fs=[]
 for i,p in enumerate(pts):
  t=pts[min(i+1,len(pts)-1)]-pts[max(i-1,0)];t/=np.linalg.norm(t)
  normal=np.cross(t,[0,0,1])
  if np.linalg.norm(normal)<.01:normal=np.cross(t,[0,1,0])
  normal/=np.linalg.norm(normal);bitangent=np.cross(t,normal)
  for j in range(sides):
   a=j*math.tau/sides;vs.append(p+radii[i]*(np.cos(a)*normal+np.sin(a)*bitangent))
 for i in range(len(pts)-1):
  for j in range(sides):
   a=i*sides+j;b=i*sides+(j+1)%sides;c=a+sides;d=b+sides
   fs.extend([(a,b,c),(b,d,c)])
 return mesh(name,vs,fs,mat)

def human():
 source=ROOT/'assets/sources/makehuman'
 vs=[];uv=[];groups={};g=None
 for l in (source/'base.obj').read_text().splitlines():
  a=l.split()
  if not a:continue
  if a[0]=='v':vs.append([float(x) for x in a[1:4]])
  elif a[0]=='vt':uv.append([float(x) for x in a[1:3]])
  elif a[0]=='g':g=a[1];groups.setdefault(g,[])
  elif a[0]=='f' and g:groups[g].append([int(x.split('/')[0])-1 for x in a[1:]])
 vs=np.array(vs)
 for n in ['asian-female-young','universal-female-young-averagemuscle-averageweight']:
  for l in (source/(n+'.target')).read_text().splitlines():
   a=l.split()
   if len(a)==4 and not l.startswith('#'):vs[int(a[0])]+=np.array([float(x) for x in a[1:]])
 fs=[]
 for f in groups['body']:
  fs.extend([(f[0],f[k],f[k+1]) for k in range(1,len(f)-1)])
 ids=np.unique(fs);print('human bounds',vs[ids].min(0),vs[ids].max(0))
 vs-=np.array([0,vs[ids,1].min(),0]);vs*=1.58/(vs[ids,1].max())
 # Natural drifting arms, preserving fingers, elbows and shoulder topology.
 # The original A-pose is rotated down from each shoulder with a smooth blend.
 original=vs.copy()
 for side in [-1,1]:
  shoulder=np.array([side*.16,1.30,0])
  weights=np.clip((side*original[:,0]-.16)/.11,0,1)*np.clip((original[:,1]-.77)/.15,0,1)
  a=-side*.30
  R=np.array([[np.cos(a),-np.sin(a),0],[np.sin(a),np.cos(a),0],[0,0,1]])
  rotated=(original-shoulder)@R.T+shoulder
  vs+=weights[:,None]*(rotated-original)
 body=mesh('skin_body',vs,fs,'skin');body=body.subdivide()
 # The garment occludes the torso. Hide internal faces to prevent intersections.
 cent=body.triangles_center
 covered=(cent[:,1]>.88)&(cent[:,1]<1.18)&(abs(cent[:,0])<.166)
 skin=body.submesh([np.where(~covered)[0]],append=True);parts_mat['skin_body']='skin'
 parts={'skin_body':skin}
 # Shell follows the actual torso, then opens into a separate flowing skirt.
 ys=[.92,1.,1.07,1.16,1.25,1.30,1.34]
 rx=PchipInterpolator(ys,[.195,.163,.165,.185,.185,.155,.070])
 rz=PchipInterpolator(ys,[.122,.110,.114,.146,.107,.076,.045])
 def bodice(s,t):
  a=t*math.tau;top=1.23-.072*abs(np.cos(a))**5
  y=.92+(top-.92)*s
  return [float(rx(y))*np.cos(a),y,.045+float(rz(y))*np.sin(a)]
 parts['dress_bodice']=grid('dress_bodice',bodice,62,120,'dress')
 for side,label in [(-1,'l'),(1,'r')]:
  def strap(s,t,side=side):
   a=math.pi*s
   return [side*.128+(t-.5)*.028,1.226+.092*np.sin(a),.038+.104*np.cos(a)]
  n='dress_strap_'+label;parts[n]=grid(n,strap,44,6,'dress')
 def skirt(s,t):
  a=t*math.tau;y=.96-s*.43
  r=.193+.13*s**1.35+(.006+.020*s)*np.sin(12*a+s*2)
  return [np.cos(a)*r+.015*s*s,y+.020*s*s*np.sin(3*a+.5),.045+np.sin(a)*r*.70+.035*s*s]
 parts['dress_skirt']=grid('dress_skirt',skirt,58,144,'dress')
 # Build hair cap from anatomical scalp, leaving forehead and face uncovered.
 def scalp(s,t):
  a=t*math.tau;theta=s*(1.13+.94*(1-np.cos(a))/2)
  return [.098*np.sin(theta)*np.sin(a),1.493+.103*np.cos(theta),.040+.120*np.sin(theta)*np.cos(a)]
 c=body.triangles_center
 mask=(c[:,1]>1.515)|((c[:,1]>1.44)&(c[:,2]<.026))|((c[:,1]>1.485)&(abs(c[:,0])>.055)&(c[:,2]<.10))
 cap=body.submesh([np.where(mask)[0]],append=True);cap.vertices+=cap.vertex_normals*.008
 parts['hair_scalp']=cap;parts_mat['hair_scalp']='hair'
 rng=np.random.default_rng(221)
 # Hair follows the scalp into a low tied ponytail, matching the reference.
 for i in range(100):
  angle=.24+(math.tau-.48)*i/99
  pts=[]
  end=np.array([.020*np.sin(angle),1.468+.012*np.cos(angle),-.103])
  for s in np.linspace(0,1,26):
   a=angle*(1-s)+math.pi*s;theta=1.03+.80*s
   p=np.array([.108*np.sin(theta)*np.sin(a),1.493+.111*np.cos(theta),.04+.140*np.sin(theta)*np.cos(a)])
   p=p*(1-s**5)+end*s**5
   pts.append(p)
  radii=np.linspace(.0042,.0028,26)*(1+rng.uniform(-.2,.2))
  name='hair_lock_%03d'%i;parts[name]=tube(name,pts,radii,'hair',7)
 for i in range(56):
  a=i*math.tau/56;r=.034*np.sqrt((i%9+1)/9)
  pts=[]
  for s in np.linspace(0,1,30):
   pts.append([r*np.cos(a)*(1-s*.5)+.025*np.sin(s*4)*s,1.46-.185*s,-.103-.07*np.sin(s*2)+r*np.sin(a)*(1-s*.7)])
  n='hair_ponytail_%03d'%i;parts[n]=tube(n,pts,np.linspace(.0055,.0008,30),'hair',8)
 # Layered side swept fringe; individual narrow ribbons carry strand highlights.
 for i in range(48):
  f=i/47;x=-.077+.154*f
  end_y=1.498+.023*np.sin(f*math.pi)
  def fringe(s,t,x=x,f=f,end_y=end_y):
   crown_y=1.575-.46*abs(x)
   crown_z=.083-.20*abs(x)
   return [x+.007*np.sin(s*math.pi)*np.cos(f*math.pi)+(t-.5)*.0042*(1-s*.4),crown_y*(1-s)+end_y*s,crown_z+.070*np.sin(s*math.pi/2)-abs(x)*.08]
  n='hair_fringe_%03d'%i;parts[n]=grid(n,fringe,30,3,'hair')
 parts['hair_tie']=ell('hair_tie',[0,1.465,-.113],(.03,.016,.023),'hair',3)
 # Use joint eye centres from the actual mesh, not guessed cartoon eyes.
 for side,label in [(-1,'r'),(1,'l')]:
  eye_group=groups['joint-'+label+'-eye'];idx=np.unique(np.concatenate(eye_group));c=vs[idx].mean(0)
  print('eye centre',label,c)
  parts['sclera_'+label]=ell('sclera_'+label,c,(.0118,.0107,.0107),'sclera')
  parts['iris_'+label]=ell('iris_'+label,c+[0,0,.010],(.0054,.0054,.0016),'iris')
  parts['pupil_'+label]=ell('pupil_'+label,c+[0,0,.0115],(.0025,.0025,.0008),'eye')
  pts=[]
  for s in np.linspace(0,1,20):
   pts.append(c+[(-.024+.048*s),.021+.004*np.sin(s*math.pi),.012-.005*abs(2*s-1)])
  n='eyebrow_'+label;parts[n]=tube(n,pts,np.sin(np.linspace(0,math.pi,20))*.0014+.0004,'hair',6)
 # Colour lips on their own topology surface.
 c=body.triangles_center
 lip=(abs(c[:,0])<.024)&(c[:,1]>1.406)&(c[:,1]<1.417)&(c[:,2]>.122)
 # Soft per-vertex lip and cheek colour avoids a separate jagged polygon overlay.
 for label,y,z,r in [('upper',1.414,.144,.002),('lower',1.408,.144,.0025)]:
  pts=[]
  for s in np.linspace(0,1,28):
   pts.append([-.021+.042*s,y+( .0015 if label=='upper' else -.001)*np.sin(math.pi*s),z-.005*abs(2*s-1)])
  n='lip_'+label;parts[n]=tube(n,pts,np.sin(np.linspace(0,math.pi,28))*r+.0002,'lips',8)
 # Record actual skeletal landmarks AFTER proportion/pose transforms.
 joint=lambda n:vs[np.unique(np.concatenate(groups['joint-'+n]))].mean(0).tolist()
 rig=[('hips',None,'pelvis'),('spine','hips','spine-3'),('chest','spine','spine-1'),('neck','chest','neck'),('head','neck','head')]
 for side in ['l','r']:
  rig.extend([(side+'_shoulder','chest',side+'-shoulder'),(side+'_elbow',side+'_shoulder',side+'-elbow'),(side+'_wrist',side+'_elbow',side+'-hand'),(side+'_thigh','hips',side+'-upper-leg'),(side+'_knee',side+'_thigh',side+'-knee'),(side+'_ankle',side+'_knee',side+'-ankle'),(side+'_foot',side+'_ankle',side+'-foot-1')])
 data=[{'name':n,'parent':p,'position':joint(g)} for n,p,g in rig]
 (ROOT/'js/three/rig-data.js').write_text('export const rigData = '+json.dumps(data)+';\n')
 # Batch strands to keep draw calls bounded on mobile, retaining real geometry.
 for prefix,merged in [('hair_lock_','hair_locks'),('hair_ponytail_','hair_ponytail'),('hair_fringe_','hair_fringe')]:
  names=[n for n in parts if n.startswith(prefix)]
  parts[merged]=trimesh.util.concatenate([parts.pop(n) for n in names]);parts_mat[merged]='hair'
 return parts

def whale():
 # Length 12m. Broad rostrum, massive thorax, tapered caudal peduncle.
 knots=[-6,-5.5,-4.6,-3.5,-2,-.5,1,2.5,3.6,4.6,5.25,5.65,5.82,5.92]
 width=PchipInterpolator(knots,[.035,.24,.45,.72,1.05,1.36,1.48,1.56,1.61,1.49,1.30,1.05,.68,.06])
 height=PchipInterpolator(knots,[.065,.25,.44,.70,1.02,1.31,1.40,1.39,1.28,1.07,.80,.50,.23,.03])
 yc=PchipInterpolator(knots,[0,0,.03,.10,.16,.17,.18,.16,.13,.12,.11,.11,.10,.10])
 def surface(s,t):
  x=-6+11.92*s;a=t*math.tau
  h=float(height(x));w=float(width(x))
  # Ventral pleats carved into the same continuous skin surface.
  vent=max(0,-np.sin(a))**4
  pleat=.047*np.cos(a*42)*vent*max(0,min(1,(x+1.5)/2))*max(0,min(1,(5.75-x)))
  return [x,yc(x)+(h+pleat)*np.sin(a),(w+pleat)*np.cos(a)]
 parts={'whale_body':grid('whale_body',surface,200,128,'whale')}
 def flipper(side):
  def f(s,t):
   a=t*math.tau
   z=side*(1.10+3.60*s);x=.95-1.7*s+.28*np.sin(s*math.pi)
   chord=.075+.56*np.sin(math.pi*s)**.72
   # Characteristic tuberculate leading edge of the long humpback pectoral.
   wave=.035*np.sin(s*math.tau*9)*max(0,np.cos(a))*np.sin(s*math.pi)
   return [x+(chord+wave)*np.cos(a),-.35-.5*s+.115*np.sin(math.pi*s)*np.sin(a),z]
  return f
 for side,label in [(1,'l'),(-1,'r')]:
  n='pectoral_'+label;parts[n]=grid(n,flipper(side),92,26,'belly')
  def fluke(s,t,side=side):
   a=t*math.tau;z=side*(.04+2.13*s)
   x=-5.85+.25*s-.3*np.sin(math.pi*s)
   chord=.1+.69*np.sin(math.pi*s)**.65
   return [x+chord*np.cos(a),.04+.16*s*s+.062*np.sin(math.pi*s)*np.sin(a),z]
  n='fluke_'+label;parts[n]=grid(n,fluke,80,26,'whale')
 # Swept dorsal fin; local y on top of the rear third of body.
 def dorsal(s,t):
  a=t*math.tau;y=.98+s*.76
  return [-2.0-.62*s+(.55*(1-s)+.005)*np.cos(a),y,.12*(1-s)*np.sin(a)]
 parts['dorsal']=grid('dorsal',dorsal,45,26,'whale')
 # Jaw lines on BOTH sides with small eyes set behind mouth corner.
 for side,label in [(1,'l'),(-1,'r')]:
  pts=[]
  for x in np.linspace(3.0,5.8,88):
   a=(-.26 if side==1 else math.pi+.26)
   pts.append([x,yc(x)+height(x)*np.sin(a),width(x)*np.cos(a)*1.003])
  n='mouth_'+label;parts[n]=tube(n,pts,np.ones(88)*.019,'groove',8)
  x=3.15;a=(-.02 if side==1 else math.pi+.02)
  c=np.array([x,float(yc(x)+.04),float(side*width(x))])
  n='eye_'+label;parts[n]=ell(n,c,(.05,.035,.025),'eye')
  n='eyelid_'+label
  pts=[c+[.068*np.cos(a),.047*np.sin(a),side*.002] for a in np.linspace(0,math.tau,40)]
  parts[n]=tube(n,pts,np.ones(40)*.01,'whale')
 # Rostral tubercles distributed along the top of broad head and jaw.
 for i,x in enumerate(np.linspace(3.15,5.15,8)):
  for j,a in enumerate([.65,1.57,2.49]):
   c=[x,float(yc(x)+height(x)*np.sin(a)),float(width(x)*np.cos(a))]
   n='tubercle_%d_%d'%(i,j);parts[n]=ell(n,c,(.064,.036,.044),'whale',2)
 for i,side in enumerate([-1,1]):
  n='blowhole_'+str(i);parts[n]=ell(n,[3.12,float(yc(3.12)+height(3.12)),side*.095],(.10,.015,.042),'groove')
 return parts

def pbr(parts,path):
 scene=trimesh.Scene()
 for n,m in parts.items():
  mat=parts_mat[n];color,rough=MATERIALS[mat]
  kw=textures.get(mat,{})
  # Maps carry albedo; untextured surfaces retain physically based factors.
  factor=[255,255,255,255] if kw else [int(c*255) for c in color]+[255]
  material=trimesh.visual.material.PBRMaterial(name=mat,baseColorFactor=factor,roughnessFactor=rough,metallicFactor=0.,doubleSided=mat in ('dress','hair'),**kw)
  uv=m.visual.uv if hasattr(m.visual,'uv') and m.visual.uv is not None else np.zeros((len(m.vertices),2))
  m.visual=trimesh.visual.texture.TextureVisuals(uv=uv,material=material)
  scene.add_geometry(m,node_name=n,geom_name=n)
 path.write_bytes(trimesh.exchange.gltf.export_glb(scene,include_normals=True))

def textured_usd(parts,path,root):
 # Legacy writer provides explicit smooth normals and portable PreviewSurface.
 legacy.write_character_usda(path,root,parts)
 doc=path.read_text()
 for mat,files in {'whale':{'diffuseColor':'whale_color.jpg','normal':'whale_normal.png'},'belly':{'diffuseColor':'whale_color.jpg','normal':'whale_normal.png'},'dress':{'diffuseColor':'fabric.jpg'}}.items():
  marker='    def Mesh '
  shader=f'/{root}/Looks/{mat}/Shader'
  # Replace colour input in the relevant material block only.
  start=doc.index('def Material "'+mat+'"') if 'def Material "'+mat+'"' in doc else -1
  if start<0:continue
  end=doc.find('def Material ',start+15)
  if end<0:end=doc.index(marker,start)
  block=doc[start:end]
  import re
  for input,file in files.items():
   typename='normal3f' if input=='normal' else 'color3f'
   connection=f'{typename} inputs:{input}.connect = </{root}/Looks/{mat}/{input}Texture.outputs:rgb>'
   if input=='diffuseColor':block=re.sub(r'color3f inputs:diffuseColor = \([^\n]+\)',connection,block)
   else:block=block.replace('token outputs:surface\n',connection+'\n                token outputs:surface\n')
  # Texture shaders are inserted before the material closes.
  cut=block.rfind('        }')
  nodes='''            def Shader "UV" {
                uniform token info:id = "UsdPrimvarReader_float2"
                token inputs:varname = "st"
                float2 outputs:result
            }
'''
  for input,file in files.items():
   nodes+=f'''            def Shader "{input}Texture" {{
                uniform token info:id = "UsdUVTexture"
                asset inputs:file = @textures/{file}@
                token inputs:sourceColorSpace = "{'raw' if input=='normal' else 'sRGB'}"
                float2 inputs:st.connect = </{root}/Looks/{mat}/UV.outputs:result>
'''
   if input=='normal':nodes+='                float4 inputs:scale = (2, 2, 2, 1)\n                float4 inputs:bias = (-1, -1, -1, 0)\n'
   nodes+='                float3 outputs:rgb\n            }\n'
  block=block[:cut]+nodes+block[cut:];doc=doc[:start]+block+doc[end:]
 # Add UV arrays on every actual mesh that has parameterized coordinates.
 for name,m in parts.items():
  if hasattr(m.visual,'uv') and m.visual.uv is not None:
   a=legacy._wrap_tokens([f'({u:.6f}, {v:.6f})' for u,v in m.visual.uv],6)
   target='def Mesh "'+name+'"\n    {'
   doc=doc.replace(target,target+'\n        texCoord2f[] primvars:st = [\n'+a+'\n        ] ( interpolation = "vertex" )')
 path.write_text(doc)

def main():
 if (ROOT/'assets/scripts/rebuild_refined.py').exists():
  from rebuild_refined import main as refined
  return refined()
 maps();girl=human();w=whale()
 textured_usd(girl,OUT/'girl.usda','Girl');textured_usd(w,OUT/'whale.usda','Whale')
 pbr(girl,OUT/'girl.glb');pbr(w,OUT/'whale.glb')
 (OUT/'deep_sea_stage.usda').write_text('''#usda 1.0
(
    defaultPrim = "DeepSeaStage"
    metersPerUnit = 1
    upAxis = "Y"
)
def Xform "DeepSeaStage" {
    def Xform "Girl" ( prepend references = @girl.usda@ ) {
        double3 xformOp:translate = (0.5, 0.7, 2.8)
        float xformOp:rotateY = 60
        uniform token[] xformOpOrder = ["xformOp:translate", "xformOp:rotateY"]
    }
    def Xform "Whale" ( prepend references = @whale.usda@ ) {
        double3 xformOp:translate = (0.6, -1, -2)
        float xformOp:rotateY = -53
        float xformOp:rotateZ = -8
        uniform token[] xformOpOrder = ["xformOp:translate", "xformOp:rotateZ", "xformOp:rotateY"]
    }
}
''')
 report={}
 for name,parts in [('girl',girl),('whale',w)]:
  report[name]={'meshes':len(parts),'vertices':sum(len(m.vertices) for m in parts.values()),'triangles':sum(len(m.faces) for m in parts.values()),'materials':sorted(set(parts_mat[n] for n in parts)), 'bounds_m':trimesh.Scene(list(parts.values())).bounds.tolist(),'glb_bytes':(OUT/(name+'.glb')).stat().st_size}
  assert all(np.isfinite(m.vertices).all() for m in parts.values())
 (OUT/'rebuild_report.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))

if __name__=='__main__':main()
