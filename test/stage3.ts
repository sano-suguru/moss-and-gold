import { World, DAY_TICKS } from '../src/world';
const seed = process.argv[2] || 'かしたれ';
const w = new World(seed);
const total0 = w.totalNutrients();
const t0 = Date.now();
const names = ['ウィスプ', 'コウモリ', 'ネズミ', 'トカゲ', 'クモ', 'スライム', 'ゾンビ', 'ゴースト', 'マイコニド', 'アリ', 'コボルト', 'サラマンダー', 'ゴブ', 'オーク', 'リザ', 'ミノ', 'トロ', 'バジ', 'ガー', 'ヴァ', 'ミミ', 'ゴレ', 'ワム', 'ワイ', 'ドラ', '冒険', '骨', 'リッチ'];
for (let day = 0; day < (+process.argv[3] || 6); day++) {
  for (let q = 0; q < 4; q++) {
    for (let i = 0; i < DAY_TICKS / 4; i++) w.step();
    const e = w.eco;
    const c = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]; let corpses = 0, bones = 0, away = 0, glowing = 0;
    for (const x of e.list) { if (x.dead === 1) { corpses++; if (x.k !== 0 && x.k !== 5 && e.corpseStage(x) === 2) bones++; } else if (!x.dead) { c[x.k]++; if (x.away) away++; if (x.glow > 30) glowing++; } }
    const bal = w.totalNutrients() - e.imported + e.exported;
    console.log(`d${day + 1}.${q} ${names.map((n, i) => n + c[i]).join(' ')} 死骸${corpses}(骨${bones}) 外${away} 光${glowing} 巣${e.webs.length} 巣穴${e.burrows.length} 苔${w.totalMoss} キノコ${w.totalFungus} 蟻塚${e.colonies.length}(蓄${e.colonies.map((o) => o.store).join(',')}) 掘計${w.digs.length} 金${e.totalGold()}山${e.piles.length}(入${e.goldIn}出${e.goldOut}) 行${e.parties.length} 帰${e.returned} 倒${e.fallen} 道具${e.gear.length} 噂${e.reputation().toFixed(1)} 武装${e.list.filter((x) => (x.k === 12 || x.k === 13) && !x.dead && x.party).length} 松明ゴ${e.list.filter((x) => x.k === 12 && !x.dead && x.torch > 0).length} 職${e.list.filter((x) => x.k === 25 && !x.dead).map((x) => x.sp).join('')} 燃${e.burning.length} 灰${w.ash.reduce((a, v) => a + (v > 0 ? 1 : 0), 0)} 竜${e.list.filter((x) => x.k === 24 && !x.dead).map((x) => x.st + ':' + x.food).join('')} ワーム${e.list.filter((x) => x.k === 22 && !x.dead).map((x) => x.st).join('')} 石像${e.statues.length}(${e.statues.map((o) => o.k).join(',')}) 住処${e.warrens.length} 集落${e.camps.map((o) => o.kind).join('')} 出${e.exported}(掘${e.warrens.map((o) => o.len).join(',')}) ${bal === total0 ? 'OK' : 'NG ' + (bal - total0)}`);
  }
}
console.log('ms', Date.now() - t0);
