import * as THREE from 'three';
import {MeshBVH,CENTER,SAH} from '../vendor/three-mesh-bvh.js';
// Post-skin positional contact constraints against the full anatomical shell.
// Garment corrections are transformed back through the exact blended matrix,
// so the GPU applies the same contact result rather than skinning it twice.
const p=new THREE.Vector3(),q=new THREE.Vector3(),n=new THREE.Vector3(),a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),bary=new THREE.Vector3(),delta=new THREE.Vector3();
const garmentNormal=new THREE.Vector3();
const escapeRay=new THREE.Ray(),escapeDirection=new THREE.Vector3();
const triangle=new THREE.Triangle(),hit={point:new THREE.Vector3()},temp=new THREE.Matrix4();
const solverRotation=new THREE.Matrix4();
function matrices(mesh){const s=mesh.skeleton;s.update();return s.bones.map((bone,i)=>new THREE.Matrix4().copy(mesh.bindMatrixInverse).multiply(bone.matrixWorld).multiply(s.boneInverses[i]).multiply(mesh.bindMatrix).premultiply(solverRotation));}
function blend(mesh,i,mats,out){const w=mesh.geometry.attributes.skinWeight,j=mesh.geometry.attributes.skinIndex,e=out.elements;e.fill(0);for(let k=0;k<4;k++){const weight=w.array[i*4+k];if(!weight)continue;const m=mats[j.array[i*4+k]].elements;for(let t=0;t<16;t++)e[t]+=m[t]*weight}return out;}
export class ClothContact{
 constructor(root,proxy,clothes){this.root=root;this.proxy=proxy;this.clothes=clothes;this.geometry=proxy.geometry.clone();this.geometry.deleteAttribute('skinIndex');this.geometry.deleteAttribute('skinWeight');this.rest=proxy.geometry.attributes.position.array;this.used=[...new Set(proxy.geometry.index.array)];this.bvh=new MeshBVH(this.geometry,{strategy:SAH,maxLeafTris:8});this.clearance=.006;this.offsets=new Map(clothes.map(m=>[m,new Float32Array(m.geometry.attributes.position.count*3)]));this.restNormals=new Map(clothes.map(m=>[m,m.geometry.attributes.normal.array.slice()]));this.testRay=new THREE.Ray();this.testDirection=new THREE.Vector3(.819,.111,.563).normalize();this.welds=new Map();for(const mesh of clothes){const a=mesh.geometry.attributes.position,groups=new Map();for(let i=0;i<a.count;i++){const key=[a.getX(i),a.getY(i),a.getZ(i)].map(v=>Math.round(v*1e5)).join(',');if(!groups.has(key))groups.set(key,[]);groups.get(key).push(i)}const aliases=new Map();for(const ids of groups.values())if(ids.length>1)for(const i of ids)aliases.set(i,ids);this.welds.set(mesh,aliases)}this.visibleSkin=root.getObjectByName('skin_body');this.visibleGeometry=this.visibleSkin.geometry.clone();this.visibleRest=this.visibleSkin.geometry.attributes.position.array.slice();this.visibleBVH=new MeshBVH(this.visibleGeometry,{strategy:SAH,maxLeafTris:8});this.faceGeometry=new Map();this.steps=0;this.lastStats={};}
 inside(point){this.testRay.origin.copy(point);this.testRay.direction.copy(this.testDirection);const hits=this.bvh.raycast(this.testRay,THREE.DoubleSide).sort((a,b)=>a.distance-b.distance);let winding=0,last=-1;for(const h of hits){if(h.distance<1e-6||Math.abs(h.distance-last)<1e-5)continue;last=h.distance;winding+=Math.sign(h.face.normal.dot(this.testDirection))}return winding!==0;}
 update(dt){const start=performance.now();this.root.updateMatrixWorld(true);
  // Keep the acceleration structure aligned with the torso when swimming sideways.
  solverRotation.makeRotationFromQuaternion(this.root.userData.bones.hips.getWorldQuaternion(new THREE.Quaternion()).invert());
  const pose=matrices(this.proxy),pos=this.geometry.attributes.position;
  for(const i of this.used){p.fromArray(this.rest,i*3).applyMatrix4(blend(this.proxy,i,pose,temp));pos.setXYZ(i,p.x,p.y,p.z)}pos.needsUpdate=true;this.bvh.refit();const visiblePose=matrices(this.visibleSkin),visiblePos=this.visibleGeometry.attributes.position;for(let i=0;i<visiblePos.count;i++){p.fromArray(this.visibleRest,i*3).applyMatrix4(blend(this.visibleSkin,i,visiblePose,temp));visiblePos.setXYZ(i,p.x,p.y,p.z)}this.visibleBVH.refit();let corrected=0,queries=0,maxCorrection=0;
  const index=this.geometry.index,normals=this.geometry.attributes.normal;
  for(const mesh of this.clothes){const attr=mesh.geometry.attributes.position,data=attr.array,offset=this.offsets.get(mesh),mats=matrices(mesh),inv=new THREE.Matrix4();
   for(let i=0;i<attr.count;i++){
    const k=i*3,bx=data[k],by=data[k+1],bz=data[k+2];const decay=Math.exp(-dt*13);p.set(bx+offset[k]*decay,by+offset[k+1]*decay,bz+offset[k+2]*decay);blend(mesh,i,mats,temp);p.applyMatrix4(temp);const ox=p.x,oy=p.y,oz=p.z;let touched=false;garmentNormal.fromArray(this.restNormals.get(mesh),k).transformDirection(temp);
    escapeRay.origin.copy(p).addScaledVector(garmentNormal,.035);escapeRay.direction.copy(garmentNormal).negate();const envelope=this.bvh.raycastFirst(escapeRay,THREE.DoubleSide,0,.070);
    if(envelope){q.copy(envelope.point).addScaledVector(garmentNormal,this.clearance+.001);if(delta.subVectors(q,p).dot(garmentNormal)>0){p.copy(q);touched=true;}}

    for(let pass=0;pass<12;pass++){
     queries++;const result=this.bvh.closestPointToPoint(p,hit,0,.18);if(!result)break;
     const f=result.faceIndex*3,ia=index.getX(f),ib=index.getX(f+1),ic=index.getX(f+2);a.fromBufferAttribute(pos,ia);b.fromBufferAttribute(pos,ib);c.fromBufferAttribute(pos,ic);triangle.set(a,b,c);triangle.getNormal(n);
     let signed=delta.subVectors(p,hit.point).dot(n);
     if(signed<0&&!this.inside(p)){if(result.distance>=this.clearance-.00005)break;n.subVectors(p,hit.point).normalize();signed=result.distance;}
     if(signed>=this.clearance-.00005)break;
     p.copy(hit.point).addScaledVector(n,this.clearance+.0004);touched=true;
    }
    if(touched){
     const nearest=this.bvh.closestPointToPoint(p,hit,0,.18);
     if(nearest){const f=nearest.faceIndex*3;a.fromBufferAttribute(pos,index.getX(f));b.fromBufferAttribute(pos,index.getX(f+1));c.fromBufferAttribute(pos,index.getX(f+2));triangle.set(a,b,c);triangle.getNormal(n);
      if(delta.subVectors(p,hit.point).dot(n)<this.clearance-.0001){const candidate=new THREE.Vector3(),best=new THREE.Vector3();let bestCost=Infinity;
       for(const dir of [n,new THREE.Vector3(1,0,0),new THREE.Vector3(-1,0,0),new THREE.Vector3(0,1,0),new THREE.Vector3(0,-1,0),new THREE.Vector3(0,0,1),new THREE.Vector3(0,0,-1)]){
        escapeDirection.copy(dir);escapeRay.origin.copy(p).addScaledVector(escapeDirection,2);escapeRay.direction.copy(escapeDirection).negate();const outer=this.bvh.raycastFirst(escapeRay,THREE.DoubleSide,0,4);if(!outer)continue;candidate.copy(outer.point).addScaledVector(escapeDirection,this.clearance+.001);const cost=candidate.distanceToSquared(p);if(cost<bestCost&&!this.inside(candidate)){bestCost=cost;best.copy(candidate)}
       }if(bestCost<Infinity)p.copy(best);}
     }
     corrected++;maxCorrection=Math.max(maxCorrection,Math.hypot(p.x-ox,p.y-oy,p.z-oz))}
    if(!touched&&offset[k]===0&&offset[k+1]===0&&offset[k+2]===0)continue;
    inv.copy(temp).invert();p.applyMatrix4(inv);data[k]=p.x;data[k+1]=p.y;data[k+2]=p.z;offset[k]=p.x-bx;offset[k+1]=p.y-by;offset[k+2]=p.z-bz;
   }
   attr.needsUpdate=true;
  }
  const faceStats=this.resolveFaces();
  this.steps++;this.lastStats={steps:this.steps,corrected,queries,maxCorrection,clearance:this.clearance,faceStats,milliseconds:performance.now()-start};this.root.userData.clothContactStats=this.lastStats;
 }
 resolveFaces(){let total=0,last=0,passes=0,remaining=0;
  for(const mesh of this.clothes){let g=this.faceGeometry.get(mesh);if(!g){g=mesh.geometry.clone();g.boundsTree=new MeshBVH(g,{strategy:CENTER,maxLeafTris:8});this.faceGeometry.set(mesh,g)}const attr=mesh.geometry.attributes.position,vertices=g.attributes.position,mats=matrices(mesh),inverse=new THREE.Matrix4(),offset=this.offsets.get(mesh);
   for(let i=0;i<vertices.count;i++){p.fromBufferAttribute(attr,i).applyMatrix4(blend(mesh,i,mats,temp));vertices.setXYZ(i,p.x,p.y,p.z)}
   const aliases=this.welds.get(mesh);const welded=new Set();for(const [i,ids] of aliases){if(welded.has(i))continue;const direction=new THREE.Vector3().fromArray(this.restNormals.get(mesh),i*3).transformDirection(blend(mesh,i,mats,temp));let best=-Infinity;for(const j of ids){p.fromBufferAttribute(vertices,j);const score=p.dot(direction);if(score>best){best=score;q.copy(p)}}for(const j of ids){vertices.setXYZ(j,q.x,q.y,q.z);welded.add(j)}}
   // Keep contact solving bounded per frame; poses are solved again next frame.
   for(let pass=0;pass<12;pass++){g.boundsTree.refit();const constraints=[];
    for(const bodyTree of [this.bvh,this.visibleBVH])bodyTree.bvhcast(g.boundsTree,new THREE.Matrix4(),{intersectsTriangles:(bt,ct,bi,ci)=>{if(bt.intersectsTriangle(ct)){const normal=bt.getNormal(new THREE.Vector3());constraints.push({ids:[g.index.getX(ci*3),g.index.getX(ci*3+1),g.index.getX(ci*3+2)],normal,origin:bt.a.clone()})}return false}});
    passes++;last=constraints.length;if(!last)break;total+=last;
    for(const contact of constraints)for(const i of contact.ids){p.fromBufferAttribute(vertices,i);const distance=delta.subVectors(p,contact.origin).dot(contact.normal);if(distance<this.clearance){p.addScaledVector(contact.normal,this.clearance+.001-distance);for(const j of aliases.get(i)||[i])vertices.setXYZ(j,p.x,p.y,p.z)}}
   }
   remaining+=last;
   for(let i=0;i<vertices.count;i++){p.fromBufferAttribute(vertices,i);inverse.copy(blend(mesh,i,mats,temp)).invert();p.applyMatrix4(inverse);const k=i*3;offset[k]+=p.x-attr.getX(i);offset[k+1]+=p.y-attr.getY(i);offset[k+2]+=p.z-attr.getZ(i);attr.setXYZ(i,p.x,p.y,p.z)}
   attr.needsUpdate=true;mesh.geometry.computeVertexNormals();
  }return{constraints:total,last,remaining,passes};
 }
 reset(){for(const a of this.offsets.values())a.fill(0);this.steps=0;}
 // Independent full-vertex signed-distance audit; also used by motion QA.
 audit(checkTriangles=false){let minimum=Infinity,penetrating=0,near=0;const triangleIntersections=[];const index=this.geometry.index,pos=this.geometry.attributes.position;for(const mesh of this.clothes){const mats=matrices(mesh),attr=mesh.geometry.attributes.position;for(let i=0;i<attr.count;i++){p.fromBufferAttribute(attr,i).applyMatrix4(blend(mesh,i,mats,temp));const result=this.bvh.closestPointToPoint(p,hit,0,.12);if(!result)continue;const f=result.faceIndex*3;a.fromBufferAttribute(pos,index.getX(f));b.fromBufferAttribute(pos,index.getX(f+1));c.fromBufferAttribute(pos,index.getX(f+2));triangle.set(a,b,c);triangle.getNormal(n);let signed=delta.subVectors(p,hit.point).dot(n);if(signed<0&&!this.inside(p))signed=Math.abs(signed);minimum=Math.min(minimum,signed);if(signed<-.0005)penetrating++;near++;}
 if(checkTriangles){const g=mesh.geometry.clone(),vertices=g.attributes.position;for(let i=0;i<vertices.count;i++){p.fromBufferAttribute(vertices,i).applyMatrix4(blend(mesh,i,mats,temp));vertices.setXYZ(i,p.x,p.y,p.z)}g.computeBoundingBox();g.boundsTree=new MeshBVH(g,{strategy:CENTER,maxLeafTris:8});let count=0,example=null;this.bvh.bvhcast(g.boundsTree,new THREE.Matrix4(),{intersectsTriangles:(bt,ct,bi,ci)=>{if(bt.intersectsTriangle(ct)){count++;if(!example)example={body:[bt.a.toArray(),bt.b.toArray(),bt.c.toArray()],cloth:[ct.a.toArray(),ct.b.toArray(),ct.c.toArray()],ci};return count>1000}return false}});if(count)triangleIntersections.push({mesh:mesh.name,count,example});g.dispose();}
 }
 return{minimumSignedDistance:minimum,penetratingVertices:penetrating,checked:near,triangleIntersections};}
}
