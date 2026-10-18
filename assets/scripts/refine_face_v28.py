from pathlib import Path
import numpy as np,json
ROOT=Path(__file__).resolve().parents[2];D=json.loads((ROOT/'assets/refined/girl_portrait_source_v27.json').read_text());m=D['meshes'][0];p=np.array(m['vertices']);old=p.copy();x,y,z=old.T;mask=np.array(m['portrait_masks'])
def sm(a):
 a=np.clip(a,0,1);return a*a*(3-2*a)
visible=np.zeros(len(p),bool);visible[np.unique(np.concatenate([np.array(f) for f in m['faces']]))]=True
central=np.exp(-(abs(x)/.015)**4)
p[:,1]+=-.00032*mask[:,0]*central+.00042*mask[:,1]*central
p[:,2]-=(.00070*mask[:,0]+.00085*mask[:,1])*central
# Recede the mid-cheek fullness, shorten its lateral profile and preserve eyes.
cheek=np.exp(-((abs(x)-.045)/.024)**2-((y-1.425)/.025)**2)*sm((z-.055)/.035)*(1-sm((y-1.442)/.014))
p[:,2]-=.00135*cheek;p[:,0]*=1-.015*cheek
lateral=sm((abs(x)-.025)/.025)*sm((y-1.385)/.025)*(1-sm((y-1.44)/.016))*sm((z-.04)/.04)
p[:,2]=.035+(p[:,2]-.035)*(1-.035*lateral)
# The whole visible pinna moves forward with a broad attachment transition.
ear=sm((abs(x)-.061)/.016)*np.exp(-((y-1.44)/.039)**8)*(1-sm((z-.063)/.021))
p[:,2]+=.0035*ear
p[y<1.35]=old[y<1.35];p[~visible]=old[~visible];m['vertices']=p.tolist()
report={'revision':28,'central_lip_retraction_max_mm':float(((old[:,2]-p[:,2])*np.maximum(mask[:,0],mask[:,1])).max()*1000),'upper_lip_vertical_reduction_mm':.32,'lower_lip_vertical_reduction_mm':.42,'ear_forward_max_mm':float((p[:,2]-old[:,2])[ear>.7].max()*1000),'cheek_fullness_reduced':True,'body_below_neck_unchanged':bool(np.array_equal(old[y<1.35],p[y<1.35])),'hidden_helpers_unchanged':bool(np.array_equal(old[~visible],p[~visible]))}
D['face_revision']=report;(ROOT/'assets/refined/girl_portrait_source_v28.json').write_text(json.dumps(D,separators=(',',':')));(ROOT/'assets/refined/portrait_v28_report.json').write_text(json.dumps(report,indent=2));print(json.dumps(report))
