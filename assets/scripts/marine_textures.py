from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw
from scipy.ndimage import gaussian_filter
root=Path(__file__).resolve().parents[2];folder=root/'assets/marine';folder.mkdir(exist_ok=True)
rng=np.random.default_rng(6601);w,h=1024,512
u,row=np.meshgrid(np.linspace(0,1,w),np.linspace(0,1,h));a=(1-row)*np.pi*2
back=np.clip(np.sin(a)*1.5+.15,0,1)
noise=gaussian_filter(rng.normal(0,1,(h,w)),3)
base=np.stack([168-back*102+noise*8,178-back*90+noise*8,179-back*70+noise*8],-1)
# A muted lateral stripe and overlapping scales on the flanks; no emissive skin.
stripe=np.exp(-((np.abs(np.sin(a))-.20)/.07)**2)*np.clip((.84-u)*4,0,1)
base-=stripe[...,None]*19
scales=Image.new('L',(w,h));draw=ImageDraw.Draw(scales)
for y in range(-10,h+18,14):
 for x in range(-20,w+20,24):
  xx=x+(12 if (y//14)%2 else 0);draw.arc((xx,y,xx+24,y+17),-75,75,fill=115,width=1)
s=np.asarray(scales)/255;head=np.clip((.83-u)*10,0,1)
base+=s[...,None]*head[...,None]*20
Image.fromarray(np.uint8(np.clip(base,0,255))).save(folder/'fish-albedo.jpg',quality=95)
height=gaussian_filter(s,.55)*head*.14+gaussian_filter(rng.normal(0,1,(h,w)),.7)*.009
dy,dx=np.gradient(height);normal=np.stack([-dx,-dy,np.ones_like(dx)],-1);normal/=np.linalg.norm(normal,axis=-1)[...,None]
Image.fromarray(np.uint8((normal*.5+.5)*255)).save(folder/'fish-normal.png')
rough=np.uint8(np.clip(.43+s*.06+back*.08+rng.normal(0,.01,(h,w)),.3,.65)*255)
Image.fromarray(np.stack([np.full_like(rough,255),rough,np.zeros_like(rough)],-1)).save(folder/'fish-roughness.png')
fin=np.zeros((256,256,4),dtype=np.uint8)
for y in range(256):
 for x in range(256):
  ray=(.5+.5*np.cos((x/256)*np.pi*2*18))**14
  fin[y,x]=[144+int(ray*36),164+int(ray*31),168+int(ray*25),int(160+ray*80)]
Image.fromarray(fin).save(folder/'fin-membrane.png')
print('Created silver-fish albedo, normal, roughness and translucent fin membrane maps')
