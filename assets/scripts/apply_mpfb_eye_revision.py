from pathlib import Path
import sys,json,math,importlib
import bpy,addon_utils
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2]
repo=bpy.context.preferences.extensions.repos.new(name='DeepSea production extensions',module='deepsea',custom_directory=str(ROOT/'assets/extensions'))
addon_utils.enable('bl_ext.deepsea.mpfb',default_set=True)
mpfb=importlib.import_module('bl_ext.deepsea.mpfb')
TargetService=importlib.import_module('bl_ext.deepsea.mpfb.services.targetservice').TargetService
D=json.loads((ROOT/'assets/refined/girl_portrait_source_v24.json').read_text())
def smooth(v):
 v=max(0,min(1,v));return v*v*(3-2*v)
def offset(p):
 x,y,z=p;across=1-smooth((abs(abs(x)-.030)-.007)/.011)
 front=smooth((z-.103)/.018);vertical=math.exp(-((y-1.456)/.010)**4)*(1-smooth((y-1.465)/.005))
 sign=math.tanh((y-1.4558)/.0018)
 return (0,(.00165 if sign>=0 else .00085)*sign*across*front*vertical,0)
skin=D['meshes'][0];verts=skin['vertices'];native=[(x,-z,y) for x,y,z in verts]
mesh=bpy.data.meshes.new('MPFB portrait base');mesh.from_pydata(native,[],skin['faces']);mesh.update();obj=bpy.data.objects.new('MPFB eye opening revision',mesh);bpy.context.collection.objects.link(obj);bpy.context.view_layer.objects.active=obj;obj.select_set(True)
lines=[]
for i,p in enumerate(verts):
 d=offset(p)
 if abs(d[1])>1e-10:lines.append(f'{i} {d[0]:.10f} {d[1]:.10f} {d[2]:.10f}')
target=ROOT/'assets/refined/open-almond-eyes-v25.target';target.write_text('\n'.join(lines)+'\n')
key=TargetService.load_target(obj,str(target),weight=1.,name='Portrait eye aperture increase');bpy.context.view_layer.update()
# Keep an editable MPFB shape-key file as well as a baked game source.
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/refined/mpfb_eye_authoring_v25.blend'))
TargetService.bake_targets(obj)
skin['vertices']=[([v.co.x,v.co.z,-v.co.y] if abs(offset(verts[i])[1])>1e-10 else verts[i]) for i,v in enumerate(obj.data.vertices)]
for m in D['meshes'][1:]:
 if m['name']=='eyelashes' or m['name'].startswith('eyelashes_lower_detail'):
  m['vertices']=[[p[0],p[1]+offset(p)[1],p[2]] for p in m['vertices']]
 if m['name']=='eyebrows':
  m['vertices']=[[x,y+.00065*(1-smooth((abs(x)-.019)/.015)),z] for x,y,z in m['vertices']]
# Restore only covered thigh faces that were masked for the former rigid
# skirt pose. Deep knee flexion needs a continuous leg surface underneath.
oldfaces={tuple(sorted(f)) for f in skin['faces']};group='';restored=0
for line in (ROOT/'assets/sources/makehuman/base.obj').read_text().splitlines():
 bits=line.split()
 if not bits:continue
 if bits[0]=='g':group=bits[1]
 if bits[0]=='f' and group=='body':
  indices=[int(v.split('/')[0])-1 for v in bits[1:]];uvs=[int(v.split('/')[1])-1 for v in bits[1:]]
  pts=[skin['vertices'][i] for i in indices];key=tuple(sorted(indices))
  if key not in oldfaces and min(v[1] for v in pts)>.360 and max(v[1] for v in pts)<.815 and sum(abs(v[0]) for v in pts)/len(pts)>.020:
   skin['faces'].append(indices);skin['face_uv'].append(uvs);oldfaces.add(key);restored+=1
D['restored_covered_thigh_faces']=restored
D['extension_revision']={'addon':'MPFB','version':list(mpfb.VERSION),'operation':'TargetService.load_target + bake_targets','eye_aperture':'upper lid lift and lower lid relaxation; eyeball dimensions preserved','target_vertices':len(lines)}
(ROOT/'assets/refined/girl_portrait_source_v25.json').write_text(json.dumps(D,separators=(',',':')))
(ROOT/'assets/refined/portrait_v25_report.json').write_text(json.dumps(D['extension_revision'],indent=2))
addon_utils.enable('rigify',default_set=True)
bpy.ops.object.armature_basic_human_metarig_add();meta=bpy.context.object
bpy.ops.pose.rigify_generate();rig=bpy.context.object
print('RIGIFY_CONTROLS',rig.name,[b.name for b in rig.pose.bones if any(s in b.name for s in ['_fk','hips','chest','torso'])][:45],flush=True)
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/refined/rigify_swim_controls_v25.blend'))
print('MPFB_EYE_REVISION_DONE',len(lines),flush=True)
