import * as THREE from 'three';
import {MeshBVH,CENTER} from '../vendor/three-mesh-bvh.js';
const p=new THREE.Vector3(),nearest={point:new THREE.Vector3()},inverse=new THREE.Matrix4(),sphereBox=new THREE.Box3(),box=new THREE.Box3(),normal=new THREE.Vector3(),a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),triangle=new THREE.Triangle(),insideRay=new THREE.Ray(),insideDirection=new THREE.Vector3(.819,.111,.563).normalize();
// Broad phase uses world boxes; the narrow phase checks the visible triangles.
// Seven body spheres follow the live skeleton, including head-first strokes.
export class RockContacts{
 constructor(){this.cache=new WeakMap();this.last={contacts:0,meshes:0};}
 body(root){root.updateMatrixWorld(true);const bones=root.userData.bones;const point=n=>bones[n].getWorldPosition(new THREE.Vector3());const head=point('head'),hips=point('hips'),feet=point('l_foot').add(point('r_foot')).multiplyScalar(.5);return[{center:head,radius:.135},{center:head.clone().lerp(hips,.45),radius:.205},{center:hips,radius:.18},{center:hips.clone().lerp(feet,.52),radius:.14},{center:feet,radius:.12},{center:point('l_elbow'),radius:.095},{center:point('r_elbow'),radius:.095}];}
 pickupDistance(root,position){const body=this.body(root);let distance=Infinity;for(const s of body)distance=Math.min(distance,s.center.distanceTo(position)-s.radius);return distance;}
 resolve(root,meshes){let contacts=[];const body=this.body(root);sphereBox.makeEmpty();for(const s of body){box.setFromCenterAndSize(s.center,new THREE.Vector3(s.radius*2,s.radius*2,s.radius*2));sphereBox.union(box)}sphereBox.expandByScalar(.03);let tested=0;
 for(const mesh of meshes){if(!mesh.visible||!mesh.geometry?.index)continue;mesh.updateWorldMatrix(true,false);const geo=mesh.geometry;if(!geo.boundingBox)geo.computeBoundingBox();box.copy(geo.boundingBox).applyMatrix4(mesh.matrixWorld);if(!box.intersectsBox(sphereBox))continue;
  let tree=this.cache.get(geo);if(!tree){tree=new MeshBVH(geo,{strategy:CENTER,maxLeafTris:8,indirect:true});this.cache.set(geo,tree)}tested++;inverse.copy(mesh.matrixWorld).invert();const scale=mesh.getWorldScale(new THREE.Vector3()),minScale=Math.min(Math.abs(scale.x),Math.abs(scale.y),Math.abs(scale.z));
  for(const s of body){p.copy(s.center).applyMatrix4(inverse);const radius=s.radius/Math.max(minScale,.001),result=tree.closestPointToPoint(p,nearest,0,Infinity);if(!result)continue;
   const indices=geo.index,offset=result.faceIndex*3;a.fromBufferAttribute(geo.attributes.position,indices.getX(offset));b.fromBufferAttribute(geo.attributes.position,indices.getX(offset+1));c.fromBufferAttribute(geo.attributes.position,indices.getX(offset+2));triangle.set(a,b,c);triangle.getNormal(normal);
   // The canyon wall is an open surface. Closed rocks can contain a sphere
   // centre, so their outward triangle normal also handles deep overlaps.
   const signed=p.clone().sub(nearest.point).dot(normal),wall=mesh.name.startsWith('continuous_cliff');
   let inside=false;if(!wall&&signed<0){insideRay.origin.copy(p);insideRay.direction.copy(insideDirection);const exit=tree.raycastFirst(insideRay,THREE.DoubleSide);inside=!!exit&&exit.face.normal.dot(insideDirection)>0;}
   if(result.distance>=radius&&!inside)continue;
   if(!inside)normal.subVectors(p,nearest.point).normalize();
   normal.transformDirection(mesh.matrixWorld);const worldPoint=nearest.point.clone().applyMatrix4(mesh.matrixWorld),distance=s.center.distanceTo(worldPoint),penetration=s.radius-(inside?-distance:distance);
   if(penetration<=0)continue;const correction=normal.clone().multiplyScalar(Math.min(penetration+.004,.22));root.position.add(correction);for(const other of body)other.center.add(correction);contacts.push({mesh,normal:normal.clone(),point:worldPoint,penetration});
  }
 }
 root.updateMatrixWorld(true);this.last={contacts:contacts.length,meshes:tested};return contacts;
 }
}
