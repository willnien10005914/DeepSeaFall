"""Anatomical humpback, UV-correct PBR skin and sparse attached barnacles.
Run with /home/spark/env_isaaclab/bin/python; no external model dependencies.
"""
from pathlib import Path
import json, math
import numpy as np
from PIL import Image, ImageDraw
from scipy.ndimage import gaussian_filter, zoom
from scipy.interpolate import PchipInterpolator
import trimesh
import rebuild_realistic as base

ROOT = Path(__file__).resolve().parents[2]
TEX = ROOT / 'assets/usd/textures'
rng = np.random.default_rng(510)
W, H = 2048, 1024
u, row = np.meshgrid(np.linspace(0, 1, W), np.linspace(0, 1, H))
# Trimesh's GLTF exporter flips V. Image rows therefore represent 1-angle/Tau.
angle = (1 - row) * math.tau
field = np.zeros((H, W))
for n, strength in [(12, 1), (36, .42), (110, .17), (320, .065)]:
    f = rng.normal(0, 1, (n, n * 2))
    f[0] = f[-1]  # Close the circumferential UV seam.
    field += zoom(f, (H / n, W / (n * 2)), order=3)[:H, :W] * strength
grain = gaussian_filter(rng.normal(0, 1, (H, W)), .5)
ventral = np.clip((-.10 - np.sin(angle) + field * .045) * 2.8, 0, 1)
front = np.clip((u - .32) / .26, 0, 1)
pale = ventral * front
rgb = np.stack([79 + field * 13, 87 + field * 13, 91 + field * 13], -1)
ivory = np.stack([177 + field * 17, 185 + field * 17, 183 + field * 17], -1)
rgb = rgb * (1 - pale[..., None]) + ivory * pale[..., None]
rgb += grain[..., None] * 2.2
height = field * .14 + grain * .048
rough = .48 + field * .035 + grain * .012 + pale * .075

def save_maps(prefix, color, relief, roughness):
    Image.fromarray(np.uint8(np.clip(color, 0, 255))).save(TEX / f'{prefix}_color.jpg', quality=95)
    dy, dx = np.gradient(relief)
    # V points upwards in source UVs and downwards in the exported GLTF.
    normal = np.stack([-dx * 2.2, -dy * 2.2, np.ones_like(dx)], -1)
    normal /= np.linalg.norm(normal, axis=-1)[..., None]
    Image.fromarray(np.uint8(np.clip((normal * .5 + .5) * 255, 0, 255))).save(TEX / f'{prefix}_normal.png')
    r = np.uint8(np.clip(roughness, .25, .82) * 255)
    Image.fromarray(np.stack([np.full_like(r, 255), r, np.zeros_like(r)], -1)).save(TEX / f'{prefix}_roughness.png')
    return {'baseColorTexture': Image.open(TEX / f'{prefix}_color.jpg'),
            'normalTexture': Image.open(TEX / f'{prefix}_normal.png'),
            'metallicRoughnessTexture': Image.open(TEX / f'{prefix}_roughness.png')}

# Fine old scars and irregular healed areas, never evenly spaced decorative bands.
mask = Image.new('L', (W, H)); draw = ImageDraw.Draw(mask)
for _ in range(160):
    x = int(rng.integers(200, W - 100)); y = int(rng.integers(15, H - 20))
    length = int(rng.integers(7, 68)); slope = rng.uniform(-.3, .3)
    pts = [(x + j, int(y + j * slope + 2 * math.sin(j / 15))) for j in range(length)]
    draw.line(pts, fill=int(rng.integers(35, 180)), width=int(rng.integers(1, 3)))
scar = gaussian_filter(np.asarray(mask).astype(float) / 255, .5)
rgb += scar[..., None] * np.array([42, 44, 41]); height -= scar * .38; rough += scar * .13
base.textures['whale'] = save_maps('whale', rgb, height, rough)
base.textures['belly'] = base.textures['whale']
for prefix, belly_strength in [('pectoral', .82), ('fluke', .9)]:
    patch = np.clip((-.1 - np.sin(angle)) * 3 + field * .10, 0, 1) * belly_strength
    if prefix == 'pectoral': patch = np.clip(patch + .20 + field * .07, 0, 1)
    fin = np.stack([68 + field * 14, 79 + field * 14, 84 + field * 14], -1)
    fin = fin * (1 - patch[..., None]) + ivory * patch[..., None]
    base.textures[prefix] = save_maps(f'whale_{prefix}', fin + scar[..., None] * 35, height, rough)
    base.MATERIALS[prefix] = ((.35, .38, .38), .82)
base.MATERIALS['whale'] = ((.30, .34, .36), .82)
base.MATERIALS['barnacle'] = ((.43, .46, .44), .82)
base.MATERIALS['barnacle_core'] = ((.12, .14, .14), .82)
base.MATERIALS['groove'] = ((.035, .044, .046), .60)
base.legacy.MATS.update({k:(v[0],v[1],0.,(0,0,0),0.,.25,1.37,.45) for k,v in base.MATERIALS.items()})

knots = [-6, -5.5, -4.6, -3.5, -2, -.5, 1, 2.5, 3.6, 4.6, 5.25, 5.65, 5.93, 6.05]
width = PchipInterpolator(knots, [.025,.23,.45,.72,1.05,1.36,1.48,1.58,1.68,1.61,1.44,1.13,.64,.008])
height_curve = PchipInterpolator(knots, [.035,.24,.44,.70,1.02,1.31,1.40,1.39,1.26,1.01,.73,.42,.15,.008])
center = PchipInterpolator(knots, [0,0,.03,.10,.16,.17,.18,.16,.13,.12,.11,.11,.10,.10])

def surface(x, a):
    h, w = float(height_curve(x)), float(width(x))
    head = np.clip((x - 2.4) / 2.7, 0, 1)
    # Lower jaw remains broad; the upper rostrum is flatter than a torpedo nose.
    upper = 1 - head * .22 if math.sin(a) > 0 else 1
    vent = max(0, -math.sin(a)) ** 2
    extent = np.clip((x + 1.8) / 1.6, 0, 1) * np.clip((5.75 - x) / .8, 0, 1)
    pleat = .035 * math.cos(a * 32 + head * .2) * vent * extent
    return np.array([x, center(x) + (h + pleat) * math.sin(a) * upper,
                     (w + pleat) * math.cos(a)])

parts = {'whale_body': base.grid('whale_body', lambda s,t:surface(-6+12.05*s,t*math.tau), 224, 224, 'whale')}
# The generating grid's winding runs inward on this parameterisation.
parts['whale_body'].invert()
for side, label in [(1, 'l'), (-1, 'r')]:
    def pectoral(s,t,side=side):
        a = t*math.tau; z = side*(1.10+3.60*s)
        chord = .05+.58*math.sin(math.pi*s)**.72
        wave = .048*math.sin(s*math.tau*9)*max(0,math.cos(a))*math.sin(s*math.pi)
        return [.95-1.7*s+.28*math.sin(s*math.pi)+(chord+wave)*math.cos(a),
                -.35-.5*s+.106*math.sin(math.pi*s)*math.sin(a), z]
    name='pectoral_'+label;parts[name]=base.grid(name,pectoral,100,32,'pectoral')
    if side == -1:parts[name].invert()
    def fluke(s,t,side=side):
        a=t*math.tau; chord=.055+.74*math.sin(math.pi*s)**.65
        return [-5.86+.31*s-.32*math.sin(math.pi*s)+chord*math.cos(a),
                .04+.14*s*s+.064*math.sin(math.pi*s)*math.sin(a),side*(.03+2.20*s)]
    name='fluke_'+label;parts[name]=base.grid(name,fluke,92,32,'fluke')
    if side == -1:parts[name].invert()
def dorsal(s,t):
    a=t*math.tau
    return [-2-.63*s+(.54*(1-s)+.005)*math.cos(a),.98+s*.76,.12*(1-s)*math.sin(a)]
parts['dorsal']=base.grid('dorsal',dorsal,45,32,'whale');parts['dorsal'].invert()

def body_uv(mesh):
    p=mesh.vertices; a=np.mod(np.arctan2(p[:,1]-center(np.clip(p[:,0],-6,6.05)),p[:,2]),math.tau)
    mesh.visual=trimesh.visual.texture.TextureVisuals(uv=np.column_stack([(p[:,0]+6)/12.05,a/math.tau]))

for side,label in [(1,'l'),(-1,'r')]:
    pts=[];lip=[]
    for x in np.linspace(2.7,6.03,112):
        a=-.24 if side==1 else math.pi+.24
        p=surface(x,a);p[2]*=1.008;pts.append(p)
        lip.append(p+np.array([0,-.036,side*.016]))
    n='mouth_'+label;parts[n]=base.tube(n,pts,np.linspace(.029,.012,112),'groove',10)
    n='jaw_rim_'+label;parts[n]=base.tube(n,lip,np.linspace(.035,.016,112),'whale',12);body_uv(parts[n])
    c=surface(2.9,-.015 if side==1 else math.pi+.015);c[2]*=1.006
    n='eye_'+label;parts[n]=base.ell(n,c,(.063,.044,.025),'eye')
    n='eyelid_'+label
    pts=[c+[.083*math.cos(a),.059*math.sin(a),side*.003] for a in np.linspace(0,math.tau,52)]
    parts[n]=base.tube(n,pts,np.full(52,.015),'whale',10);body_uv(parts[n])

def attached_frame(x,a):
    p=surface(x,a)
    tangent=surface(min(x+.008,6.04),a)-surface(max(x-.008,-5.99),a)
    around=surface(x,a+.008)-surface(x,a-.008)
    normal=np.cross(tangent,around);normal/=np.linalg.norm(normal)
    tangent/=np.linalg.norm(tangent);across=np.cross(tangent,normal)
    return p,np.column_stack([tangent,normal,across])

tubercles=[]
for i,x in enumerate(np.linspace(3.25,5.65,7)):
    for a in [.61,1.57,2.53,3.55,5.87]:
        p,frame=attached_frame(x+rng.uniform(-.035,.035),a+rng.uniform(-.025,.025))
        m=trimesh.creation.icosphere(subdivisions=2)
        m.vertices=(m.vertices*np.array([.059,.039,.047]))@frame.T+p
        body_uv(m);tubercles.append(m)
parts['rostral_tubercles']=trimesh.util.concatenate(tubercles);base.parts_mat['rostral_tubercles']='whale'

shells=[];cores=[]
for _ in range(78):
    x=rng.uniform(3.3,5.85)
    a=rng.choice([rng.uniform(3.8,5.6),rng.uniform(.4,.85),rng.uniform(2.3,2.75)])
    p,frame=attached_frame(x,a);radius=rng.uniform(.018,.051);rise=radius*.63
    vs=[];fs=[]
    for j,(r,y) in enumerate([(radius,0),(radius*.76,rise),(radius*.32,rise*.91)]):
        for k in range(12):
            theta=k*math.tau/12;rr=r*(1+.10*math.cos(theta*6))
            vs.append(p+frame@np.array([rr*math.cos(theta),y,rr*math.sin(theta)]))
    for j in range(2):
        for k in range(12):
            q=j*12+k;qn=j*12+(k+1)%12
            fs.extend([(q,qn,q+12),(qn,qn+12,q+12)])
    m=trimesh.Trimesh(vertices=vs,faces=fs,process=False);m.fix_normals();shells.append(m)
    m=trimesh.creation.icosphere(subdivisions=1)
    m.vertices=(m.vertices*np.array([radius*.28,.003,radius*.28]))@frame.T+p+frame[:,1]*rise*.87
    cores.append(m)
for name,meshes,mat in [('barnacle_clusters',shells,'barnacle'),('barnacle_centres',cores,'barnacle_core')]:
    parts[name]=trimesh.util.concatenate(meshes);base.parts_mat[name]=mat
for i,side in enumerate([-1,1]):
    n='blowhole_'+str(i);p=surface(3.05,math.pi/2);p[2]=side*.095
    parts[n]=base.ell(n,p,(.10,.014,.042),'groove')
body_uv(parts['dorsal'])
assert all(np.isfinite(m.vertices).all() for m in parts.values())
base.pbr(parts,ROOT/'assets/usd/whale.glb')
base.textured_usd(parts,ROOT/'assets/usd/whale.usda','Whale')
# The portable USD writer also receives the new fin materials and their maps.
usd=ROOT/'assets/usd/whale.usda';doc=usd.read_text()
for mat in ['pectoral','fluke']:
    start=doc.index('def Material "'+mat+'"');end=doc.find('def Material ',start+15)
    if end<0:end=doc.index('    def Mesh ',start)
    block=doc[start:end]
    import re
    block=re.sub(r'color3f inputs:diffuseColor = \([^\n]+\)',
        f'color3f inputs:diffuseColor.connect = </Whale/Looks/{mat}/Skin.outputs:rgb>',block)
    cut=block.rfind('        }')
    nodes=f'''            def Shader "UV" {{
                uniform token info:id = "UsdPrimvarReader_float2"
                token inputs:varname = "st"
                float2 outputs:result
            }}
            def Shader "Skin" {{
                uniform token info:id = "UsdUVTexture"
                asset inputs:file = @textures/whale_{mat}_color.jpg@
                token inputs:sourceColorSpace = "sRGB"
                float2 inputs:st.connect = </Whale/Looks/{mat}/UV.outputs:result>
                float3 outputs:rgb
            }}
'''
    doc=doc[:start]+block[:cut]+nodes+block[cut:]+doc[end:]
# Complete PreviewSurface roughness and fin normals for editable USD use.
for mat,prefix in [('whale','whale'),('pectoral','whale_pectoral'),('fluke','whale_fluke')]:
    start=doc.index('def Material "'+mat+'"');end=doc.find('def Material ',start+15)
    if end<0:end=doc.index('    def Mesh ',start)
    block=doc[start:end]
    block=re.sub(r'float inputs:roughness = [^\n]+',f'float inputs:roughness.connect = </Whale/Looks/{mat}/Roughness.outputs:g>',block)
    block=block.replace('float inputs:clearcoat = 0.0','float inputs:clearcoat = 0.22').replace('float inputs:clearcoatRoughness = 0.25','float inputs:clearcoatRoughness = 0.30')
    nodes=f"""            def Shader "Roughness" {{
                uniform token info:id = "UsdUVTexture"
                asset inputs:file = @textures/{prefix}_roughness.png@
                token inputs:sourceColorSpace = "raw"
                float4 inputs:scale = (1, 0.82, 1, 1)
                float2 inputs:st.connect = </Whale/Looks/{mat}/UV.outputs:result>
                float outputs:g
            }}
"""
    if mat!='whale':
        block=block.replace('token outputs:surface\n',f'normal3f inputs:normal.connect = </Whale/Looks/{mat}/Detail.outputs:rgb>\n                token outputs:surface\n')
        nodes+=f"""            def Shader "Detail" {{
                uniform token info:id = "UsdUVTexture"
                asset inputs:file = @textures/{prefix}_normal.png@
                token inputs:sourceColorSpace = "raw"
                float4 inputs:scale = (1.3, -1.3, 2, 1)
                float4 inputs:bias = (-0.65, 0.65, -1, 0)
                float2 inputs:st.connect = </Whale/Looks/{mat}/UV.outputs:result>
                float3 outputs:rgb
            }}
"""
    else:
        block=block.replace('float4 inputs:scale = (2, 2, 2, 1)','float4 inputs:scale = (1.3, -1.3, 2, 1)').replace('float4 inputs:bias = (-1, -1, -1, 0)','float4 inputs:bias = (-0.65, 0.65, -1, 0)')
    cut=block.rfind('        }');block=block[:cut]+nodes+block[cut:];doc=doc[:start]+block+doc[end:]
usd.write_text(doc)
report={'revision':5,'triangles':sum(len(m.faces) for m in parts.values()),'meshes':len(parts),
        'glb_bytes':(ROOT/'assets/usd/whale.glb').stat().st_size,
        'skin':'UV-correct dorsal/ventral maps, scars, pores, variable wet roughness, fin-specific maps',
        'motion':'9-joint GPU skinning, dorsoventral stroke, fluke feathering, independent pectorals',
        'barnacle_count':78,'uv_v_flip_compensated':True}
(ROOT/'assets/usd/whale-v5-report.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
