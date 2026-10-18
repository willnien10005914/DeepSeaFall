import * as THREE from 'three';
import {ConvexHull} from 'three/addons/math/ConvexHull.js';
import {mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
import {MeshBVH,CENTER} from '../vendor/three-mesh-bvh.js';
import {installFabricDamage} from './injury-effects.js?v=48';
// A shorter, pose-fitted sleep gown crossfades as the knees gather.
// The neckline and limb openings are rebuilt against the current posed skin.
export class SleepCloth{
 constructor(root){
  this.root=root;this.original=root.getObjectByName('dress_skirt');this.body=root.getObjectByName('skin_body_collider');this.skin=root.getObjectByName('skin_body');this.ids=[];
  const rest=this.body.geometry.attributes.position;
  for(const i of new Set(this.body.geometry.index.array)){const x=rest.getX(i),y=rest.getY(i);if(y>.46&&y<1.60&&!(y>.80&&Math.abs(x)>.20||y>1.05&&Math.abs(x)>.167))this.ids.push(i)}
  const material=this.original.material.clone();installFabricDamage(material,root.userData.fabricDamage,true);
  this.mesh=new THREE.Mesh(new THREE.BufferGeometry(),material);this.mesh.name='Sleep fitted folded gown';this.mesh.castShadow=true;this.mesh.receiveShadow=true;this.mesh.visible=false;root.add(this.mesh);
  const source=this.skin.geometry,indices=[],p=source.attributes.position;
  for(let i=0;i<source.index.count;i+=3){const ids=[source.index.getX(i),source.index.getX(i+1),source.index.getX(i+2)];indices.push(...ids)}
  this.armGeometry=new THREE.BufferGeometry();this.armGeometry.setAttribute('position',p.clone());this.armGeometry.setIndex(indices);this.armIds=[...new Set(indices)];this.armTree=new MeshBVH(this.armGeometry,{strategy:CENTER,maxLeafTris:8,indirect:true});
  this.coverage={value:0};this.originalMaterial=this.original.material;this.fadeMaterial=this.originalMaterial.clone();installFabricDamage(this.fadeMaterial,root.userData.fabricDamage);this.original.material=this.fadeMaterial;this.strapMaterials=new Map(root.userData.clothContact.clothes.filter(m=>m.name.startsWith('dress_strap')).map(m=>[m,m.material]));this.active=false;this.lastTime=-Infinity;this.lastBlend=-1;this.expansion=1.13;
 }
 reset(){this.active=false;this.coverage.value=0;this.fadeMaterial.opacity=1;this.fadeMaterial.transparent=true;this.fadeMaterial.depthWrite=true;this.mesh.visible=false;this.original.visible=true;for(const m of this.root.userData.clothContact.clothes)if(m.name.startsWith('dress_strap'))m.visible=true;this.lastTime=-Infinity;}
 update(time,blend){
  const u=THREE.MathUtils.clamp((blend-.20)/.35,0,1),gather=u*u*(3-2*u);this.coverage.value=gather;this.fadeMaterial.opacity=1-gather;this.fadeMaterial.transparent=true;this.fadeMaterial.depthWrite=gather===0;this.mesh.material.opacity=gather;this.mesh.material.transparent=true;this.mesh.material.depthWrite=gather===1;if(gather<=.00001){if(this.active)this.root.userData.clothContact.reset();this.reset();return false;}
  if(!this.active)this.root.userData.clothContact.reset();this.active=true;this.mesh.visible=true;this.original.visible=gather<.99999;for(const m of this.root.userData.clothContact.clothes)if(m.name.startsWith('dress_strap'))m.visible=true;
  if(time-this.lastTime<.12&&Math.abs(blend-this.lastBlend)<.025)return gather>.99999;
  const start=performance.now(),rest=this.body.geometry.attributes.position;this.root.updateMatrixWorld(true);this.skin.skeleton.update();
  const points=this.ids.map(id=>{const p=this.body.getVertexPosition(id,new THREE.Vector3());p.restY=rest.getY(id);return p});
  const skinRest=this.skin.geometry.attributes.position;
  for(const i of new Set(this.skin.geometry.index.array)){const y=skinRest.getY(i),x=skinRest.getX(i);if(i%4===0&&y>.46&&y<1.600&&!(y>.80&&Math.abs(x)>.20||y>1.05&&Math.abs(x)>.135)){const p=this.skin.getVertexPosition(i,new THREE.Vector3());p.restY=y;points.push(p)}}
  const centre=points.reduce((a,b)=>a.add(b),new THREE.Vector3()).multiplyScalar(1/points.length),hull=new ConvexHull().setFromPoints(points),vertices=[];
  const refine=(a,b,c,depth=0)=>{if(depth<5&&Math.max(a.distanceTo(b),b.distanceTo(c),c.distanceTo(a))>.032){const ab=a.clone().add(b).multiplyScalar(.5),bc=b.clone().add(c).multiplyScalar(.5),ca=c.clone().add(a).multiplyScalar(.5);refine(a,ab,ca,depth+1);refine(ab,b,bc,depth+1);refine(ca,bc,c,depth+1);refine(ab,bc,ca,depth+1);}else vertices.push(...a.toArray(),...b.toArray(),...c.toArray());};
  for(const face of hull.faces){let edge=face.edge;const v=[];do{v.push(edge.head().point);edge=edge.next;}while(edge!==face.edge);if(v.some(p=>p.restY>1.223)||v.every(p=>p.restY<.475))continue;const q=v.map(p=>p.clone().sub(centre).multiplyScalar(this.expansion).add(centre));refine(q[0],q[1],q[2]);}
  const raw=new THREE.BufferGeometry();raw.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));const geometry=mergeVertices(raw,1e-5);raw.dispose();geometry.computeVertexNormals();const normals=geometry.attributes.normal,foldPositions=geometry.attributes.position;for(let i=0;i<foldPositions.count;i++){const x=foldPositions.getX(i),y=foldPositions.getY(i),z=foldPositions.getZ(i),angle=Math.atan2(x,z-.03),fold=.003+.003*Math.sin(y*32+angle*8);foldPositions.setXYZ(i,x+normals.getX(i)*fold,y+normals.getY(i)*fold,z+normals.getZ(i)*fold);}geometry.computeVertexNormals();
  const ap=this.armGeometry.attributes.position,p=new THREE.Vector3();for(const i of this.armIds){this.skin.getVertexPosition(i,p);ap.setXYZ(i,p.x,p.y,p.z)}this.armTree.refit();
  const clothTree=new MeshBVH(geometry,{strategy:CENTER,maxLeafTris:8,indirect:true}),blocked=new Set();
  this.armTree.bvhcast(clothTree,new THREE.Matrix4(),{intersectsTriangles:(a,b,ai,bi)=>{if(a.intersectsTriangle(b)){const index=clothTree.resolveTriangleIndex(bi);for(let j=0;j<3;j++)blocked.add(geometry.index.getX(index*3+j));}return false;}});
  const keep=[];for(let i=0;i<geometry.index.count;i+=3){const ids=[geometry.index.getX(i),geometry.index.getX(i+1),geometry.index.getX(i+2)];if(!ids.some(j=>blocked.has(j)))keep.push(...ids)}geometry.setIndex(keep);geometry.computeVertexNormals();
  const pos=geometry.attributes.position;let minY=Infinity,maxY=-Infinity;for(let i=0;i<pos.count;i++){minY=Math.min(minY,pos.getY(i));maxY=Math.max(maxY,pos.getY(i))}const uv=[];for(let i=0;i<pos.count;i++)uv.push(Math.atan2(pos.getX(i),pos.getZ(i)-.03)/Math.PI*.5+.5,(pos.getY(i)-minY)/Math.max(.01,maxY-minY));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  this.mesh.geometry.dispose();this.mesh.geometry=geometry;this.lastTime=time;this.lastBlend=blend;this.lastStats={selectedBodyPoints:points.length,faces:keep.length/3,vertices:pos.count,armOpeningVertices:blocked.size,milliseconds:performance.now()-start,active:true,coverage:gather,kneeLength:true};return gather>.99999;
 }
 audit(){if(!this.active)return{active:false};const body=this.skin.geometry.clone(),pos=body.attributes.position,p=new THREE.Vector3();for(let i=0;i<pos.count;i++){this.skin.getVertexPosition(i,p);pos.setXYZ(i,p.x,p.y,p.z)}const tree=new MeshBVH(body,{strategy:CENTER,maxLeafTris:8,indirect:true}),cloth=new MeshBVH(this.mesh.geometry,{strategy:CENTER,maxLeafTris:8,indirect:true});let count=0,example=null;tree.bvhcast(cloth,new THREE.Matrix4(),{intersectsTriangles:(a,b)=>{if(a.intersectsTriangle(b)){count++;if(!example)example={body:[a.a.toArray(),a.b.toArray(),a.c.toArray()],cloth:[b.a.toArray(),b.b.toArray(),b.c.toArray()]}}return count>1000;}});body.dispose();return{active:true,actualBodyTriangleIntersections:count,example,...this.lastStats};}
}
