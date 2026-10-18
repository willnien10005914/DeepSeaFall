# Ocean life and swimmer wake — revision 6

Reference: the two user-supplied Incheon Girl and Whale frames, showing entrained bubbles and a deep, fractured underwater canyon.

The swimmer now emits depth-tested instanced 3D bubble shells around the hands, ankles, hair and garment. The emission responds to the swim cycle and movement; acceleration adds a short burst and a denser wake. Each bubble drifts, rises, wobbles, expands slightly and fades. Rest reduces emission and restarting clears the previous wake. Fresnel rims and sun glints retain transparent centres. The pool is bounded at 420 bubbles and uses one instanced mesh.

Silver fish have a tapered continuous body, gill covers, paired eyes, forked caudal fins and translucent ray-supported membranes. Dedicated albedo, normal and packed roughness maps add subtle scale relief, a darker back and a pale underside. A GPU travelling lateral wave bends the body and fins; schools share a direction but use varied spacing and phase. Moon jellies have a lobed transparent bell, four internal gonads, folded oral arms and twenty curved tentacles. Bell contraction and trailing movement animate together. Background fish and jellies inhabit the canyon from the start. Interactive creature population is capped at twenty and removed entity materials are released.

Rock meshes now have chipped angular profiles, strata and narrow fissures. Taller-resolution periodic canyon walls and two distant bridges formed from overlapping fractured stone chunks add scale and depth. Collision rocks share the photographed CC0 Poly Haven rock material with the scenery. Scanned height darkens crevices; the scene uses a more contrasty underwater tone curve. The existing environment/CREDITS.json retains the photographic texture attribution.

The game, model review and cinematic share these assets. The model review includes an additional Fish and Jelly view. Existing girl/whale geometry and the nine-joint whale animator are retained.

Validation artifacts: assets/previews/v6/verification.json and post-deployment-smoke.json. The video bubbles-marine-and-rocks.mp4 is twelve seconds of the actual WebGL game captured with fixed simulation steps, including summon, drag, boost, rest and wake. Capture rate does not establish device performance. Geometry and shading remain editable in js/three/marine-life.js, ocean-real.js and swim-bubbles.js; fish maps can be regenerated with assets/scripts/marine_textures.py.
