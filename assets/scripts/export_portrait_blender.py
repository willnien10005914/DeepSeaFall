from pathlib import Path
import bpy,json,math,array
from mathutils import Matrix
ROOT=Path(__file__).resolve().parents[2]
source=(ROOT/'assets/scripts/build_refined_girl_blender.py').read_text().split('# The editable Blender file')[0]
source=source.replace('girl_quad_source.json','girl_portrait_hair_v29.json')
source=source.replace("cap,p=material('haircap',None,.72)","cap,p=material('haircap','groom_foundation.png',.64,True)")
source=source.replace('(.025,.012,.006,1)','(1,1,1,1)').replace("p.inputs['Specular IOR Level'].default_value=.10","p.inputs['Specular IOR Level'].default_value=.28")
source=source.replace('(.43,.48,.27,1)','(.49,.54,.34,1)').replace('default_value=.11','default_value=.14')
source=source.replace('objects=[]',"fine,p=material('hairfine',None,.53);p.inputs['Base Color'].default_value=(.0008,.0006,.0007,1);p.inputs['Specular IOR Level'].default_value=.30;materials['hairfine']=fine\nobjects=[]")
source=source.replace('objects=[]',"line,p=material('hairlinecap','groom_scalp.png',.55,True);p.inputs['Specular IOR Level'].default_value=.25;materials['hairlinecap']=line\noral,p=material('oral',None,.78);p.inputs['Base Color'].default_value=(.047,.012,.016,1);materials['oral']=oral\nobjects=[]")
source=source.replace("mesh.from_pydata(source['vertices'],[],source['faces']);mesh.update()", "mesh.from_pydata(source['vertices'],[],source['faces']);mesh.update()\n if 'portrait_masks' in source:\n  attr=mesh.color_attributes.new(name='PortraitLipMask',type='FLOAT_COLOR',domain='POINT')\n  attr.data.foreach_set('color',array.array('f',(v for row in source['portrait_masks'] for v in [*row,1.])))")
source=source.replace("export_animations=False)","export_animations=False,export_vertex_color='NAME',export_vertex_color_name='PortraitLipMask',export_all_vertex_colors=False)")
source=source.replace("if source['subdivision']:","if source['subdivision'] and source['material']!='dress':")
source=source.replace("if source['material']=='dress':","if False and source['material']=='dress':")
exec(compile(source,str(__file__),'exec'),globals())
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/refined/portrait_reference_v29.blend'))
D=json.loads((ROOT/'assets/refined/girl_portrait_hair_v29.json').read_text());bpy.ops.wm.open_mainfile(filepath=str(ROOT/'assets/refined/girl_swim_v13.blend'))
actor=bpy.data.objects.get('Girl swim armature');rotation=Matrix.Rotation(math.pi/2,4,'X')
# Update face vertex positions in place, preserving topology, UVs and groups.
for entry in D['meshes']:
 if entry['name'].startswith('hair'):continue
 obj=bpy.data.objects.get(entry['name'])
 if obj and entry['name'] in ['skin_body','eyes','eyebrows','eyelashes']:
  assert len(obj.data.vertices)==len(entry['vertices'])
  for v,p in zip(obj.data.vertices,entry['vertices']):v.co=rotation@__import__('mathutils').Vector(p)
  if entry['name']=='skin_body':
   import bmesh
   bm=bmesh.new();bm.from_mesh(obj.data);bm.verts.ensure_lookup_table();layer=bm.loops.layers.uv.verify();existing={tuple(sorted(v.index for v in f.verts)) for f in bm.faces}
   for ids,texids in zip(entry['faces'],entry['face_uv']):
    key=tuple(sorted(ids))
    if key in existing:continue
    f=bm.faces.new([bm.verts[i] for i in ids]);existing.add(key)
    for loop,ti in zip(f.loops,texids):loop[layer].uv=entry['uvs'][ti]
   bm.to_mesh(obj.data);bm.free()
  obj.data.update()
  if 'portrait_masks' in entry:
   old=obj.data.color_attributes.get('PortraitLipMask')
   if old:obj.data.color_attributes.remove(old)
   attr=obj.data.color_attributes.new(name='PortraitLipMask',type='FLOAT_COLOR',domain='POINT')
   attr.data.foreach_set('color',array.array('f',(v for row in entry['portrait_masks'] for v in [*row,1.])))
# Keep the editable garment topology aligned with the runtime contact surface.
for entry in D['meshes']:
 if not entry['name'].startswith('dress'):continue
 old=bpy.data.objects.get(entry['name']);material=old.data.materials[0] if old else None
 if old:bpy.data.objects.remove(old,do_unlink=True)
 mesh=bpy.data.meshes.new(entry['name']);mesh.from_pydata(entry['vertices'],[],entry['faces']);mesh.update();obj=bpy.data.objects.new(entry['name'],mesh);bpy.context.collection.objects.link(obj)
 if material:mesh.materials.append(material)
 uv=mesh.uv_layers.new(name='UVMap');uv.data.foreach_set('uv',array.array('f',(c for face in entry['face_uv'] for ti in face for c in entry['uvs'][ti])));mesh.polygons.foreach_set('use_smooth',[True]*len(mesh.polygons));mesh.transform(rotation)
 groups={j['name']:obj.vertex_groups.new(name=j['name']) for j in D['rig']}
 for i,(x,y,z) in enumerate(entry['vertices']):
  if entry['name'].startswith('dress_strap'):weights={'chest':1.}
  elif y<.99:
   t=max(0,min(1,(.98-y-.02)/.11));leg=t*t*(3-2*t);u=max(0,min(1,(x+.045)/.09));left=u*u*(3-2*u);weights={'hips':1-leg,'l_thigh':leg*left,'r_thigh':leg*(1-left)}
  else:
   rows=[]
   for j in D['rig']:
    if j['name'] not in ['hips','spine','chest','neck','head']:continue
    child=next((k for k in D['rig'] if k['parent']==j['name'] and not any(a in k['name'] for a in ['shoulder','thigh'])),j)
    a=__import__('mathutils').Vector(j['position']);b=__import__('mathutils').Vector(child['position']);v=__import__('mathutils').Vector((x,y,z));ab=b-a;t=max(0,min(1,(v-a).dot(ab)/ab.length_squared)) if ab.length_squared else 0;rows.append((j['name'],1/((v-(a+ab*t)).length_squared+.001)**2))
   rows=sorted(rows,key=lambda q:-q[1])[:4];total=sum(w for n,w in rows);weights={n:w/total for n,w in rows}
  for n,w in weights.items():
   if w>0:groups[n].add([i],w,'REPLACE')
 modifier=obj.modifiers.new('Garment skinning','ARMATURE');modifier.object=actor;obj.parent=actor

for obj in list(bpy.data.objects):
 if obj.name.startswith('hair'):bpy.data.objects.remove(obj,do_unlink=True)
TEX=ROOT/'assets/usd/textures'
def mat(name,file=None,alpha=False):
 m=bpy.data.materials.new(name);m.use_nodes=True;nodes=m.node_tree.nodes;links=m.node_tree.links;p=nodes.get('Principled BSDF');p.inputs['Roughness'].default_value=.62
 if file:
  tex=nodes.new('ShaderNodeTexImage');tex.image=bpy.data.images.load(str(TEX/file),check_existing=True);links.new(tex.outputs['Color'],p.inputs['Base Color'])
  if alpha:links.new(tex.outputs['Alpha'],p.inputs['Alpha']);m.surface_render_method='DITHERED'
 else:p.inputs['Base Color'].default_value=(.0008,.0006,.0007,1)
 return m
materials={'hair':mat('Fine dark layered fibre cards','groom_color.png',True),'haircap':mat('Dark straight hair underfill','groom_foundation.png',True),'hairfine':mat('Individual fine dark strands'),'hairlinecap':mat('Feathered natural hairline','groom_scalp.png',True),'oral':mat('Recessed mouth')}
materials['oral'].node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=(.047,.012,.016,1)
for entry in D['meshes']:
 if not(entry['name'].startswith('hair') or entry['name'].startswith('lip_') or entry['name'].startswith('eyelashes_lower_detail_')):continue
 mesh=bpy.data.meshes.new(entry['name']);mesh.from_pydata(entry['vertices'],[],entry['faces']);mesh.update();obj=bpy.data.objects.new(entry['name'],mesh);bpy.context.collection.objects.link(obj);mesh.materials.append(materials[entry['material']])
 uv=mesh.uv_layers.new(name='UVMap');uv.data.foreach_set('uv',array.array('f',(x for indices in entry['face_uv'] for tex_index in indices for x in entry['uvs'][tex_index])));mesh.polygons.foreach_set('use_smooth',[True]*len(mesh.polygons));mesh.transform(rotation)
 if entry['subdivision']:sub=obj.modifiers.new('Hair volume refinement','SUBSURF');sub.levels=entry['subdivision']
 groups={n:obj.vertex_groups.new(name=n) for n in ['head','chest','spine']}
 for i,p in enumerate(entry['vertices']):
  y=p[1];long='long' in entry['name'];head=max(0,min(1,(y-1.29)/.14)) if long else 1;chest=(1-head)*max(0,min(1,(y-1.10)/.19));spine=1-head-chest
  for n,w in [('head',head),('chest',chest),('spine',spine)]:
   if w>0:groups[n].add([i],w,'REPLACE')
 modifier=obj.modifiers.new('Head and torso hair attachment','ARMATURE');modifier.object=actor;obj.parent=actor
bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/refined/girl_swim_v29.blend'))
print('Portrait face and layered long-hair GLB / eight-action Blender rig saved')
