# Revision 29: body/garment contact, head-first diving and solid hair locks

A hidden, closed anatomical collision shell follows the same 19-bone pose as the rendered skin. A verified MIT-licensed three-mesh-bvh 0.9.2 refits its triangle hierarchy each pose. Garment vertices are projected outside the body with a nominal 6 mm clearance; whole-triangle separation then resolves edges crossing both the closed proxy and the actual rendered, skinned body. The visible-body hierarchy is independently posed and refitted; it is not assumed identical to the collision proxy. Corrections are inverted through each vertex's actual blended skin matrix. A decaying contact buffer releases folds gradually. This is runtime body/garment contact, not cloth self-collision or a full fabric simulation.

The shoulder straps are re-arched and the garment export avoids redundant subdivision / duplicate solidify surfaces so collision can run per frame. Tuck range and breaststroke arm paths are limited to a garment-compatible motion range. The editable Blender project retains the authored model and actions; runtime contact results are not baked into its cloth mesh.

A thirteenth native/Rigify action adds streamlined head-first swimming. Sustained downward manual movement requests it, and automatic descent periodically blends into it. The pelvis orientation aims the body toward the seabed while gaze influence reduces during a dive. Neutral pitch also reduces habitual backward lean.

Forty-eight closed elliptical hair locks replace the added flat volume layers. They have actual cross-sections (about 4.4–6 mm thick), distinct depth, tapered caps and outward normals, grouped into three mesh draw calls. Existing layered long fibres, curled tips and visible ear-front sideburns remain.

Validation includes 13 actions x four phases (52 poses), with full garment vertex and triangle intersection audits against the closed shell and independently evaluated actual visible skin; head-first poses must put the head below the pelvis with downward alignment >0.9. Hair volumes are checked as 48 watertight positive-volume components. Continuous gameplay, screenshots, a 30-second movie and installed-file hashes are also recorded.

Dependency: https://github.com/gkjohnson/three-mesh-bvh ; its MIT license is included in js/vendor/three-mesh-bvh.LICENSE. Cell Fluids original-package status remains unchanged.
