from pathlib import Path
import bpy,json,math,array
from mathutils import Matrix
ROOT=Path(__file__).resolve().parents[2]
source=(ROOT/'assets/scripts/build_refined_girl_blender.py').read_text().split('# The editable Blender file')[0]
source=source.replace("girl_quad_source.json","girl_hair_source_v10.json")
source=source.replace("cap,p=material('haircap',None,.72)","cap,p=material('haircap','groom_foundation.png',.58,True)")
source=source.replace("(.025,.012,.006,1)","(1,1,1,1)").replace("p.inputs['Specular IOR Level'].default_value=.10","p.inputs['Specular IOR Level'].default_value=.25")
source=source.replace("(.43,.48,.27,1)","(.49,.54,.34,1)").replace("default_value=.11","default_value=.14")
exec(compile(source,str(__file__),'exec'),globals())
# Save a stand-alone editable groom source; the rigged source below keeps
# all eight swim actions and the existing character skinning unchanged.
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/refined/hair_reference_v10.blend'))
DATA=json.loads((ROOT/'assets/refined/girl_hair_source_v10.json').read_text())
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'assets/refined/girl_swim_v8.blend'))
actor=bpy.data.objects.get('Girl swim armature')
for obj in list(bpy.data.objects):
 if obj.name.startswith('hair'):bpy.data.objects.remove(obj,do_unlink=True)
# New materials embed both fibre atlas and volume foundation colour.
TEX=ROOT/'assets/usd/textures'
def mat(name,file,alpha=False):
 material=bpy.data.materials.new(name);material.use_nodes=True;nodes=material.node_tree.nodes;links=material.node_tree.links;p=nodes.get('Principled BSDF')
 t=nodes.new('ShaderNodeTexImage');t.image=bpy.data.images.load(str(TEX/file),check_existing=True);links.new(t.outputs['Color'],p.inputs['Base Color']);p.inputs['Roughness'].default_value=.60
 if alpha:links.new(t.outputs['Alpha'],p.inputs['Alpha']);material.surface_render_method='DITHERED'
 return material
hair=mat('Reference brown hair fibres','groom_color.png',True);foundation=mat('Reference side and back hair volume','groom_foundation.png',True)
rotation=Matrix.Rotation(math.pi/2,4,'X')
for source in DATA['meshes']:
 if not source['name'].startswith('hair'):continue
 mesh=bpy.data.meshes.new(source['name']);mesh.from_pydata(source['vertices'],[],source['faces']);mesh.update()
 obj=bpy.data.objects.new(source['name'],mesh);bpy.context.collection.objects.link(obj)
 mesh.materials.append(hair if source['material']=='hair' else foundation)
 uv=mesh.uv_layers.new(name='UVMap');uv.data.foreach_set('uv',array.array('f',(component for indices in source['face_uv'] for tex_index in indices for component in source['uvs'][tex_index])))
 mesh.polygons.foreach_set('use_smooth',[True]*len(mesh.polygons));mesh.transform(rotation)
 if source['subdivision']:
  sub=obj.modifiers.new('Hair silhouette refinement','SUBSURF');sub.levels=source['subdivision']
 vg=obj.vertex_groups.new(name='head');vg.add(list(range(len(mesh.vertices))),1,'REPLACE')
 modifier=obj.modifiers.new('Follow swimmer head','ARMATURE');modifier.object=actor;obj.parent=actor
bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/refined/girl_swim_v10.blend'))
print('Reference groom GLB and editable eight-action rig complete')
