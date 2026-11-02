import { buildAtlas } from '../src/atlas';
const a = buildAtlas() as any; console.log(a.width, a.height, a.frames.length);
