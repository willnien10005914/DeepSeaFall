from pathlib import Path
import numpy as np,json
R=Path(__file__).resolve().parents[2]
D=json.loads((R/'assets/refined/girl_portrait_source_v25.json').read_text());rig={j['name']:np.array(j['position']) for j in D['rig']}
def sm(a):
 a=np.clip(a,0,1);return a*a*(3-2*a)
report={}
for m in D['meshes']:
 if m['name'].startswith('hair'):continue
 p=np.array(m['vertices'],dtype=float);old=p.copy();x,y,z=p.T.copy()
 # Shared depth/width adjustment keeps eyes and their attached details aligned.
 h=sm((y-1.365)/.065);p[:,0]*=1-h*.025;p[:,2]=.025+(p[:,2]-.025)*(1-h*.045)
 if m['name']=='skin_body':
  visible=np.zeros(len(p),bool);visible[np.unique(np.concatenate([np.array(f) for f in m['faces']]))]=True
  neck=sm((y-1.245)/.055)*(1-sm((y-1.365)/.045));p[:,0]*=1-.105*neck;p[:,2]=.008+(p[:,2]-.008)*(1-.075*neck)
  cheek=np.exp(-((np.abs(x)-.044)/.022)**2-((y-1.420)/.025)**2)*sm((z-.056)/.035)
  p[:,2]+=.0032*cheek;p[:,0]+=np.sign(x)*.0006*cheek
  segments=[]
  for pre in ['l_','r_']:
   for a,b,rate in [('shoulder','elbow',.065),('elbow','wrist',.085),('thigh','knee',.065),('knee','ankle',.075),('wrist','wrist',.045),('ankle','foot',.045)]:
    aa=rig[pre+a];bb=rig[pre+b];v=bb-aa;t=np.clip(((old-aa)@v)/max(np.dot(v,v),1e-12),0,1);q=aa+t[:,None]*v;dist=np.linalg.norm(old-q,axis=1);segments.append((dist,q,rate,a))
  dist=np.array([s[0] for s in segments]);choice=dist.argmin(0)
  for j,(dd,q,rate,a) in enumerate(segments):
   mask=(choice==j)&visible&(((y<.80)&(np.abs(x)>.025))|((y<1.26)&(np.abs(x)>.15)))&(dd<(.125 if a=='thigh' else .10))
   p[mask]=q[mask]+(p[mask]-q[mask])*(1-rate)
  p[~visible]=old[~visible]
  report['neck_width_reduction_max_percent']=10.5;report['limb_cross_section_reduction_percent']=[4.5,8.5];report['cheek_forward_fill_max_mm']=3.2
 m['vertices']=p.tolist();report[m['name']+'_max_delta_mm']=float(np.linalg.norm(p-old,axis=1).max()*1000)
D['proportion_revision']=report
(R/'assets/refined/girl_portrait_source_v26.json').write_text(json.dumps(D,separators=(',',':')))
(R/'assets/refined/portrait_v26_report.json').write_text(json.dumps(report,indent=2))
p=R/'assets/scripts/build_reference_groom_v26.py';s=p.read_text().replace('range(600)','range(800)').replace('range(225)','range(300)').replace('.5/225','.5/300').replace('range(290)','range(340)');s=s.replace('BACK_ENDS=(.480,.398,.318)','BACK_ENDS=(.490,.405,.315,.355)').replace('SIDE_ENDS=(.982,1.060,1.132)','SIDE_ENDS=(.972,1.048,1.128,1.088)').replace('layer=i%3','layer=i%4').replace('min(int(layer),2)','min(int(layer),3)').replace("'revision':24","'revision':26");p.write_text(s)
print(json.dumps(report))
