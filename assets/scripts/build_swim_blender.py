"""Reference-fit surfaces + editable nineteen-bone Blender swim actions.
Exported local quaternion samples use the same Y-up rest basis as the game.
The reference is analysed visually, not represented as motion-capture data.
"""
from pathlib import Path
import bpy,json,math,array
from mathutils import Vector,Quaternion,Euler,Matrix
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'assets/animation';OUT.mkdir(exist_ok=True)
DATA=json.loads((ROOT/'assets/refined/girl_quad_source.json').read_text())
rig=DATA['rig'];rest0={j['name']:Vector(j['position']) for j in rig}

def smooth(a,b,t):
 x=max(0,min(1,(t-a)/(b-a)));return x*x*(3-2*x)
def fitted(p,name):
 p=Vector(p);y=p.y
 if y>=1.335:return p
 # Slim the limbs around their centre lines, retaining hand/foot anatomy.
 if name=='skin_body' and .84<y<1.285 and abs(p.x)>.17:
  side='l_' if p.x>0 else 'r_';best=None
  for a,b in [('shoulder','elbow'),('elbow','wrist')]:
   v=rest0[side+b]-rest0[side+a];t=max(0,min(1,(p-rest0[side+a]).dot(v)/v.length_squared));c=rest0[side+a]+v*t;dist=(p-c).length_squared
   if best is None or dist<best[0]:best=(dist,c)
  c=best[1];new_c=c.copy();new_c.x*=.96
  taper=.90 if (p-rest0[side+'wrist']).length>.075 else .97
  return new_c+(p-c)*taper
 if name=='skin_body' and y<.81:
  side='l_' if p.x>0 else 'r_';a='thigh' if y>.435 else 'knee';b='knee' if y>.435 else 'ankle'
  v=rest0[side+b]-rest0[side+a];t=max(0,min(1,(p-rest0[side+a]).dot(v)/v.length_squared));c=rest0[side+a]+v*t;nc=c.copy();nc.x*=.96
  taper=.91+.09*(1-smooth(.025,.13,y));q=nc+(p-c)*taper;q.y=p.y;return q
 width=.94-.035*math.exp(-((y-.985)/.125)**2)
 if name.startswith('dress'):
  width=.97-.06*math.exp(-((y-.985)/.15)**2)
 p.x*=width
 p.z=.015+(p.z-.015)*(.965-.025*math.exp(-((y-1.05)/.18)**2))
 return p
for m in DATA['meshes']:m['vertices']=[list(fitted(p,m['name'])) for p in m['vertices']]
for j in rig:
 if j['name'].startswith(('l_','r_')):j['position'][0]*=.96
(ROOT/'assets/refined/girl_swim_source_v8.json').write_text(json.dumps(DATA,separators=(',',':')))
(ROOT/'js/three/rig-data.js').write_text('export const rigData = '+json.dumps(rig)+';\n')
# Reuse the established UV/material/subdivision builder, skipping old renders.
# A local DATA literal replaces its loader; the exported GLB stays metre Y-up.
source=(ROOT/'assets/scripts/build_refined_girl_blender.py').read_text()
source=source[:source.index('# The editable Blender file')]
source=source.replace("DATA=json.loads((ROOT/'assets/refined/girl_quad_source.json').read_text())", "DATA=json.loads((ROOT/'assets/refined/girl_swim_source_v8.json').read_text())")
source=source.replace("p.inputs['Subsurface Weight'].default_value=.11","p.inputs['Subsurface Weight'].default_value=.14")
source=source.replace("p.inputs['Base Color'].default_value=(.43,.48,.27,1)","p.inputs['Base Color'].default_value=(.49,.54,.34,1)")
exec(compile(source,str(__file__),'exec'),globals())
OUT=ROOT/'assets/animation';OUT.mkdir(exist_ok=True)
# Add a pore-scale bump and woven cloth texture to the Blender source, with
# the matching maps also used by the real-time physical materials.
rotation=Matrix.Rotation(math.pi/2,4,'X')
for o in objects:o.matrix_world=rotation
bpy.context.view_layer.update()
bpy.ops.object.select_all(action='DESELECT')
for o in objects:o.select_set(True)
bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)

def bump(material,file,strength,distance,repeat=1):
 nodes=material.node_tree.nodes;links=material.node_tree.links;p=nodes.get('Principled BSDF')
 t=nodes.new('ShaderNodeTexImage');t.image=bpy.data.images.load(str(TEX/file));t.image.colorspace_settings.name='Non-Color'
 if repeat!=1:
  uv=nodes.new('ShaderNodeTexCoord');mapping=nodes.new('ShaderNodeVectorMath');mapping.operation='SCALE';mapping.inputs[3].default_value=repeat;links.new(uv.outputs['UV'],mapping.inputs[0]);links.new(mapping.outputs[0],t.inputs['Vector'])
 b=nodes.new('ShaderNodeBump');b.inputs['Strength'].default_value=strength;b.inputs['Distance'].default_value=distance
 links.new(t.outputs['Color'],b.inputs['Height']);links.new(b.outputs['Normal'],p.inputs['Normal'])
bump(materials['skin'],'skin_micro_height.png',.18,.00020)
bump(materials['dress'],'dress_weave_height.png',.30,.00032,16)
rest={j['name']:Vector(j['position']) for j in rig};parents={j['name']:j['parent'] for j in rig}
arm=bpy.data.armatures.new('Swimmer nineteen-bone rest rig');actor=bpy.data.objects.new('Girl swim armature',arm);bpy.context.collection.objects.link(actor)
bpy.context.view_layer.objects.active=actor;actor.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
for j in rig:
 b=arm.edit_bones.new(j['name']);x,y,z=j['position'];b.head=(x,-z,y);b.tail=(x,-z,y+.045)
 if j['parent']:b.parent=arm.edit_bones[j['parent']]
bpy.ops.object.mode_set(mode='OBJECT');actor.show_in_front=True
# Rest basis maps Blender Z-up to runtime Y-up without modifying quaternions.
for o in objects:
 groups={j['name']:o.vertex_groups.new(name=j['name']) for j in rig}
 for v in o.data.vertices:
  p=Vector((v.co.x,v.co.z,-v.co.y))
  if any(word in o.name for word in ['hair','eyes','eyebrow','eyelash']):candidates=[('head',1)]
  elif p.y>1.35:candidates=[('head',1)]
  elif o.name=='dress_skirt' and p.y<.99:candidates=[('hips',1)]
  else:
   candidates=[];is_arm=o.name=='skin_body' and .80<p.y<1.29 and abs(p.x)>.155
   side='r_' if p.x<0 else 'l_'
   for j in rig:
    n=j['name']
    if is_arm and not(n.startswith(side) and any(k in n for k in ['shoulder','elbow','wrist'])):continue
    if not is_arm and p.y<.82 and n!='hips' and not(n.startswith(side) and any(k in n for k in ['thigh','knee','ankle','foot'])):continue
    if not is_arm and .82<=p.y<=1.36 and abs(p.x)<.15 and n.startswith(('r_','l_')):continue
    child=next((k['name'] for k in rig if k['parent']==n and 'shoulder' not in k['name'] and 'thigh' not in k['name']),n)
    ab=rest[child]-rest[n];t=max(0,min(1,(p-rest[n]).dot(ab)/ab.length_squared)) if ab.length_squared else 0
    dist=(p-rest[n]-ab*t).length_squared;candidates.append((n,1/(dist+.001)**2))
   candidates=sorted(candidates,key=lambda c:-c[1])[:4]
  total=sum(w for _,w in candidates)
  for n,w in candidates:groups[n].add([v.index],w/total,'REPLACE')
 modifier=o.modifiers.new('Swimmer skinning','ARMATURE');modifier.object=actor;o.parent=actor

# Quaternion authoring with two-bone analytic IK, then sampled by Blender.
def euler(x=0,y=0,z=0):return Euler((x,y,z),'XYZ').to_quaternion()
def fk(quats):
 pos={};world={}
 for j in rig:
  n=j['name'];parent=j['parent']
  if parent:pos[n]=pos[parent]+world[parent]@(rest[n]-rest[parent]);world[n]=world[parent]@quats[n]
  else:pos[n]=rest[n].copy();world[n]=quats[n].copy()
 return pos,world

def reach(quats,prefix,target,pole):
 pos,world=fk(quats);n=prefix+'shoulder';en=prefix+'elbow';wn=prefix+'wrist';a=pos[n]
 l1=(rest[en]-rest[n]).length;l2=(rest[wn]-rest[en]).length
 axis=target-a;distance=max(abs(l1-l2)+.002,min(axis.length,l1+l2-.002));axis.normalize()
 along=(l1*l1+distance*distance-l2*l2)/(2*distance);height=math.sqrt(max(0,l1*l1-along*along))
 cross=pole-a;cross-=axis*cross.dot(axis)
 if cross.length<1e-8:cross=Vector((1,0,0))
 cross.normalize();elbow=a+axis*along+cross*height
 parent=parents[n];desired=world[parent].inverted()@(elbow-a).normalized()
 quats[n]=(rest[en]-rest[n]).normalized().rotation_difference(desired)
 pos,world=fk(quats);desired=world[n].inverted()@(target-pos[en]).normalized()
 quats[en]=(rest[wn]-rest[en]).normalized().rotation_difference(desired)

def path(points,t):
 n=len(points);u=(t%1)*n;i=int(u);s=u-i;p0,p1,p2,p3=[Vector(points[k%n]) for k in [i-1,i,i+1,i+2]]
 return .5*((2*p1)+(-p0+p2)*s+(2*p0-5*p1+4*p2-p3)*s*s+(-p0+3*p1-3*p2+p3)*s*s*s)
BREAST=[(.10,1.55,.12),(.23,1.45,.25),(.43,1.26,.20),(.36,1.04,-.04),(.16,1.05,.03),(.10,1.33,.15)]
FLUTTER=[(.12,1.55,.10),(.22,1.40,.29),(.43,1.17,.15),(.28,1.02,-.10),(.13,1.20,-.16)]

def pose(name,t):
 q={j['name']:Quaternion((1,0,0,0)) for j in rig};phase=t*math.tau;wave=math.sin(phase);pulse=.5-.5*math.cos(phase)
 tilt={'breaststroke':-.63,'flutter':-.50,'glide':-1.03,'dive':-.20,'turn':-.30,'reach':-.15,'evade':-.55,'float':0}[name]
 roll=-2.40 if name=='dive' else .50*pulse if name=='turn' else .32*wave if name=='evade' else 0
 q['hips']=euler(tilt,.65*pulse if name=='turn' else .035*wave,roll)
 q['spine']=euler(.03*wave,.035*wave,.025*wave)
 q['chest']=euler(.025*math.sin(phase-.6),.08*wave if name=='flutter' else .045*wave,0)
 q['neck']=euler(-.06 if name!='float' else 0,0,0);q['head']=euler(.03*wave,.06*wave,0)
 for prefix,side in [('l_',1),('r_',-1)]:
  target=path(BREAST,t) if name=='breaststroke' else path(FLUTTER,t+(0 if side>0 else .5))
  target.x*=side
  if name=='glide':target=Vector((side*.10,1.55,.12))
  if name=='dive':target=Vector((side*(.29+.05*wave),1.17+.035*wave,.02))
  if name=='turn':target=Vector((side*(.25+.10*side*pulse),1.19+.10*side*pulse,.10*side*pulse))
  if name=='evade':target=Vector((side*(.38+.045*wave),1.19+.10*wave,.10))
  if name=='reach':target=Vector((.26,1.35+.015*wave,.31)) if side>0 else Vector((-.29,1.10+.03*wave,.06))
  if name=='float':
   q[prefix+'shoulder']=euler(.035*wave,0,side*.025*wave);q[prefix+'elbow']=euler(.045*pulse,0,0)
  else:
   target=rest['hips']+q['hips']@(target-rest['hips']);pole=rest['hips']+q['hips']@(Vector((side*.67,1.08,-.045))-rest['hips'])
   reach(q,prefix,target,pole);q[prefix+'wrist']=euler(.15*math.sin(phase+.3),side*.08,side*.12*wave)
  kick=math.sin(phase+(math.pi if side<0 else 0));frog=max(0,math.sin(phase-1.2))
  if name=='breaststroke':thigh=-.14+.58*frog;knee=.08+1.00*frog;splay=.26*frog;ankle=-.28+.35*frog
  elif name in ['flutter','evade']:thigh=.28*kick;knee=.16+max(0,-kick)*.56;splay=.025;ankle=-.30+.08*kick
  elif name=='turn':thigh=.30*pulse;knee=.14+.65*pulse;splay=.06;ankle=-.28
  elif name=='reach':thigh=.16*kick;knee=.18+.22*max(0,-kick);splay=.04;ankle=-.25
  elif name=='float':thigh=.025*kick;knee=.03*pulse;splay=0;ankle=-.03
  else:thigh=.07*kick;knee=.08+.09*max(0,-kick);splay=.02;ankle=-.28
  q[prefix+'thigh']=euler(thigh,0,side*splay);q[prefix+'knee']=euler(knee,0,0);q[prefix+'ankle']=euler(ankle,0,0)
 return q

scene=bpy.context.scene;scene.render.fps=30
clips={};actor.animation_data_create()
for name,duration in [('breaststroke',3.8),('flutter',3.2),('glide',4.0),('dive',4.0),('turn',4.0),('reach',4.0),('evade',2.4),('float',5.0)]:
 actor.animation_data.action=bpy.data.actions.new('Swim_'+name);frames=round(duration*30);samples=[]
 for frame in range(frames+1):
  quats=pose(name,frame/frames);row=[];scene.frame_set(frame)
  for j in rig:
   b=actor.pose.bones[j['name']];b.rotation_mode='QUATERNION';b.rotation_quaternion=quats[j['name']]
   b.keyframe_insert(data_path='rotation_quaternion',frame=frame,group=j['name'])
  bpy.context.view_layer.update()
  for j in rig:
   q=actor.pose.bones[j['name']].rotation_quaternion.normalized();row.extend([round(q.x,6),round(q.y,6),round(q.z,6),round(q.w,6)])
  samples.append(row)
 # Preserve all actions in NLA; the exported data below is sampled Blender poses.
 action=actor.animation_data.action;action.use_fake_user=True
 track=actor.animation_data.nla_tracks.new();track.name=name;strip=track.strips.new(name,0,action);strip.mute=True
 clips[name]={'duration':duration,'fps':30,'frames':samples}
actor.animation_data.action=bpy.data.actions['Swim_breaststroke'];scene.frame_start=0;scene.frame_end=114;scene.frame_set(0)
scene.world=bpy.data.worlds.new('Swim authoring world');scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.12,.18,.24,1)
# Native curves refine the visible ponytail; same ribbons are retained in game.
# Editable mesh, armature and cloth remain available for further artist work.
bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/refined/girl_swim_v8.blend'))
export={'version':8,'source':'Blender '+bpy.app.version_string+' authored analytic IK and sampled action keyframes','reference':'https://www.youtube.com/watch?v=lQ8CXVkkCdw','basis':'Y-up metres, local quaternion XYZW, nineteen-bone rest rig','bones':[j['name'] for j in rig],'clips':clips}
(OUT/'swim-clips.json').write_text(json.dumps(export,separators=(',',':')))
(ROOT/'js/three/swim-clips.js').write_text('export const swimClips='+json.dumps(export,separators=(',',':'))+';\n')
(OUT/'blender-export-report.json').write_text(json.dumps({'reference':export['reference'],'actions':list(clips),'bones':19,'sample_rate':30,'frames':sum(len(c['frames']) for c in clips.values()),'body_fit':'localized shoulder/waist and limb centre-line sculpt; head preserved','motion':'visually authored finless strokes, not extracted mocap','editable_file':'assets/refined/girl_swim_v8.blend'},indent=2))
print('BLENDER_SWIM_EXPORT',list(clips),'complete',flush=True)
