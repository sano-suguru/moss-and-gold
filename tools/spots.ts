import { generate } from '../src/mapgen';
const m = generate('かしたれ');
console.log(JSON.stringify({ springs: m.springs, sinks: m.sinks, lava: (()=>{ for (let k=0;k<m.lava.length;k++) if (m.lava[k]) return {x:k%m.w,y:(k/m.w)|0}; })() }));
