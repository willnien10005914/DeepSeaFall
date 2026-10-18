"""Train a small local imitation policy; no claim of Isaac/CFD simulation.
Observation: relative XYZ, creature/self XY velocity, danger, radius, curiosity.
Teacher uses predicted separation and comfortable approach distance.
Browser runs the exported weights; held-out set uses a different seed.
"""
from pathlib import Path
import json,math,time
import numpy as np
import torch
from torch import nn
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'assets/policy';OUT.mkdir(exist_ok=True)
torch.manual_seed(810);torch.set_num_threads(8)

def dataset(n,seed):
 rng=np.random.default_rng(seed);x=rng.uniform(-1,1,(n,10)).astype('float32')
 x[:,:3]*=1.35;x[:,7]=(rng.random(n)<.5);x[:,8]=rng.uniform(.15,.9,n);x[:,9]=rng.uniform(.3,1,n)
 rel=x[:,:3]*4;relvel=(x[:,3:5]-x[:,5:7])*2
 predicted=rel.copy();future=np.clip((np.linalg.norm(rel,axis=1)-x[:,8]*1.4-.35)/1.4,0,1);predicted[:,:2]+=relvel*(.60*future[:,None])
 length=np.maximum(np.linalg.norm(predicted,axis=1),.12)
 direction=predicted[:,:2]/length[:,None];radius=x[:,8]*1.4
 danger=x[:,7];avoid=np.clip((3.0+radius-length)/2.4,0,1)*danger
 # Radial retreat starts before impact; a small tangential component frees
 # the swimmer when an obstacle heads directly into the centre line.
 retreat=-direction*(avoid*2.4)[:,None]
 retreat[:,0]+=np.sign(predicted[:,0]+.01)*-.12*avoid
 dist=np.maximum(np.linalg.norm(rel,axis=1),.12)
 comfortable=radius+1.15
 approach=(1-danger)*np.clip((4.8-dist)/2.5,0,1)*x[:,9]
 velocity=rel[:,:2]/dist[:,None]*np.clip((dist-comfortable)*.75,-1.4,1.65)[:,None]*approach[:,None]
 velocity+=retreat
 labels=np.column_stack((np.clip(velocity/2,-.97,.97),approach,avoid)).astype('float32')
 return torch.tensor(x),torch.tensor(labels)

class Policy(nn.Module):
 def __init__(self):
  super().__init__();self.layers=nn.ModuleList([nn.Linear(10,48),nn.Linear(48,48),nn.Linear(48,4)])
 def forward(self,x):
  for layer in self.layers[:-1]:x=torch.tanh(layer(x))
  x=self.layers[-1](x)
  return torch.cat((torch.tanh(x[:,:2]),torch.sigmoid(x[:,2:])),1)

start=time.time();train_x,train_y=dataset(96000,810);test_x,test_y=dataset(12000,9810)
# CPU training intentionally leaves unified GPU memory available for Vick.
model=Policy();optimizer=torch.optim.AdamW(model.parameters(),lr=.002,weight_decay=.00001)
log=[]
for epoch in range(100):
 order=torch.randperm(len(train_x));model.train();total=0
 for batch in order.split(2048):
  predicted=model(train_x[batch]);loss=((predicted-train_y[batch])**2*torch.tensor([2.,2.,1.,2.])).mean()
  optimizer.zero_grad();loss.backward();optimizer.step();total+=float(loss.detach())
 if epoch%10==0 or epoch==99:
  with torch.no_grad():err=float((model(test_x)-test_y).square().mean().sqrt())
  log.append({'epoch':epoch+1,'validation_rmse':err});print(log[-1],flush=True)
model.eval()
with torch.no_grad():p=model(test_x).numpy();y=test_y.numpy()
rel=test_x[:,:2].numpy()*4;distance=np.linalg.norm(test_x[:,:3].numpy()*4,axis=1);future=np.clip((distance-test_x[:,8].numpy()*1.4-.35)/1.4,0,1);rel+=(test_x[:,3:5].numpy()-test_x[:,5:7].numpy())*2*.60*future[:,None];mask=(test_y[:,3].numpy()>.45)&(np.linalg.norm(rel,axis=1)>.15)
away=((p[mask,:2]*rel[mask]).sum(1)<0).mean()
report={'method':'supervised imitation learning of predictive steering; Blender provides authored motion, not physics RL','device':'CPU','training_samples':96000,'held_out_samples':12000,'epochs':100,'seed':810,'held_out_seed':9810,'velocity_rmse_m_per_s':float(np.sqrt((((p[:,:2]-y[:,:2])*2)**2).mean())),'output_rmse':float(np.sqrt(((p-y)**2).mean())),'predicted_hazard_away_direction_fraction':float(away),'seconds':time.time()-start,'log':log,'observation':['dx/4','dy/4','dz/4','object_vx/2','object_vy/2','self_vx/2','self_vy/2','danger','radius/1.4','curiosity'],'outputs':['vx/2','vy/2','approach','avoid'],'limitations':'Abstract steering data with depth and predicted separation, not full hydrodynamics or learned muscle control.'}
assert away>.98,report
assert report['output_rmse']<.065,report
weights={'version':8,'layers':[{'weights':l.weight.detach().tolist(),'bias':l.bias.detach().tolist()} for l in model.layers],'activation':'tanh hidden; tanh velocity, sigmoid attention'}
(OUT/'reaction-policy.json').write_text(json.dumps(weights,separators=(',',':')))
(ROOT/'js/three/reaction-weights.js').write_text('export const reactionWeights='+json.dumps(weights,separators=(',',':'))+';\n')
torch.save({'state_dict':model.state_dict(),'metadata':report},OUT/'reaction-policy.pt')
(OUT/'training-report.json').write_text(json.dumps(report,indent=2))
# Exact samples let a browser test prove JS inference matches PyTorch.
(OUT/'inference-parity.json').write_text(json.dumps({'observations':test_x[:32].tolist(),'outputs':p[:32].tolist()}))
print(json.dumps({k:v for k,v in report.items() if k not in ['log','observation','outputs']},indent=2))
