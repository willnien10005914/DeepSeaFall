import * as THREE from 'three';

export function makeOcean(scene) {
  const group=new THREE.Group();scene.add(group);
  const loader=new THREE.TextureLoader();
  const color=loader.load('assets/usd/textures/rock_color.jpg');color.colorSpace=THREE.SRGBColorSpace;
  const normal=loader.load('assets/usd/textures/rock_normal.png');
  for(const tex of [color,normal]){tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.repeat.set(3,7)}
  const material=new THREE.MeshStandardMaterial({color:0x7c8d95,map:color,normalMap:normal,normalScale:new THREE.Vector2(1.3,1.3),roughness:.94});
  for(let side of [-1,1])for(let k=0;k<7;k++){
    const geo=new THREE.CylinderGeometry(1.4,1.8,9,28,48,false);
    const pos=geo.attributes.position;
    for(let i=0;i<pos.count;i++){
      const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i);
      const r=1+.22*Math.sin(y*.73+k*4+x)+.11*Math.sin(y*3.9+x*4+z*3)+.12*Math.sin(x*9+z*6+k);
      pos.setXYZ(i,x*r,y+.06*Math.sin(z*8),z*r);
    }
    geo.computeVertexNormals();
    const cliff=new THREE.Mesh(geo,material);
    cliff.scale.set(1.4+Math.sin(k*2)*.3,1.4,1.1);
    cliff.position.set(side*(6.5+Math.sin(k*1.7)*1.3),-11+k*4,-4+(k%3)*1.6);
    cliff.rotation.y=k*1.73;group.add(cliff);
  }
  const rayMaterial=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,
    vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:'varying vec2 vUv;void main(){float edge=pow(max(0.,1.-abs(vUv.x-.5)*2.),3.);float fade=sin(vUv.y*3.14159);gl_FragColor=vec4(.43,.75,.9,edge*fade*.045);}' });
  const rays=new THREE.Group();
  for(let i=0;i<8;i++){
    const ray=new THREE.Mesh(new THREE.PlaneGeometry(.4+i*.15,24),rayMaterial);
    ray.position.set(-4+i*1.2,5,-5-i*.23);ray.rotation.z=-.18;ray.rotation.y=.15;rays.add(ray);
  }
  group.add(rays);
  const particleGeo=new THREE.BufferGeometry();const particles=new Float32Array(900*3);
  for(let i=0;i<particles.length;i+=3){particles[i]=Math.sin(i*43.7)*10;particles[i+1]=Math.sin(i*17.3)*18;particles[i+2]=Math.cos(i*67.8)*10-3}
  particleGeo.setAttribute('position',new THREE.BufferAttribute(particles,3));
  const motes=new THREE.Points(particleGeo,new THREE.ShaderMaterial({transparent:true,depthWrite:false,
    uniforms:{time:{value:0}},
    vertexShader:'uniform float time;varying float alpha;void main(){vec3 p=position;p.y+=sin(time*.13+position.x)*.5;vec4 mv=modelViewMatrix*vec4(p,1.);alpha=.26;gl_PointSize=clamp(14./-mv.z,1.,3.);gl_Position=projectionMatrix*mv;}',
    fragmentShader:'varying float alpha;void main(){float d=length(gl_PointCoord-.5);gl_FragColor=vec4(.72,.87,.91,alpha*smoothstep(.5,.1,d));}' }));
  group.add(motes);
  const surface=new THREE.Mesh(new THREE.PlaneGeometry(65,65,40,40),new THREE.MeshPhysicalMaterial({color:0x9ad6e3,transparent:true,opacity:.3,roughness:.15,metalness:0,side:THREE.DoubleSide}));
  surface.rotation.x=-Math.PI/2;surface.position.y=13;group.add(surface);
  const rest=surface.geometry.attributes.position.array.slice();
  return {group,rays,motes,surface,update(t){
    motes.material.uniforms.time.value=t;
    const p=surface.geometry.attributes.position;
    for(let i=0;i<p.count;i++)p.setZ(i,Math.sin(rest[i*3]*.6+t)*.12+Math.sin(rest[i*3+1]*.7+t*.8)*.09);
    p.needsUpdate=true;
  }};
}
