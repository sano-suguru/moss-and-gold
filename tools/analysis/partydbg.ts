/** 一行の様子を tick ごとに表示する（三歩目の調査）。node tools/analysis/launch.mjs partydbg --run <実行結果のフォルダ> --seed s --at 日 --ticks n */
import { DAY_TICKS, tick } from './lib/engine';
import { openAt } from './lib/open';
const argv = process.argv.slice(2);
const opt = (k: string, d = '') => (argv.includes('--' + k) ? argv[argv.indexOf('--' + k) + 1] : d);
(async () => {
  const { w } = await openAt(opt('seed'), Math.round(+opt('at') * DAY_TICKS), opt('run') ? { run: opt('run') } : {});
  const e = w.eco as any;
  for (let i = 0; i < +opt('ticks', '200'); i++) {
    tick(w);
    if (i % +opt('every', '10')) continue;
    for (const p of e.parties) {
      const ms = p.members.map((id: number) => e.byId.get(id)).filter((c: any) => c && !c.dead);
      console.log(w.tick, `p${p.id} aim${p.aim} goal${p.goal} known${p.aimKnown} camp${p.camp} lights${e.partyLights(p).length} food${ms.map((c: any) => c.food).join('/')} saw${p.saw} lead${ms[0] ? Math.round(ms[0].x) + ',' + Math.round(ms[0].y) : ''} t${Math.round(p.tx)},${Math.round(p.ty)}`);
    }
  }
})();
