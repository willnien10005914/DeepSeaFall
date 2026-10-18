"""Build, export and studio-render the reference refined girl with Blender.

Portable invocation: scripts/run_refined_blender.sh
Quad topology, authored UVs/alpha hair, real subdivision, a continuous garment.
"""
from pathlib import Path
import bpy, json, math, sys, array, random
from mathutils import Vector, Matrix

ROOT=Path(__file__).resolve().parents[2]
DATA=json.loads((ROOT/'assets/refined/girl_quad_source.json').read_text())
TEX=ROOT/'assets/usd/textures'
OUT=ROOT/'assets/previews/v3';OUT.mkdir(exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)

def material(name,image=None,roughness=.5,alpha=False):
 m=bpy.data.materials.new(name);m.use_nodes=True
 nodes=m.node_tree.nodes;links=m.node_tree.links;p=nodes.get('Principled BSDF')
 p.inputs['Roughness'].default_value=roughness
 p.inputs['Metallic'].default_value=0
 if image:
  tex=nodes.new('ShaderNodeTexImage');tex.image=bpy.data.images.load(str(TEX/image),check_existing=True)
  links.new(tex.outputs['Color'],p.inputs['Base Color'])
  if alpha:
   links.new(tex.outputs['Alpha'],p.inputs['Alpha'])
   if hasattr(m,'surface_render_method'):m.surface_render_method='DITHERED'
   elif hasattr(m,'blend_method'):m.blend_method='HASHED'
   m.use_backface_culling=False
 return m,p

materials={}
skin,p=material('skin','skin_color.png',.49)
p.inputs['Subsurface Weight'].default_value=.11
p.inputs['Subsurface Radius'].default_value=(1.,.45,.22)
p.inputs['Subsurface Scale'].default_value=.0015
p.inputs['IOR'].default_value=1.4
materials['skin']=skin
for n,file in [('hair','groom_color.png'),('brows','brows_color.png'),('lashes','lashes_color.png')]:
 m,p=material(n,file,.55 if n in ['hair','fringe'] else .72,True)
 p.inputs['IOR'].default_value=1.45
 if n in ['hair','fringe']:
  p.inputs['Specular IOR Level'].default_value=.18
 if n in ['hair','fringe']:
  anisotropy=p.inputs.get('Anisotropic IOR Level') or p.inputs.get('Anisotropic')
  if anisotropy:anisotropy.default_value=.4
 materials[n]=m
cap,p=material('haircap',None,.72)
p.inputs['Base Color'].default_value=(.025,.012,.006,1)
p.inputs['Specular IOR Level'].default_value=.10
materials['haircap']=cap
eyes,p=material('eyes','eyes_color.png',.21,True)
p.inputs['Coat Weight'].default_value=.35;p.inputs['Coat Roughness'].default_value=.08
materials['eyes']=eyes
dress,p=material('dress',None,.83)
p.inputs['Base Color'].default_value=(.43,.48,.27,1)
p.inputs['Sheen Weight'].default_value=.35;p.inputs['Sheen Roughness'].default_value=.7
materials['dress']=dress

objects=[]
for source in DATA['meshes']:
 mesh=bpy.data.meshes.new(source['name'])
 mesh.from_pydata(source['vertices'],[],source['faces']);mesh.update()
 obj=bpy.data.objects.new(source['name'],mesh);bpy.context.collection.objects.link(obj)
 obj.data.materials.append(materials[source['material']]);objects.append(obj)
 uv=mesh.uv_layers.new(name='UVMap')
 uv_values=array.array('f',(component for indices in source['face_uv'] for tex_index in indices for component in source['uvs'][tex_index]))
 uv.data.foreach_set('uv',uv_values)
 mesh.polygons.foreach_set('use_smooth',[True]*len(mesh.polygons))
 if source['subdivision']:
  sub=obj.modifiers.new('Reference surface refinement','SUBSURF');sub.subdivision_type='CATMULL_CLARK'
  sub.levels=source['subdivision'];sub.render_levels=source['subdivision']
 if source['material']=='dress':
  thickness=obj.modifiers.new('Fabric edge thickness','SOLIDIFY');thickness.thickness=.0011;thickness.offset=0

# Export literal Y-up metre vertices; the runtime rig operates in the same coordinates.
bpy.ops.object.select_all(action='DESELECT')
for o in objects:o.select_set(True)
bpy.context.view_layer.objects.active=objects[0]
bpy.ops.export_scene.gltf(filepath=str(ROOT/'assets/usd/girl.glb'),export_format='GLB',use_selection=True,
 export_yup=False,export_apply=True,export_normals=True,export_materials='EXPORT',export_animations=False)

# The editable Blender file and studio scene use native Blender Z-up coordinates.
rotation=Matrix.Rotation(math.pi/2,4,'X')
for o in objects:o.matrix_world=rotation
bpy.context.view_layer.update()
bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
# The preview uses native hair curves; the exported game ribbons use these same guides.
for o in objects:
 if o.name in ['hair_swept','hair_fringe','hair_ponytail']:o.hide_render=True
hair_material=bpy.data.materials.new('Groomed brown hair');hair_material.use_nodes=True
hn=hair_material.node_tree.nodes;hn.clear()
hair_shader=hn.new('ShaderNodeBsdfHairPrincipled');hair_shader.parametrization='COLOR'
hair_shader.inputs['Color'].default_value=(.020,.009,.004,1)
hair_shader.inputs['Roughness'].default_value=.55
hair_shader.inputs['Radial Roughness'].default_value=.68
hair_shader.inputs['Coat'].default_value=.02
if hair_shader.inputs.get('Random Color'):hair_shader.inputs['Random Color'].default_value=.10
hair_output=hn.new('ShaderNodeOutputMaterial');hair_material.node_tree.links.new(hair_shader.outputs[0],hair_output.inputs['Surface'])
rng=random.Random(52);positions=array.array('f');widths=array.array('f');sizes=[]
for g in DATA['hair_guides']:
 points=[Vector(p) for p in g['points']]
 for strand in range(28):
  offset=(strand/27-.5)*g['width']
  phase=rng.uniform(0,math.tau);sizes.append(len(points))
  for i,p in enumerate(points):
   normal=Vector(g['normals'][i])
   direction=Vector(g['across'][i]);s=i/(len(points)-1)
   q=p+direction*(offset*(1-.75*s**7)+math.sin(s*13+phase)*.00028*s)
   q+=normal*(.0001+strand*.000020)
   positions.extend((q.x,-q.z,q.y));widths.append(.000037*(1-.84*s**4))
curves=bpy.data.hair_curves.new('Reference low ponytail and swept fringe')
curves.add_curves(sizes);curves.attributes['position'].data.foreach_set('vector',positions)
radius=curves.attributes.new('radius','FLOAT','POINT');radius.data.foreach_set('value',widths)
curves.materials.append(hair_material)
hair_object=bpy.data.objects.new('Fine groomed hair',curves);bpy.context.collection.objects.link(hair_object)
landmarks=bpy.data.collections.new('Reference rig landmarks');bpy.context.scene.collection.children.link(landmarks)
for j in DATA['rig']:
 o=bpy.data.objects.new('landmark_'+j['name'],None);landmarks.objects.link(o)
 x,y,z=j['position'];o.location=(x,-z,y);o.empty_display_type='SPHERE';o.empty_display_size=.008;o.hide_render=True

scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=48;scene.cycles.use_denoising=True
scene.cycles.max_bounces=8;scene.cycles.transparent_max_bounces=16
backend='CPU'
try:
 pref=bpy.context.preferences.addons['cycles'].preferences
 pref.compute_device_type='OPTIX';pref.get_devices()
 for d in pref.devices:d.use=d.type=='OPTIX'
 if any(d.type=='OPTIX' for d in pref.devices):scene.cycles.device='GPU';backend='OPTIX'
except Exception as e:print('Cycles CPU fallback',e)
scene.world=bpy.data.worlds.new('Neutral studio');scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.62,.60,.57,1)
scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.28

def area(name,position,target,power,size,color):
 data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=size;data.color=color
 o=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(o);o.location=position
 o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler()
area('Soft key',(-2.0,-3.0,3.4),(0,0,1),240,2.6,(1,.91,.83))
area('Fill',(2.8,-1.0,2.2),(0,0,1),150,2.4,(.82,.9,1))
area('Hair rim',(1,1.3,2.8),(0,0,1.25),130,1.8,(1,.91,.79))
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.004));floor=bpy.context.object;floor.name='Studio floor'
fm,p=material('Studio matte',None,.9);p.inputs['Base Color'].default_value=(.39,.38,.36,1);floor.data.materials.append(fm)
camera_data=bpy.data.cameras.new('Reference comparison camera');camera=bpy.data.objects.new('Reference comparison camera',camera_data)
bpy.context.collection.objects.link(camera);scene.camera=camera;camera_data.type='ORTHO'
scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast'
scene.render.image_settings.file_format='PNG';scene.render.film_transparent=False
camera.location=(0,-4,.84);camera.rotation_euler=(Vector((0,0,.84))-camera.location).to_track_quat('-Z','Y').to_euler()
camera_data.ortho_scale=1.79;scene.render.resolution_x=800;scene.render.resolution_y=1100
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/refined/girl_reference_v3.blend'))

views={
 'front':((0,-4,.84),(0,0,.84),1.79,800,1100),
 'side':((4,0,.84),(0,0,.84),1.79,800,1100),
 'back':((0,4,.84),(0,0,.84),1.79,800,1100),
 'portrait':((-.30,-.63,1.465),(0,-.06,1.45),.315,900,1100),
 'face-front':((0,-.8,1.465),(0,-.06,1.46),.305,900,1100),
}
requested=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else list(views)
for name in requested:
 pos,target,scale,w,h=views[name]
 camera.location=pos;camera.rotation_euler=(Vector(target)-camera.location).to_track_quat('-Z','Y').to_euler()
 camera_data.ortho_scale=scale;scene.render.resolution_x=w;scene.render.resolution_y=h
 scene.render.filepath=str(OUT/(name+'.png'))
 print('RENDER',name,'backend',backend,flush=True);bpy.ops.render.render(write_still=True)
(OUT/'render_info.json').write_text(json.dumps({'renderer':'Blender Cycles','backend':backend,'samples':scene.cycles.samples,'views':requested},indent=2))
print('Refined GLB, editable Blender source and studio captures complete',flush=True)
