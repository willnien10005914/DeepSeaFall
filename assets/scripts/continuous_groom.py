"""Smooth shared guides for film curves and game ribbons, in Y-up metres."""
import math
from pathlib import Path
import numpy as np
from PIL import Image

def make_groom(add,vertices,body_faces,uv,texture_dir):
    rng=np.random.default_rng(27)
    center=np.array([0,1.475,.054]);radii=np.array([.078,.096,.105])
    def scalp(theta,phi,lift=0):
        n=np.array([np.sin(theta)*np.sin(phi),np.cos(theta),np.sin(theta)*np.cos(phi)])
        return center+(radii+lift)*n
    def boundary(phi):return 1.12+.82*(.5-.5*np.cos(phi))**.55
    def smooth(t):return t*t*(3-2*t)
    def addguide(part,p,width):
        tangent=np.gradient(p,axis=0)
        tangent/=np.maximum(np.linalg.norm(tangent,axis=1)[:,None],1e-10)
        normal=(p-center)/radii
        if part=='ponytail':normal=np.tile([0,0,1.],(len(p),1))
        normal/=np.maximum(np.linalg.norm(normal,axis=1)[:,None],1e-10)
        across=np.cross(normal,tangent)
        across/=np.maximum(np.linalg.norm(across,axis=1)[:,None],1e-10)
        for i in range(1,len(across)):
            if across[i]@across[i-1]<0:across[i]*=-1
        guides.append(dict(part=part,points=p.tolist(),normals=normal.tolist(),across=across.tolist(),width=width))
    # Foundation beneath fine fibers, high at forehead and low at nape.
    vs=[];uvs=[];fs=[];rows,cols=44,128
    for i in range(rows+1):
        for j in range(cols+1):
            phi=-math.pi+j/cols*math.tau
            theta=.004+i/rows*(boundary(phi)-.004)
            vs.append(scalp(theta,phi,-.002));uvs.append([j/cols,1-i/rows])
    for i in range(rows):
        for j in range(cols):
            a=i*(cols+1)+j;b=a+cols+1;fs.append([a,a+1,b+1,b])
    add('hair_cap',vs,fs,fs,uvs,'haircap',1)
    guides=[];s=np.linspace(0,1,56)
    # Every latitude is covered; locks comb back along the fitted skull.
    for i in range(620):
        phi=-math.pi+math.tau*((i*.61803398875)%1)
        theta=.012+(boundary(phi)-.075)*np.sqrt(((i*.754877666)%1))
        side=1 if phi>=0 else -1
        endphi=side*(math.pi-.08-.10*rng.random());endtheta=1.88+.03*rng.random()
        phis=phi+(endphi-phi)*smooth(s);thetas=theta+(endtheta-theta)*s
        lift=-.003+.006*smooth(np.clip(s/.13,0,1))+.003*np.sin(s*math.pi)**2+.001*rng.random()*s
        p=np.array([scalp(t,a,l) for t,a,l in zip(thetas,phis,lift)])
        addguide('swept',p,.0030)
    # Uneven side swept fringe from a soft side part.
    for i in range(148):
        u=(i+.5)/148;endphi=-1.18+2.36*u
        startphi=-.54+.30*u+.018*np.sin(i*2.4)
        endtheta=1.54-.10*u+.12*abs(endphi/1.18)**1.8-.17*np.exp(-((u-.36)/.13)**2)+.065*np.sin(u*31+.8)
        starttheta=.26+.23*((i*23)%148)/148
        phis=startphi+(endphi-startphi)*smooth(s);thetas=starttheta+(endtheta-starttheta)*s
        lift=-.003+.009*smooth(np.clip(s/.16,0,1))+.006*np.sin(math.pi*s)**1.6
        p=np.array([scalp(t,a,l) for t,a,l in zip(thetas,phis,lift)])
        addguide('fringe',p,.0026)
    # A visible knot at the lower occiput and a full tapering short tail.
    for i in range(148):
        a=i*2.39996323;r=np.sqrt((i+.5)/148);spread=.016+.015*np.sin(s*math.pi)
        x=r*np.cos(a)*spread+.002*np.sin(s*8+i)
        y=1.439-.097*s+r*np.sin(a)*spread*.54+.008*s*np.sin(i*1.71)
        z=-.050-.037*np.sin(s*math.pi/2)+r*np.sin(a)*spread*.60
        addguide('ponytail',np.stack([x,y,z],1),.0032)
    for part,name in [('swept','hair_swept'),('fringe','hair_fringe'),('ponytail','hair_ponytail')]:
        vs=[];uvs=[];faces=[]
        for g in (g for g in guides if g['part']==part):
            sample=np.append(np.arange(0,len(g['points'])-1,2),len(g['points'])-1)
            p=np.array(g['points'])[sample];across=np.array(g['across'])[sample];offset=len(vs)
            for i,point in enumerate(p):
                t=i/(len(p)-1);w=g['width']*(1-.84*t**8)
                for j in range(2):
                    vs.append(point+across[i]*(j-.5)*w);uvs.append([j,1-t])
            for i in range(len(p)-1):
                a=offset+i*2;b=a+2;faces.append([a,a+1,b+1,b])
        add(name,vs,faces,faces,uvs,'hair',0)
    # Numerical fiber coverage atlas for all game ribbons.
    h,w=1024,256;u,v=np.meshgrid(np.linspace(0,1,w),np.linspace(0,1,h));alpha=np.zeros((h,w))
    for k in range(24):
        c=(k+.5)/24+.003*np.sin(v[:,0]*(4+k%5)+k)
        line=np.exp(-(abs(u-c[:,None])/.011)**2)
        line*=np.clip((.91+rng.uniform(0,.09)-v)/.05,0,1);alpha=np.maximum(alpha,line*.96)
    alpha*=np.clip(u*25,0,1)*np.clip((1-u)*25,0,1)
    variation=np.sin(u*150)*2+rng.normal(0,.3,(h,w))
    rgb=np.stack([64+variation,40+variation*.7,25+variation*.5],-1)
    rgba=np.concatenate([np.clip(rgb,0,255),np.clip(alpha*255,0,255)[...,None]],-1).astype(np.uint8)
    Image.fromarray(rgba).save(Path(texture_dir)/'groom_color.png')
    return guides
