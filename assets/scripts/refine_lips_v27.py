from pathlib import Path
import numpy as np,json
ROOT=Path(__file__).resolve().parents[2]
D=json.loads((ROOT/'assets/refined/girl_portrait_source_v26.json').read_text());m=D['meshes'][0];p=np.array(m['vertices']);old=p.copy();mask=np.array(m['portrait_masks']);x,y,z=old.T

def smooth(a):
 a=np.clip(a,0,1);return a*a*(3-2*a)
central=np.exp(-(abs(x)/.015)**4)
# Add anatomical cushion, not a uniform extruded lip border.
p[:,1]+=.00055*mask[:,0]*central-.00070*mask[:,1]*central
p[:,2]+=(.00015*mask[:,0]+.00035*mask[:,1])*central
# Fill the recessed commissures softly into neighbouring skin and lift a
# sub-millimetre smile. Gate to visible front-face vertices only.
corner=np.exp(-((abs(x)-.0180)/.0048)**2-((y-1.3994)/.0038)**2)*smooth((z-.104)/.012)
p[:,2]+=.00125*corner;p[:,1]+=.00038*corner
mask[:,2]*=1-smooth((abs(x)-.012)/.0065)
visible=np.zeros(len(p),bool);visible[np.unique(np.concatenate([np.array(f) for f in m['faces']]))]=True
p[~visible]=old[~visible]
m['vertices']=p.tolist();m['portrait_masks']=mask.tolist()
report={'revision':27,'max_corner_fill_mm':float((p[:,2]-old[:,2])[corner>.6].max()*1000),'central_upper_vertical_add_mm':.55,'central_lower_vertical_add_mm':.70,'smile_corner_lift_mm':.38,'corner_seam_fades_to_zero_at_abs_x_m':.0185,'no_teeth':not any('teeth' in v['name'] for v in D['meshes']),'body_below_neck_unchanged':bool(np.array_equal(old[y<1.35],p[y<1.35]))}
D['lip_revision']=report
(ROOT/'assets/refined/girl_portrait_source_v27.json').write_text(json.dumps(D,separators=(',',':')))
(ROOT/'assets/refined/portrait_v27_report.json').write_text(json.dumps(report,indent=2));print(json.dumps(report))
