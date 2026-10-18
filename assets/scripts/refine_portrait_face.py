"""Reference-guided face-only sculpt with coherent eye/brow proxy refitting."""
from pathlib import Path
import json, numpy as np
ROOT=Path(__file__).resolve().parents[2];SOURCE=ROOT/'assets/sources/makehuman';SYSTEM=ROOT/'assets/sources/makehuman-system'
D=json.loads((ROOT/'assets/refined/girl_swim_source_v8.json').read_text());D['meshes']=[m for m in D['meshes'] if not m['name'].startswith('hair')]
def obj(path):
 vertices=[];groups={};group='body'
 for line in path.read_text().splitlines():
  parts=line.split()
  if not parts:continue
  if parts[0]=='v':vertices.append(list(map(float,parts[1:4])))
  elif parts[0]=='g':group=parts[1]
  elif parts[0]=='f':groups.setdefault(group,[]).append([int(v.split('/')[0])-1 for v in parts[1:]])
 return np.array(vertices),groups
base,groups=obj(SOURCE/'base.obj')
def target(name):
 delta=np.zeros_like(base)
 for line in (SOURCE/(name+'.target')).read_text().splitlines():
  parts=line.split()
  if len(parts)==4 and not line.startswith('#'):delta[int(parts[0])]=list(map(float,parts[1:]))
 return delta

def build_oral_geometry(data):
 # A recessed inner bowl adds depth behind the lips, without any teeth.
 def add(name,vs,faces,material):
  data['meshes'].append({'name':name,'vertices':np.asarray(vs).tolist(),'faces':faces,'face_uv':faces,'uvs':[[0,0] for _ in vs],'material':material,'subdivision':1})
 vs=[[0,1.39855,.1268]];faces=[];n=48
 for j in range(n):
  a=j/n*np.pi*2;x=.019*np.cos(a);y=1.39855+.0026*np.sin(a)+.0011*(x/.019)**2
  vs.append([x,y,.1300-.012*(abs(x)/.019)**2])
 for j in range(n):faces.append([0,1+j,1+(j+1)%n])
 add('lip_inner_cavity',vs,faces,'oral')
 data['appearance']['features']+=['soft expression without teeth']

original=D['morphs'];raw=base.copy()
for name,weight in original.items():raw+=target(name)*weight
indices=np.unique([v for f in groups['body'] for v in f]);bottom=raw[indices,1].min();scale=1.56/np.ptp(raw[indices,1])
# Only the head receives the new morph delta; body and swimsuit/dress rig stay
# exactly as authored in v8. Named morph presets are asset controls.
delta=.74*(target('asian-female-young')-target('caucasian-female-young'))
delta+=target('chin-width-decr')*.025+target('chin-height-decr')*.095+target('chin-prognathism-decr')*.22
delta+=target('l-eye-height2-incr')*.035+target('r-eye-height2-incr')*.035
delta+=target('nose-scale-horiz-decr')*.21+target('mouth-scale-horiz-decr')*.18
delta+=target('mouth-upperlip-volume-incr')*.19+target('mouth-lowerlip-volume-incr')*.21+target('mouth-angles-up')*.105+target('nose-scale-vert-decr')*.08+target('nose-point-up')*.045
head_joint=np.unique([i for f in groups['joint-head'] for i in f]);delta-=delta[head_joint].mean(0)
head_y=(raw[:,1]-bottom)*scale;mask=np.clip((head_y-1.35)/.04,0,1);mask=mask*mask*(3-2*mask)
new_raw=raw+delta*mask[:,None]
def transform(p):
 p=p.copy();p[:,1]=(p[:,1]-bottom)*scale;p[:,[0,2]]*=scale
 head=np.clip((p[:,1]-1.33)/.045,0,1);p[:,0]*=.93+.07*head
 return p
new_head=transform(new_raw);old_head=transform(raw)
old_body=np.array(D['meshes'][0]['vertices']);body=old_body+(new_head-old_head)
# Reference-guided proportions: a rounded chin with a shorter bottom, while
# preserving cheek and eye separation. All masks use pre-sculpt coordinates,
# so the resulting deformation is symmetric and reproducible.
p=body.copy()
def smooth(x):
 x=np.clip(x,0,1);return x*x*(3-2*x)
front=smooth((p[:,2]-.045)/.055)
headmask=smooth((p[:,1]-1.35)/.02)
shorten=(1-smooth((p[:,1]-1.355)/.070))*front*headmask
body[:,1]+=.0075*shorten
jaw=np.exp(-((p[:,1]-1.378)/.030)**2)*front*headmask
body[:,0]*=1-.015*jaw
# Flatten the tip of the chin through a broad, smooth lift, and restore width
# only within the lower 28 mm. This rounds the bottom without widening cheeks.
chin=np.exp(-((p[:,1]-1.364)/.020)**4)*front*headmask
chin_centre=np.exp(-(p[:,0]/.035)**4)
body[:,1]+=.0040*chin*chin_centre
body[:,0]*=1+.075*chin*np.exp(-(p[:,0]/.035)**4)
# A modest pad in the lateral transition removes the former straight angular
# jaw taper. Its displacement is below one millimetre in the face side wall.
jaw_transition=np.exp(-((p[:,1]-1.376)/.019)**2-((abs(p[:,0])-.029)/.016)**2)*front*headmask
body[:,0]+=np.sign(p[:,0])*.0007*jaw_transition
body[:,2]+=.00055*jaw_transition
# A relaxed almond eyelid contour, rather than the former 11% open-eyed look.
# Ocular proxies are refitted below; horizontal eye positions are untouched.
eyecentre=1.456
ocular=np.exp(-((abs(p[:,0])-.028)/.020)**4-((p[:,1]-eyecentre)/.017)**4)*smooth((p[:,2]-.075)/.025)
body[:,1]+=(p[:,1]-eyecentre)*-.12*ocular
outer=smooth((abs(p[:,0])-.031)/.013)
body[:,1]+=.00035*outer*ocular
# Gently soften the bridge highlight ridge and round the tip; no large nose
# scaling or position shift. Width reduction is restricted to the nasal base.
nose=np.exp(-(p[:,0]/.022)**4-((p[:,1]-1.425)/.019)**4)*smooth((p[:,2]-.115)/.020)
body[:,0]*=1-.082*nose
body[:,1]+=.00040*nose
body[:,2]-=.00080*nose
bridge=np.exp(-(p[:,0]/.011)**4-((p[:,1]-1.446)/.017)**2)*smooth((p[:,2]-.110)/.016)
body[:,2]-=.00085*bridge
# V14: a more delicate oval lower face, with a compact round lower contour.
q=body.copy();qfront=smooth((q[:,2]-.052)/.055)
lower_face=np.exp(-((q[:,1]-1.401)/.036)**4)*smooth((abs(q[:,0])-.022)/.024)*qfront*headmask
body[:,0]*=1-.042*lower_face
chin_lift=np.exp(-((q[:,1]-1.371)/.019)**4)*qfront*headmask
body[:,1]+=.0010*chin_lift
# Sculpt the anatomical lip loops instead of a broad flattened contact band.
q=body.copy();u=np.minimum(abs(q[:,0])/.022,1.3)
contact_y=1.39795+.00165*u**2
seam=np.exp(-(q[:,0]/.022)**8-((q[:,1]-contact_y)/.00105)**4)*smooth((q[:,2]-.116)/.012)
body[:,1]+=(contact_y-q[:,1])*.10*seam
contact_z=.1308-.0065*u**2
body[:,2]+=np.clip(contact_z-q[:,2],0,.00035)*seam
# Soft cheek apples and a continuous cheek-to-jaw transition, guided by
# the article's head sculpting close-ups. The chin remains compact and round.
q=body.copy();face_front=smooth((q[:,2]-.065)/.055)*headmask
cheek=np.exp(-((abs(q[:,0])-.043)/.026)**4-((q[:,1]-1.424)/.024)**2)*face_front
body[:,2]+=.00165*cheek;body[:,1]+=.00080*cheek
transition=np.exp(-((abs(q[:,0])-.045)/.026)**4-((q[:,1]-1.401)/.025)**4)*face_front
body[:,0]*=1-.018*transition
forehead=np.exp(-((q[:,1]-1.503)/.038)**4)*smooth((q[:,2]-.077)/.035)*headmask
body[:,2]+=.00070*forehead
# Reference 9764D623: narrower lower lateral cheeks, round chin, soft cheek apples.
q=body.copy();facial_gate=smooth((q[:,2]-.062)/.055)*headmask
lateral=np.exp(-((q[:,1]-1.405)/.027)**4)*smooth((abs(q[:,0])-.030)/.026)*facial_gate
body[:,0]*=1-.058*lateral
apple=np.exp(-((abs(q[:,0])-.037)/.019)**2-((q[:,1]-1.433)/.017)**2)*facial_gate
body[:,2]+=.00220*apple;body[:,1]+=.00110*apple
chin_round=np.exp(-((q[:,1]-1.371)/.022)**2)*smooth((q[:,2]-.094)/.025)*headmask
chin_centre=np.exp(-(q[:,0]/.026)**2)
body[:,1]+=.0015*chin_round*chin_centre
body[:,0]*=1+.025*chin_round*chin_centre
body[:,2]-=.00055*chin_round*chin_centre
# Reference FA9F4E19: thicker central cushions taper smoothly to pointed corners.
q=body.copy();lip_u=np.minimum(abs(q[:,0])/.022,1.4)
contact_y=1.39795+.00165*lip_u**2
lip_region=np.exp(-((q[:,1]-contact_y)/.0090)**4)*smooth((q[:,2]-.113)/.013)*(1-smooth((abs(q[:,0])-.025)/.006))
centre_volume=np.exp(-(q[:,0]/.0095)**2)
side_taper=1-.53*smooth((lip_u-.38)/.62)
vertical_scale=(1+.13*centre_volume)*side_taper
body[:,1]+=(q[:,1]-contact_y)*(vertical_scale-1)*lip_region
upper_support=np.linalg.norm(target('mouth-upperlip-volume-incr'),axis=1);upper_support/=upper_support.max()
lower_support=np.linalg.norm(target('mouth-lowerlip-volume-incr'),axis=1);lower_support/=lower_support.max()
body[:,2]+=(.00030*upper_support+.00060*lower_support)*centre_volume*smooth((q[:,2]-.117)/.011)
body[:,2]-=.0011*smooth((lip_u-.40)/.60)*lip_region
# A small smile lifts the corners and nearby soft tissue while retaining closure.
q=body.copy()
smile_field=np.exp(-((abs(q[:,0])-.020)/.012)**2-((q[:,1]-1.402)/.015)**2)*smooth((q[:,2]-.103)/.022)
smile_lift=.00165*smile_field
body[:,1]+=smile_lift
# V23: let the slight smile blend softly into the perioral cheek tissue.
q=body.copy()
perioral=np.exp(-((abs(q[:,0])-.024)/.013)**2-((q[:,1]-1.411)/.014)**2)*smooth((q[:,2]-.095)/.025)
body[:,1]+=.00018*perioral;body[:,2]+=.00015*perioral
# V22: reduce the forward chin pad and soften the full lower contour.
q=body.copy()
chin_front=np.exp(-((q[:,1]-1.376)/.018)**4-(q[:,0]/.043)**4)*smooth((q[:,2]-.068)/.033)*smooth((old_body[:,1]-1.35)/.012)
body[:,2]-=.0031*chin_front
# Lift only the lowest central portion, instead of stacking wider chin pads.
chin_bottom=np.exp(-((q[:,1]-1.359)/.010)**2-(q[:,0]/.035)**4)*smooth((q[:,2]-.062)/.036)*smooth((old_body[:,1]-1.35)/.009)
body[:,1]+=.0030*chin_bottom
# A small perioral width adjustment and a relaxed upper/lower lip contact.
q=body.copy();mouth_gate=np.exp(-((q[:,1]-1.399)/.016)**4)*smooth((q[:,2]-.109)/.018)*(1-smooth((abs(q[:,0])-.025)/.010))
body[:,0]*=1-.045*mouth_gate
lip_contact=1.39805+.00165*(np.minimum(abs(q[:,0])/.022,1.3))**2+smile_lift
contact_soft=np.exp(-((q[:,1]-lip_contact)/.0020)**4)*np.exp(-(q[:,0]/.018)**6)*smooth((q[:,2]-.124)/.006)
body[:,1]+=.00020*np.tanh((q[:,1]-lip_contact)/.00035)*contact_soft
# Soften the labiomental transition without flattening the lip cushions.
from scipy.sparse import coo_matrix
edges=set()
for face in D['meshes'][0]['faces']:
 for a,b in zip(face,face[1:]+face[:1]):edges.add((a,b));edges.add((b,a))
rows,cols=zip(*edges);adj=coo_matrix((np.ones(len(rows)),(rows,cols)),shape=(len(body),len(body))).tocsr()
degree=np.maximum(np.asarray(adj.sum(1)).ravel(),1)
q=body.copy()
soften=np.exp(-((q[:,1]-1.374)/.021)**4)*smooth((q[:,2]-.063)/.033)*(1-smooth((q[:,1]-1.385)/.007))*smooth((old_body[:,1]-1.35)/.010)
for step in range(10):body+=((adj@body)/degree[:,None]-body)*(.28*soften[:,None])
# Round the profile underside as it approaches the anterior chin, avoiding
# a flat horizontal shelf while preserving the full cheek-to-jaw silhouette.
q=body.copy()
underchin=(1-smooth((q[:,1]-1.362)/.015))*smooth((q[:,2]-.070)/.030)*np.exp(-(q[:,0]/.040)**4)*smooth((old_body[:,1]-1.35)/.010)
body[:,1]+=(.0010+.0050*smooth((q[:,2]-.094)/.024))*underchin
body[:,2]-=.0010*underchin
# The relaxed lower lip retains a central cushion with less hanging rim.
q=body.copy();u=np.minimum(abs(q[:,0])/.022,1.3)
local_seam=1.39795+.00165*u**2+smile_lift
lower_cushion=smooth((q[:,2]-.120)/.010)*np.exp(-(q[:,0]/.021)**6)*smooth((local_seam-q[:,1])/.0015)*np.exp(-((q[:,1]-1.395)/.006)**4)
body[:,1]+=(local_seam-q[:,1])*.12*lower_cushion
body[:,2]-=.00085*np.exp(-((abs(q[:,0])-.012)/.008)**2)*lower_cushion
upper_rim=np.exp(-((q[:,1]-1.404)/.004)**4)*smooth((q[:,2]-.126)/.008)
body[:,1]+=(.00025*np.exp(-((abs(q[:,0])-.006)/.004)**2)-.00025*np.exp(-(q[:,0]/.003)**2))*upper_rim
# V24: restrain the upper lip and cheekbone prominence, keeping eyes and chin.
q=body.copy();v25_scope=smooth((old_body[:,1]-1.35)/.030)
upper_retreat=upper_support*np.exp(-(q[:,0]/.020)**4)*smooth((q[:,2]-.116)/.015)
body[:,2]-=.00120*upper_retreat*v25_scope
protect_eyes=1-smooth((q[:,1]-1.443)/.008)
cheek_recess=np.exp(-((abs(q[:,0])-.045)/.022)**2-((q[:,1]-1.435)/.023)**2)*smooth((q[:,2]-.055)/.045)*protect_eyes
body[:,2]-=.00105*cheek_recess*v25_scope
side_refine=smooth((abs(q[:,0])-.038)/.024)*np.exp(-((q[:,1]-1.426)/.031)**4)*smooth((q[:,2]-.040)/.050)*protect_eyes
body[:,0]*=1-.030*side_refine*v25_scope
# Ears share the skin island: use a smooth visible surface field at the ears.
visible_v25=np.zeros(len(body),dtype=bool);visible_v25[np.unique([i for f in D['meshes'][0]['faces'] for i in f])]=True
q=body.copy()
ear_shift=smooth((abs(q[:,0])-.059)/.012)*np.exp(-((q[:,1]-1.440)/.034)**8)*(1-smooth((q[:,2]-.048)/.022))*smooth((q[:,2]-.009)/.015)*visible_v25
body[:,2]+=.0018*ear_shift*v25_scope
# Native source targets carry a few micrometres of asymmetry. Pair the visible
# head's canonical opposite vertices and average the edit to retain a symmetric
# authored rest mesh. Torso vertices and hidden rig helper geometry are intact.
from scipy.spatial import cKDTree
visible_vertices=np.unique([i for f in D['meshes'][0]['faces'] for i in f])
# Rig/measurement helpers have no visible-face adjacency. Keep their authored
# anchors; local surface smoothing must not pull isolated helpers toward zero.
visible_mask=np.zeros(len(body),dtype=bool);visible_mask[visible_vertices]=True
body[~visible_mask]=old_body[~visible_mask]
head_indices=visible_vertices[old_body[visible_vertices,1]>1.35]
mirror_old=old_body[head_indices].copy();mirror_old[:,0]*=-1
pair_error,pair_local=cKDTree(old_body[head_indices]).query(mirror_old)
assert pair_error.max()<.00015
assert np.array_equal(pair_local[pair_local],np.arange(len(pair_local)))
opposite=body[head_indices[pair_local]].copy();opposite[:,0]*=-1
body[head_indices]=(body[head_indices]+opposite)*.5
# Pose-independent scalar fields are exported for a restrained lip/cheek tint.
D['meshes'][0]['vertices']=body.tolist()
upper_signal=np.linalg.norm(target('mouth-upperlip-volume-incr'),axis=1)
lower_signal=np.linalg.norm(target('mouth-lowerlip-volume-incr'),axis=1)
upper_mask=smooth((upper_signal/upper_signal.max()-.035)/.52)
lower_mask=smooth((lower_signal/lower_signal.max()-.035)/.52)
lip_gate=smooth((body[:,2]-.113)/.014)
tip_fade=1-smooth((abs(body[:,0])/.022-.65)/.38)
upper_mask*=lip_gate*tip_fade;lower_mask*=lip_gate*tip_fade
seam_y=1.39795+.00165*(np.minimum(abs(body[:,0])/.022,1.3))**2+smile_lift
seam_mask=np.exp(-((body[:,1]-seam_y)/.0009)**2)*np.maximum(upper_mask,lower_mask)
D['meshes'][0]['portrait_masks']=np.column_stack([upper_mask,lower_mask,seam_mask]).tolist()

new_raw_final=new_raw+(body-new_head)/scale
folders={'eyebrows':'eyebrows/eyebrow005','eyelashes':'eyelashes/eyelashes02','eyes':'eyes/high-poly'}
for mesh in D['meshes'][1:]:
 if mesh['name'] not in folders:continue
 folder=SYSTEM/folders[mesh['name']];rows=[];scales=np.ones(3);active=False
 for line in next(folder.glob('*.mhclo')).read_text().splitlines():
  a=line.split()
  if not a or a[0].startswith('#'):continue
  if a[0] in ['x_scale','y_scale','z_scale']:
   axis={'x_scale':0,'y_scale':1,'z_scale':2}[a[0]];scales[axis]=abs(new_raw_final[int(a[1]),axis]-new_raw_final[int(a[2]),axis])/float(a[3])
  elif a[0]=='verts':active=True
  elif active and len(a)==9:rows.append((list(map(int,a[:3])),list(map(float,a[3:6])),list(map(float,a[6:9]))))
  elif active and len(a)==1 and a[0].isdigit():rows.append(([int(a[0])]*3,[1,0,0],[0,0,0]))
  elif active and a[0] in ['delete_verts','weights']:active=False
 fitted=np.array([(new_raw_final[idx]*np.array(w)[:,None]).sum(0)+np.array(off)*scales for idx,w,off in rows]);fitted=transform(fitted)
 if mesh['name']=='eyebrows':
  for sign in [-1,1]:
   sel=fitted[:,0]*sign>0;p=fitted[sel];y=p[:,1].mean();p[:,1]=y+(p[:,1]-y)*.76-.00045;p[:,2]+=.0005;fitted[sel]=p
 if mesh['name']=='eyelashes':
  # Keep a fine upper lash line; avoid the former thick doll-like fringe.
  for sign in [-1,1]:
   sel=fitted[:,0]*sign>0;p=fitted[sel];centre=p.mean(0);p[:,1]=centre[1]+(p[:,1]-centre[1])*.75;fitted[sel]=p
 mesh['vertices']=fitted.tolist()
# Eyeballs retain the calibrated physical size from v21. Facial aperture edits
# move the eyelids, while measurement helpers stay fixed and never rescale eyes.
eye_reference=json.loads((ROOT/'assets/refined/girl_portrait_source_v21.json').read_text())
for mesh in D['meshes']:
 if mesh['name'] in ['eyes','eyelashes','eyebrows']:
  fitted=np.array(next(m['vertices'] for m in eye_reference['meshes'] if m['name']==mesh['name']))
  if mesh['name']=='eyelashes':
   tip=smooth((fitted[:,1]-1.458)/.0040);fitted[:,1]+=.00075*tip;fitted[:,2]+=.00035*tip
  if mesh['name']=='eyebrows':
   for sign in [-1,1]:
    pick=fitted[:,0]*sign>0;mid=fitted[pick,1].mean();fitted[pick,1]=mid+(fitted[pick,1]-mid)*(1.04/.88)+.00055
  mesh['vertices']=fitted.tolist()
# Additional lower lashes follow the calibrated lower eyelid, not the hair.
# Thin tapered 3D fibres are separated from the alpha-card base for definition.
from scipy.interpolate import PchipInterpolator
lash_root=np.array([[.016093,1.454991,.120497],[.019506,1.453307,.120818],[.024430,1.453228,.122197],[.027996,1.453074,.123119],[.030948,1.453078,.122677],[.034035,1.453400,.121659],[.035897,1.454161,.120729],[.037964,1.454036,.120909],[.039319,1.454619,.119962],[.042088,1.454449,.118747]])
root_y=PchipInterpolator(lash_root[:,0],lash_root[:,1]);root_z=PchipInterpolator(lash_root[:,0],lash_root[:,2])
for side,label in [(-1,'l'),(1,'r')]:
 vs=[];faces=[];uv=[]
 for k,x in enumerate(np.linspace(.0182,.0408,12)):
  root=np.array([side*x,float(root_y(x)),float(root_z(x))+.00010])
  length=.00110+.00050*np.sin((k+1)/13*np.pi)+.00009*np.sin(k*1.9)
  start=len(vs)
  for j,t in enumerate(np.linspace(0,1,9)):
   point=root+np.array([side*(x-.028)*.030*t,-length*t,.00045*np.sin(t*np.pi/2)+.00012*t*t])
   radius=.000052*(1-.92*t)**1.1
   for r in range(3):
    angle=r*np.pi*2/3;vs.append(point+np.array([np.cos(angle)*radius,0,np.sin(angle)*radius]));uv.append([r/2,t])
  for j in range(8):
   for r in range(3):a=start+j*3+r;b=start+j*3+(r+1)%3;faces.append([a,b,b+3,a+3])
 D['meshes'].append({'name':'eyelashes_lower_detail_'+label,'vertices':np.array(vs).tolist(),'faces':faces,'face_uv':faces,'uvs':uv,'material':'hairfine','subdivision':0})
D['lower_lash_details']={'fibres_per_eye':12,'length_mm':[1.1,1.7],'physical_geometry':True}
# A fully symmetric face is retained; a single 3/4 photograph does not provide
# hidden-side geometry or exact measurements.
D['portrait_reference']='User portrait F1FC82B2: relaxed soft smile, less projecting rounded chin, natural facial transitions with retained layered long hair'
# Lip atlas dimensions are measured from the sculpted mouth region so the
# runtime tint follows the new geometry; the shader need not guess positions.
upper_indices=np.flatnonzero(np.linalg.norm(target('mouth-upperlip-volume-incr'),axis=1)>0)
lower_indices=np.flatnonzero(np.linalg.norm(target('mouth-lowerlip-volume-incr'),axis=1)>0)
lip_indices=np.union1d(upper_indices,lower_indices)
lip_vertices=body[lip_indices]
lip_visible=lip_vertices[(np.abs(lip_vertices[:,0])<.022)&(lip_vertices[:,2]>.123)]
lip_center_y=float((np.quantile(lip_visible[:,1],.12)+np.quantile(lip_visible[:,1],.88))*.5)
lip_center_z=float(np.quantile(lip_visible[:,2],.25))
D['appearance']={'lipCenter':[0,lip_center_y,lip_center_z],'lipWidth':.023,'lipHeight':.0095,'features':['short rounded chin with wider tip','soft flowing jaw transition','relaxed almond eyelids','soft nose bridge','rounded cupid bow and lower lip','natural closed-lip smile']}
visible_vertices=np.unique([i for f in D['meshes'][0]['faces'] for i in f])
face_vertices=visible_vertices[(old_body[visible_vertices,1]>1.35)&(old_body[visible_vertices,2]>.055)]
from scipy.spatial import cKDTree
mirrored=body[face_vertices].copy();mirrored[:,0]*=-1
symmetry=float(cKDTree(body[face_vertices]).query(mirrored)[0].max())
previous=json.loads((ROOT/'assets/refined/girl_portrait_source_v13.json').read_text());previous_body=np.asarray(previous['meshes'][0]['vertices'])
low=old_body[:,1]<1.35
finite=all(np.isfinite(np.asarray(m['vertices'])).all() for m in D['meshes'])
topology_unchanged=all(m['faces']==o['faces'] and m['uvs']==o['uvs'] and m['face_uv']==o['face_uv'] for m,o in zip(D['meshes'],previous['meshes']))
body_stable=bool(np.array_equal(body[low],old_body[low]))
head_rest_stable=bool(np.allclose(body[head_joint].mean(0),old_body[head_joint].mean(0),atol=1e-7))
assert finite and body_stable and topology_unchanged and head_rest_stable, (finite,body_stable,topology_unchanged,head_rest_stable)
assert symmetry<1e-7, f'Unexpected facial asymmetry {symmetry}'
report={'revision':24,'maximum_face_vertex_change_m':float(np.linalg.norm(body-old_body,axis=1).max()),'maximum_visible_change_from_v13_m':float(np.linalg.norm(body[face_vertices]-previous_body[face_vertices],axis=1).max()),'body_below_1_35_unchanged':body_stable,'head_rest_unchanged':head_rest_stable,'finite_vertices':finite,'topology_and_uv_unchanged':topology_unchanged,'maximum_mirrored_face_error_m':symmetry,'head_only_sculpt':True,'reference_views':1,'appearance':D['appearance'],'upper_lip_bounds':{'min':body[upper_indices].min(0).tolist(),'max':body[upper_indices].max(0).tolist()},'lower_lip_bounds':{'min':body[lower_indices].min(0).tolist(),'max':body[lower_indices].max(0).tolist()},'limitations':'Reference-guided proportions from two photographs, not a scan or an exact likeness reconstruction.'}
# Closed-lip smile: no oral surface and no teeth.
(ROOT/'assets/refined/girl_portrait_source_v25.json').write_text(json.dumps(D,separators=(',',':')))
(ROOT/'assets/refined/portrait_v25_report.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
