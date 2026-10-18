# Whale revision 5

Visual reference: the user-supplied Incheon Girl and Whale styleframe. The linked Behance page returned HTTP 403; its original meshes and animation were not available. This is an independently authored realtime model, not a claim of a pixel-identical copy of the original film.

- Corrected the image-row/GLTF V flip, which had reversed the original dorsal and ventral skin layout.
- Built 2048 × 1024 albedo, normal and packed roughness maps with irregular pigmentation, restrained pores, healed scars and distinct fin undersides. Nonmetallic wet skin uses variable roughness and a modest clearcoat.
- Refined the broad upper rostrum and lower jaw, mouth seam, eye surrounds, ventral pleats and rostral tubercles. Sparse attached barnacles include raised shell geometry and darker openings.
- Replaced CPU Y offsets with nine GPU-skinned joints. A travelling vertical bend drives the lumbar region, peduncle and feathered flukes; the chest and head retain their mass. Independent pectoral roots and tips respond to banking and lift.
- Following uses eased pursuit, continuously integrated stroke phase and movement-dependent effort. Summoning and restart remain functional. The game, model viewer and cinematic share this model and animator.

Verification: inspect assets/previews/v5/verification.json and asset-verification.json. Recorded video is actual WebGL gameplay with fixed simulation steps, not a video backdrop; capture speed does not represent device frame rate. Runtime rig and motion are in js/three/whale-motion.js; GLB and USD contain the editable geometry and materials.
