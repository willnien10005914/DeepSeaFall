import * as THREE from 'three';

// These fields stay in the exported character's metre-scale rest coordinates,
// so their colour and micro roughness follow the skin through swimming poses.
// The diffuse and pore-height textures are kept; this is a small material layer.
export function installPortraitSkin(material, appearance = {}) {
  const lipCenter = appearance.lipCenter ?? [0, 1.397, .126];
  const uniformValues = material.userData.portraitUniforms ?? {
    uPortraitLipShape: {value: new THREE.Vector4()},
    uPortraitTime: {value: 0},
    uPortraitLipGate: {value: new THREE.Vector2()},
    uPortraitCheekShape: {value: new THREE.Vector4()},
    uPortraitLipTint: {value: .34},
    uPortraitCheekTint: {value: .090},
  };
  uniformValues.uPortraitLipShape.value.set(
    lipCenter[0], lipCenter[1], appearance.lipWidth ?? .024, appearance.lipHeight ?? .010,
  );
  const lipGate = appearance.lipFrontGate ?? [.108, .122];
  uniformValues.uPortraitLipGate.value.set(lipGate[0], lipGate[1]);
  const cheekShape = appearance.cheekShape ?? [.038, 1.433, .022, .018];
  uniformValues.uPortraitCheekShape.value.fromArray(cheekShape);
  uniformValues.uPortraitLipTint.value = appearance.lipTint ?? .34;
  uniformValues.uPortraitCheekTint.value = appearance.cheekTint ?? .090;
  if (material.userData.portraitUniforms) return uniformValues;

  material.userData.portraitUniforms = uniformValues;
  const previousHook = material.onBeforeCompile;
  material.onBeforeCompile = shader => {
    previousHook.call(material, shader);
    Object.assign(shader.uniforms, uniformValues);
    shader.vertexShader = 'varying vec3 vPortraitRest;uniform float uPortraitTime;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>', `#include <begin_vertex>
      vPortraitRest = position;
      // Submillimetre expression motion follows the rest face before skinning.
      float expressionFront=smoothstep(.108,.126,position.z);
      float expressionArea=exp(-pow(abs((position.y-1.401)/.017),4.))*expressionFront;
      float smileCorner=exp(-pow(abs((abs(position.x)-.019)/.011),2.));
      transformed.y+=(sin(uPortraitTime*.71)*.00009+sin(uPortraitTime*1.13)*.00006)*smileCorner*expressionArea;
      transformed.z+=sin(uPortraitTime*.8)*.00008*exp(-pow(abs(position.x/.022),4.))*expressionArea;`,
    );
    shader.fragmentShader = `
      varying vec3 vPortraitRest;
      uniform vec4 uPortraitLipShape;
      uniform vec2 uPortraitLipGate;
      uniform vec4 uPortraitCheekShape;
      uniform float uPortraitLipTint;
      uniform float uPortraitCheekTint;
      float portraitHash(vec2 p) {
        vec3 q = fract(vec3(p.xyx) * .1031);
        q += dot(q, q.yzx + 33.33);
        return fract((q.x + q.y) * q.z);
      }
      float portraitNoise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        vec2 u = f * f * (3. - 2. * f);
        return mix(mix(portraitHash(i), portraitHash(i + vec2(1., 0.)), u.x),
                   mix(portraitHash(i + vec2(0., 1.)), portraitHash(i + vec2(1.)), u.x), u.y);
      }
    ` + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', '');
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
      #include <map_fragment>
      // Remove isolated dark pigment at the commissures using adjacent skin
      // texels, with a small continuous field rather than a painted dot.
      vec2 cornerP=vec2((abs(vPortraitRest.x)-.018)/.0045,(vPortraitRest.y-1.3998)/.0028);
      float cornerSoft=exp(-dot(cornerP,cornerP))*smoothstep(.104,.118,vPortraitRest.z);
      #ifdef USE_MAP
      vec3 cornerSkin=max(texture2D(map,vMapUv+vec2(0.,.005)).rgb,texture2D(map,vMapUv-vec2(0.,.005)).rgb);
      diffuseColor.rgb=mix(diffuseColor.rgb,max(diffuseColor.rgb,cornerSkin*.94),cornerSoft*.68);
      #endif
      // Anatomical masks are interpolated through the exported lip loops.
      float portraitUpperWeight = clamp(vColor.r,0.,1.);
      float portraitLowerWeight = clamp(vColor.g,0.,1.);
      float portraitLip = clamp(portraitUpperWeight+portraitLowerWeight,0.,1.);
      float portraitUpperLip = portraitUpperWeight/max(portraitUpperWeight+portraitLowerWeight,.0001);
      // Fade pigment through the anatomical border, keeping its fine skin
      // texture rather than drawing a solid outline around the lower lip.
      float portraitLipBlend = portraitLip * smoothstep(0., .32, portraitLip);
      vec3 portraitLipColour = mix(vec3(.41,.135,.145),vec3(.37,.108,.125),portraitUpperLip);
      diffuseColor.rgb = mix(diffuseColor.rgb,portraitLipColour,portraitLipBlend*uPortraitLipTint);
      float portraitSeam = clamp(vColor.b,0.,1.) * (1.-smoothstep(.012,.0185,abs(vPortraitRest.x)));
      diffuseColor.rgb = mix(diffuseColor.rgb,vec3(.29,.081,.099),portraitSeam*.10);
      vec2 portraitCheekP = vec2(abs(vPortraitRest.x) - uPortraitCheekShape.x,
                               vPortraitRest.y - uPortraitCheekShape.y) / uPortraitCheekShape.zw;
      float portraitCheek = exp(-dot(portraitCheekP, portraitCheekP))
                           * smoothstep(.055, .105, vPortraitRest.z);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.66, .26, .27), portraitCheek * uPortraitCheekTint);
    `);
    shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', `
      #include <roughnessmap_fragment>
      vec2 portraitPoreP = vPortraitRest.xy + vPortraitRest.z * vec2(.231, .417);
      float portraitPixelSize = max(length(dFdx(vPortraitRest)), length(dFdy(vPortraitRest)));
      float portraitPoreFade = 1. - smoothstep(.00045, .0018, portraitPixelSize);
      float portraitPores = (portraitNoise(portraitPoreP * 620.) - .5) * .034;
      portraitPores += (portraitNoise(portraitPoreP * 1750. + 17.1) - .5) * .010;
      roughnessFactor = clamp(roughnessFactor + portraitPores * portraitPoreFade, .50, .56);
      // The central cushions receive soft moisture; the rim fades back into
      // skin roughness so a continuous glossy edge cannot form a rigid capsule.
      float portraitCushion = smoothstep(.18, .82, portraitLip);
      roughnessFactor = mix(roughnessFactor, .45, portraitUpperWeight * portraitCushion * .68);
      roughnessFactor = mix(roughnessFactor, .41, portraitLowerWeight * portraitCushion * .70);
      roughnessFactor = mix(roughnessFactor, .53, portraitSeam * .65);
    `);
  };
  material.customProgramCacheKey = () => 'reference-portrait-skin-v27';
  material.needsUpdate = true;
  return uniformValues;
}
