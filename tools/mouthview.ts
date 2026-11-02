import { generate } from '../src/mapgen';
for (const sd of ['かしたれ', 'abc', 'はじまりの洞窟', 'seed3']) { const m = generate(sd); console.log(sd, JSON.stringify(m.mouths)); }
