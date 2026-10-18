from pathlib import Path
import bpy,addon_utils,json,math
from mathutils import Quaternion,Euler,Matrix
ROOT=Path(__file__).resolve().parents[2]
addon_utils.enable('rigify',default_set=True)
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'assets/refined/rigify_swim_controls_v28.blend'),use_scripts=True)
r=bpy.data.objects['rig'];bpy.context.view_layer.objects.active=r
for side in ['L','R']:
 for part in ['upper_arm','thigh']:r.pose.bones[f'{part}_parent.{side}']['IK_FK']=1.
mapping={'hips':('hips','DEF-spine'),'spine':('spine_fk.001','DEF-spine.001'),'chest':('chest','DEF-spine.003'),'neck':(None,'DEF-spine.004'),'head':(None,'DEF-spine.006')}
for prefix,side in [('l_','L'),('r_','R')]:
 for joint,ctrl,df in [('shoulder','upper_arm_fk','upper_arm'),('elbow','forearm_fk','forearm'),('wrist','hand_fk','hand'),('thigh','thigh_fk','thigh'),('knee','shin_fk','shin'),('ankle','foot_fk','foot'),('foot',None,'toe')]:mapping[prefix+joint]=(f'{ctrl}.{side}' if ctrl else None,f'DEF-{df}.{side}')
DATA=json.loads((ROOT/'assets/animation/swim-clips.json').read_text());bones=DATA['bones'];source=json.loads((ROOT/'assets/refined/girl_portrait_source_v28.json').read_text());parents={j['name']:j['parent'] for j in source['rig']}
rot=Matrix.Rotation(math.pi/2,4,'X').to_quaternion()
def reset():
 for p in r.pose.bones:p.rotation_mode='QUATERNION';p.rotation_quaternion=Quaternion((1,0,0,0));p.location=(0,0,0);p.scale=(1,1,1)
reset();bpy.context.view_layer.update();baseline={n:(r.pose.bones[df].matrix@r.data.bones[df].matrix_local.inverted()).to_quaternion() for n,(_,df) in mapping.items()}
def q(x=0,y=0,z=0):return Euler((x,y,z),'XYZ').to_quaternion()
def pose(name,t):
 pulse=.5-.5*math.cos(t*math.tau);wave=math.sin(t*math.tau)
 out={n:q() for n in bones};out['hips']=q(-.55);out['spine']=q(.05*wave);out['chest']=q(-.03*wave)
 if name=='tuck':out['hips']=q(-.38);out['spine']=q(.26+.18*pulse);out['chest']=q(.15+.12*pulse)
 if name=='extend':out['hips']=q(-.93);out['spine']=q(-.06-.06*pulse);out['chest']=q(-.08)
 if name=='roll':out['hips']=q(-.65,.30*wave,.62*wave);out['spine']=q(.08,.18*wave);out['chest']=q(.06,-.12*wave)
 if name=='dolphin':out['hips']=q(-.82+.16*wave);out['spine']=q(.20*math.sin(t*math.tau-.6));out['chest']=q(-.17*math.sin(t*math.tau-1.1))
 for prefix,side in [('l_',1),('r_',-1)]:
  if name=='tuck':
   out[prefix+'shoulder']=q(-.80,side*-.23,side*-.18);out[prefix+'elbow']=q(-.85,side*-.65,side*.15)
   out[prefix+'thigh']=q(-.90-.38*pulse,0,side*.06);out[prefix+'knee']=q(1.55+.35*pulse);out[prefix+'ankle']=q(-.25)
  else:
   arm=2.05 if name in ['extend','dolphin'] else .82
   out[prefix+'shoulder']=q(-.12,side*.03,side*(arm+.10*wave));out[prefix+'elbow']=q(.09+.08*pulse);out[prefix+'wrist']=q(-.12)
   out[prefix+'thigh']=q((.25*wave if name=='dolphin' else .05*wave));out[prefix+'knee']=q(.08+(.38*max(0,-wave) if name=='dolphin' else .10*pulse));out[prefix+'ankle']=q(-.23)
 return out
r.animation_data_create();newclips={};scene=bpy.context.scene;scene.render.fps=30
for name,duration in [('tuck',2.8),('extend',3.6),('roll',3.2),('dolphin',3.)]:
 action=bpy.data.actions.new('Rigify_Swim_'+name);r.animation_data.action=action;action.use_fake_user=True;samples=[];count=round(duration*30)
 for f in range(count+1):
  scene.frame_set(f);reset();desired=pose(name,f/count)
  for n,(ctrl,df) in mapping.items():
   if ctrl:
    bone=r.pose.bones[ctrl];basis=r.data.bones[ctrl].matrix_local.to_quaternion();world=rot@desired[n]@rot.inverted();bone.rotation_quaternion=basis.inverted()@world@basis;bone.keyframe_insert(data_path='rotation_quaternion',frame=f)
  bpy.context.view_layer.update();delta={n:(r.pose.bones[df].matrix@r.data.bones[df].matrix_local.inverted()).to_quaternion()@baseline[n].inverted() for n,(_,df) in mapping.items()};row=[]
  for n in bones:
   parent=parents[n];local=(delta[parent].inverted()@delta[n]) if parent else delta[n];value=(rot.inverted()@local@rot).normalized();row.extend([round(value.x,7),round(value.y,7),round(value.z,7),round(value.w,7)])
  samples.append(row)
 newclips[name]={'duration':duration,'fps':30,'frames':samples,'source':'Rigify evaluated deform bones, retargeted to swimmer'}
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/refined/rigify_swim_controls_v28.blend'))
DATA['clips'].update(newclips);DATA['version']=25;DATA['extension']='Blender Rigify';DATA['source']='Existing Blender actions plus Rigify-evaluated tuck, extension, roll and dolphin actions'
(ROOT/'assets/animation/swim-clips.json').write_text(json.dumps(DATA,separators=(',',':')));(ROOT/'js/three/swim-clips.js').write_text('export const swimClips='+json.dumps(DATA,separators=(',',':'))+';\n')
control_count=len(r.pose.bones)
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'assets/refined/girl_swim_v28.blend'));actor=bpy.data.objects['Girl swim armature'];actor.animation_data_create()
for name,clip in newclips.items():
 action=bpy.data.actions.new('Swim_'+name);action.use_fake_user=True;actor.animation_data.action=action
 for f,row in enumerate(clip['frames']):
  for i,n in enumerate(bones):p=actor.pose.bones[n];p.rotation_mode='QUATERNION';x,y,z,w=row[i*4:i*4+4];p.rotation_quaternion=(w,x,y,z);p.keyframe_insert(data_path='rotation_quaternion',frame=f,group=n)
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/refined/girl_swim_v28.blend'))
(ROOT/'assets/animation/rigify-v28-report.json').write_text(json.dumps({'extension':'Rigify','rig_controls':control_count,'actions':list(newclips),'sample_rate':30,'frames':sum(len(c['frames']) for c in newclips.values()),'retarget':'evaluated DEF world deltas -> swimmer parent-local XYZW'},indent=2))
print('RIGIFY_SWIM_BAKED',list(newclips))
