// Shared depth-to-world scale; all scenery follows actual descent, not a clock.
export const descentTravel=(depth,parallax=1)=>Math.max(0,depth)*.48*parallax;
export function movingSlice(restY,depth,{span=28,bottom=-14,parallax=1}={}){const worldY=restY+descentTravel(depth,parallax),cycle=Math.floor((worldY-bottom)/span);return{y:worldY-cycle*span,cycle};}
