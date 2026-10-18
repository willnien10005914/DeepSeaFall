import * as THREE from 'three';
import {FluidFlow} from './fluid-flow.js?v=49';

const waterFunctions=`
uniform float uWaterTime;
uniform sampler2D uFluidFlow;
uniform float uFlowStrength;
uniform float uCausticStrength;
uniform float uSurfaceY;
uniform vec3 uSunDirection;
uniform mat4 uSunMatrix;
uniform sampler2D uSunShadow;
float waterShadow(vec3 p){
 vec4 clip=uSunMatrix*vec4(p,1.);vec3 q=clip.xyz/clip.w;
 if(q.x<0.||q.x>1.||q.y<0.||q.y>1.||q.z<0.||q.z>1.)return 1.;
 float depth=unpackRGBAToDepth(texture2D(uSunShadow,q.xy));
 return mix(.12,1.,step(q.z-.0025,depth));
}
float waterCaustic(vec2 p){
 vec2 current=texture2D(uFluidFlow,p/32.+.5).rg*2.-1.;
 p-=current*uFlowStrength*(.8+fract(uWaterTime*.10)*1.8);
 p+=vec2(sin(p.y*1.8+uWaterTime*.48),cos(p.x*1.9-uWaterTime*.39))*.25;
 float wave=sin(p.x*3.0+uWaterTime*.65)+sin(p.y*3.2-uWaterTime*.57)+sin(p.x*2.6-p.y*2.1+uWaterTime*.28);
 return pow(max(0.,1.-abs(wave)*.54),14.);
}
`;

export class WaterRenderer{
 constructor(renderer,scene,camera,sun){
  this.flow=new FluidFlow();this.lastFlowTime=0;
  this.renderer=renderer;this.scene=scene;this.camera=camera;this.sun=sun;
  const white=new THREE.DataTexture(new Uint8Array([255,255,255,255]),1,1);white.needsUpdate=true;
  this.uniforms={uFluidFlow:{value:this.flow.texture},uFlowStrength:{value:1},uWaterTime:{value:0},uCausticStrength:{value:1},uSurfaceY:{value:17},uSunDirection:{value:new THREE.Vector3(-.35,.90,.27).normalize()},uSunMatrix:{value:new THREE.Matrix4()},uSunShadow:{value:white}};
  this.target=new THREE.WebGLRenderTarget(1,1,{type:renderer.extensions.has('EXT_color_buffer_float')?THREE.HalfFloatType:THREE.UnsignedByteType});
  this.target.depthTexture=new THREE.DepthTexture(1,1,THREE.UnsignedIntType);
  this.target.texture.colorSpace=THREE.LinearSRGBColorSpace;
  this.target.samples=renderer.capabilities.isWebGL2?2:0;
  this.postScene=new THREE.Scene();this.postCamera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
  this.post=new THREE.ShaderMaterial({depthTest:false,depthWrite:false,uniforms:{...this.uniforms,
   uColor:{value:this.target.texture},uDepth:{value:this.target.depthTexture},uInverseProjection:{value:new THREE.Matrix4()},uCameraWorld:{value:new THREE.Matrix4()},
   uCameraPosition:{value:new THREE.Vector3()},uResolution:{value:new THREE.Vector2(1,1)},uExtinction:{value:new THREE.Vector3(.050,.022,.013)},uScatterColor:{value:new THREE.Vector3(.038,.22,.49)},uLight:{value:1}
  },
  vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
  fragmentShader:`
   #include <common>
   #include <packing>
   varying vec2 vUv;uniform sampler2D uColor;uniform sampler2D uDepth;
   uniform mat4 uInverseProjection;uniform mat4 uCameraWorld;uniform vec3 uCameraPosition;
   uniform vec2 uResolution;uniform vec3 uExtinction;uniform vec3 uScatterColor;uniform float uLight;
   ${waterFunctions}
   void main(){
    float depth=texture2D(uDepth,vUv).x;
    vec4 view=uInverseProjection*vec4(vUv*2.-1.,depth*2.-1.,1.);view/=view.w;
    vec3 world=(uCameraWorld*view).xyz;vec3 delta=world-uCameraPosition;
    float distance=min(length(delta),65.);vec3 direction=normalize(delta);
    float jitter=fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453);
    const int STEPS=18;float stepLength=distance/float(STEPS);
    vec3 opticalStep=exp(-uExtinction*stepLength),transmission=vec3(1.),volume=vec3(0.);
    float phase=.55+.45*pow(max(dot(direction,uSunDirection),0.),4.);
    for(int i=0;i<STEPS;i++){
     vec3 p=uCameraPosition+direction*((float(i)+jitter)*stepLength);
     vec2 current=texture2D(uFluidFlow,p.xz/32.+.5).rg*2.-1.;
     vec2 projection=p.xz-current*.7+uSunDirection.xz*(uSurfaceY-p.y)/max(uSunDirection.y,.25);
     float broad=pow(.5+.5*sin(projection.x*.51+sin(projection.y*.26)*1.7+uWaterTime*.055),9.);
     float fine=pow(.5+.5*sin(projection.x*.97+projection.y*.29-uWaterTime*.07),18.);
     float sunlight=(.32+broad*.78+fine*.28)*waterShadow(p)*exp(-max(uSurfaceY-p.y,0.)*.016);
     vec3 radiance=uScatterColor*(.30+sunlight*uLight*phase*1.7)+sunlight*vec3(.020,.035,.050);
     volume+=transmission*(1.-opticalStep)*radiance;transmission*=opticalStep;
    }
    vec2 distortion=vec2(sin(vUv.y*41.+uWaterTime*.32),cos(vUv.x*37.-uWaterTime*.27))*.00035*smoothstep(8.,45.,distance);
    vec2 flowDistort=(texture2D(uFluidFlow,world.xz/32.+.5).rg*2.-1.)*.0012*smoothstep(3.,30.,distance);
    vec2 uv=clamp(vUv+distortion+flowDistort,vec2(.001),vec2(.999));
    vec3 color=texture2D(uColor,uv).rgb*transmission+volume;
    float vignette=1.-.12*pow(length((vUv-.5)*vec2(.82,1.)),2.);
    color*=vignette;color+=(jitter-.5)*.0012;
    gl_FragColor=vec4(max(color,vec3(0.)),1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
   }
  `});
  this.postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),this.post));
  this.resize();
 }
 resize(){const size=this.renderer.getDrawingBufferSize(new THREE.Vector2());this.target.setSize(size.x,size.y);this.post.uniforms.uResolution.value.copy(size)}
 apply(root){
  root.traverse(object=>{
   if(!object.isMesh)return;
   for(const material of Array.isArray(object.material)?object.material:[object.material]){
    if(!material.isMeshStandardMaterial||material.userData.waterLighting)continue;
    material.userData.waterLighting=true;
    const previous=material.onBeforeCompile,previousKey=material.customProgramCacheKey.bind(material);
    material.onBeforeCompile=shader=>{
     previous.call(material,shader);Object.assign(shader.uniforms,this.uniforms);
     shader.vertexShader='varying vec3 vWaterWorld;\n'+shader.vertexShader;
     shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`#include <project_vertex>
vec4 waterWorld=vec4(transformed,1.);
#ifdef USE_INSTANCING
waterWorld=instanceMatrix*waterWorld;
#endif
vWaterWorld=(modelMatrix*waterWorld).xyz;`);
     // Packing is already included by MeshStandardMaterial's fragment shader.
     shader.fragmentShader='varying vec3 vWaterWorld;\n'+shader.fragmentShader;
     shader.fragmentShader=shader.fragmentShader.replace('#include <packing>','#include <packing>\n'+waterFunctions);
     shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
      vec2 lightProjection=vWaterWorld.xz+uSunDirection.xz*(uSurfaceY-vWaterWorld.y)/max(uSunDirection.y,.25);
      float facing=max(dot(normal,normalize(mat3(viewMatrix)*uSunDirection)),0.);
      float caustic=waterCaustic(lightProjection*.72)*waterShadow(vWaterWorld)*facing;
      outgoingLight+=diffuseColor.rgb*caustic*.52*uCausticStrength;
      #include <opaque_fragment>
     `);
    };
    material.customProgramCacheKey=()=>previousKey()+' / underwater-caustic-v7';material.needsUpdate=true;
   }
  });
 }
 loadFlowMap(url,options={}){return this.flow.loadFlowMap(url,options).then(t=>{this.uniforms.uFluidFlow.value=t;return t})}
 render(time,options={}){
  this.flow.update(Math.max(0,Math.min(time-this.lastFlowTime,.08)),time);this.lastFlowTime=time;
  this.uniforms.uWaterTime.value=time;
  this.uniforms.uSunDirection.value.copy(this.sun.position).sub(this.sun.target.position).normalize();
  this.uniforms.uSurfaceY.value=17+(options.depth||0)/8;
  this.post.uniforms.uLight.value=options.light??1;
  const depth=Math.min((options.depth||0)/1800,1);
  this.post.uniforms.uExtinction.value.set(.050+depth*.025,.022+depth*.017,.013+depth*.013);
  this.post.uniforms.uScatterColor.value.set(.038-depth*.020,.22-depth*.14,.49-depth*.30);
  if(options.biome)this.post.uniforms.uScatterColor.value.fromArray(options.biome.scatter);
  this.renderer.setRenderTarget(this.target);this.renderer.render(this.scene,this.camera);
  this.lastSceneMetrics={...this.renderer.info.render};
  if(this.sun.shadow?.map){this.uniforms.uSunShadow.value=this.sun.shadow.map.texture;this.uniforms.uSunMatrix.value.copy(this.sun.shadow.matrix)}
  this.camera.updateMatrixWorld();this.post.uniforms.uInverseProjection.value.copy(this.camera.projectionMatrixInverse);
  this.post.uniforms.uCameraWorld.value.copy(this.camera.matrixWorld);this.post.uniforms.uCameraPosition.value.copy(this.camera.position);
  this.renderer.setRenderTarget(null);this.renderer.render(this.postScene,this.postCamera);
 }
}
