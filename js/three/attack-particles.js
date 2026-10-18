import * as THREE from 'three';

let sprite;
export function grainTexture(){
  if (sprite) return sprite;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const paint = canvas.getContext('2d');
  const glow = paint.createRadialGradient(32, 32, 0, 32, 32, 32);
  glow.addColorStop(0, 'rgba(255,255,255,1)');
  glow.addColorStop(0.22, 'rgba(255,255,255,0.72)');
  glow.addColorStop(0.55, 'rgba(255,255,255,0.22)');
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  paint.fillStyle = glow;
  paint.fillRect(0, 0, 64, 64);
  sprite = new THREE.CanvasTexture(canvas);
  sprite.colorSpace = THREE.SRGBColorSpace;
  return sprite;
}

export class FlowGrains {
  constructor(capacity, parent){
    this.capacity = capacity;
    this.positions = new Float32Array(capacity * 3);
    this.colors = new Float32Array(capacity * 3);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    geometry.setDrawRange(0, 0);
    this.material = new THREE.PointsMaterial({
      map: grainTexture(),
      size: 0.07,
      transparent: true,
      opacity: 0.92,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
      toneMapped: false,
      vertexColors: true,
      sizeAttenuation: true,
    });
    this.points = new THREE.Points(geometry, this.material);
    this.points.frustumCulled = false;
    this.points.visible = false;
    this.points.renderOrder = 3;
    parent.add(this.points);
    this.cursor = 0;
  }
  begin(){ this.cursor = 0; }
  push(x, y, z, r, g, b){
    if (this.cursor >= this.capacity) return;
    const index = this.cursor * 3;
    this.positions[index] = x;
    this.positions[index + 1] = y;
    this.positions[index + 2] = z;
    this.colors[index] = r;
    this.colors[index + 1] = g;
    this.colors[index + 2] = b;
    this.cursor += 1;
  }
  end(size = 0.07){
    const geometry = this.points.geometry;
    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.color.needsUpdate = true;
    geometry.setDrawRange(0, this.cursor);
    this.material.size = size;
    this.points.visible = this.cursor > 0;
  }
}
