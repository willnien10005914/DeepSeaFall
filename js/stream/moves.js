import {combatMoves} from '../three/combat-definitions.js?v=50';
const elements={fire:'火焰',ice:'寒冰','cold-fire':'冷火'};
export const moves=combatMoves.map(m=>[m.id,m.name,m.charge,m.cooldown,elements[m.element]]);
