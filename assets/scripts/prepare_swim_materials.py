from pathlib import Path
import numpy as np
from PIL import Image,ImageFilter
root=Path(__file__).resolve().parents[2]/'assets/usd/textures'
rng=np.random.default_rng(81);h=rng.normal(128,17,(1024,1024));im=Image.fromarray(np.uint8(np.clip(h,0,255))).filter(ImageFilter.GaussianBlur(.65));im.save(root/'skin_micro_height.png')
y,x=np.mgrid[0:256,0:256];warp=(np.cos(x*np.pi/4)**6)*(1+.18*np.sin(y*np.pi/8));weft=(np.cos(y*np.pi/4)**6)*(1+.18*np.sin(x*np.pi/8));height=128+26*(warp+weft)+rng.normal(0,2,(256,256));Image.fromarray(np.uint8(np.clip(height,0,255))).save(root/'dress_weave_height.png')
# Colour variation lives in the existing source skin texture. Pores remain a
# fine normal/bump detail rather than dark, over-sharpened paint.
print('Skin pores and woven fabric height maps prepared')
