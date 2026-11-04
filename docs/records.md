# 実行ログの形式（runs/<名前>/）

`npm run sim` / `batch` / `ab` が書き出すファイル。どのファイルも、`t` は tick、`k` は種の番号（`src/names.ts`）、`x, y` は px 単位の位置。出力の内容を変えたら、このページと tools/analysis/sim.ts をあわせて直す。

| ファイル | 中身 |
|---|---|
| settle.jsonl | `{t, k, id, ev, how, reason, to, n, x, y}`。定住する群れの出来事（k 10 コボルトの住処、k 12 ゴブリンの集落）。ev は found（住みついた。how：arrive 外から来た / move 引っ越した / split 分かれた。poor が 1 なら、食べ物の足りる場所が無く、貧しい場所に少ない群れで住みついた）、abandon（捨てた。reason：food 食べ物が尽きた / raids 襲われすぎた / alone 1匹になった / dragon 竜が近くに来た。to：leave 外へ去った / move 中で移った）、empty（誰もいなくなった）。ほかに、ev が unbury の行は、壁や瓦礫のマスの中に埋まっていた生き物（k は種、id は個体）が、安全策でいちばん近い床へ出た記録（x, y は出た先）。k 25（冒険者の一行。id は一行）の ev が wake の行は、焚き火で眠る一行が起こされた記録（how：watch 見張りが気づいた / thief 眠りの浅い盗賊が気づいた / hit 寝ている者が打たれた / noise 物音。n は気づいた相手の種、doze は見張りがうとうとしていたか、night は夜か）、nightHit は眠っている者への寝込みの一打ち（n は打った種）、campBreak は夜襲の被害（how：lost 倒れた者が出た / hurt 深手）で焚き火を消して発った記録（src/eco/night.ts）。k 4（クモ。id は巣）の ev が web の行は、クモの巣の出来事（how：catch 大ネズミかアリが捕まった / tear 大きな者が引き裂いた / cut 冒険者が切り払った。by は捕まった・裂いた者の種。src/eco/spider.ts） |
| samples.jsonl | ゲーム内の1/4日ごとのサンプル。シードの豊かさ（rich：開いた地表の横穴から歩いて100タイル以内の床1タイルあたりの、食べられる苔とキノコの量）、種ごとの数（`counts`、キーは種の番号）、死骸、開いた床、瓦礫、使える養分とその総量、保存則のずれ（nutrientDrift / goldDrift / rockDrift）、噂、冒険者パーティの数、外の世界の地図の区画数、ドワーフの拠点の発展段階 |
| deaths.jsonl | `{t, k, cause, by, x, y, slain?, near?, camp?}`。camp は、焚き火で休む一行の冒険者だった（1）。slain は、cause が eaten のとき、打ち合いで仕留めてから食べた（1）。無ければ一口で食べた（クモの巣・ワーム・空中でさらう・ミミック・死骸）。cause は死因：eaten 食べられた / fight 戦って倒れた / starve 飢え / burned 焼死 / crushed 崩落 / petrified 石化 / killed 襲われた（ゾンビなど）/ dried 干からびた（スライム）/ faded ゴーストが消えた / planted マイコニドがキノコになった / crumbled スケルトンが崩れた / other。by は手を下した種（なければ −1）。near は飢え死にした大ネズミについてだけ、食べられる苔・キノコまでの歩いての距離（60タイルまで、なければ −1） |
| births.jsonl | `{t, k, origin, x, y}`。origin は出現の経路：entrance 正面の入口 / mouth 地表の横穴 / fissure 地底の裂け目 / river 川の出口 / shaft 天井の裂け目 / mana マナから生まれた / born ダンジョンの中で生まれた |
| moves.jsonl | `{t, k, n, x, y, tx, ty}`。大ネズミの巣穴の引っ越し：n 匹が、元の場所（x, y）から移った先（tx, ty）へ |
| exits.jsonl | `{t, k, reason}`。ダンジョンから外へ出ていった理由：starving 飢えて去った（住処のないコボルト、大型の獣など） / returned 冒険者の生還 / home 満腹になって巣へ帰った（ワイバーン） / abandoned 住処を捨てて群れで去った（コボルト） / dispersed 空腹で群れごと出ていった（大ネズミ） |
| events.jsonl | ゲーム内ログに表示される出来事（`{k:番号}` の所に種の名前が入る） |
| stuck.jsonl | `{t, k, id, st, x, y, nopath, web?}`。足踏み：起きて歩く姿（act 1）のまま、ゲーム内の2分（1200 tick）以上ほぼ同じ場所（12px 以内）にいた生き物を、そうなった時点で1回記録する（眠りが半分以上なら数えない）。nopath は、その間に道が見つからないまま歩いていた割合（0.5 以上なら、壁に押しつけて足踏みしていた）。記録はセーブしないので、再開した直後の1200 tick は数え始めからやり直す。web は、その間にクモの巣に捕まっていた割合（0 なら書かない）。分析ツールは、漂う種（ウィスプ、ゴースト）と web が 0.5 以上のものを足踏みとして数えない（tools/analysis/common.ts の countsAsStuck） |
| checkpoint.json | ゲームのセーブデータと同じ形式。ブラウザの localStorage（キーは src/save.ts の `KEY`）に入れると、その場面をゲームで開ける |
| snap/dNNN.json.gz | ゲーム内の1日ごとのスナップショット（checkpoint.json と同じ形式を gzip で圧縮）。batch や ab の出力では、meta.json の `snaps` がキャッシュ内の場所を指す |
| meta.json | シード、日数、tick 数、冒険者パーティの上限、実行の来歴 `lineage`（どのバージョンのソースが、どの tick から実行したか）、実行にかかった秒数 |

samples.jsonl は tick が `DAY_TICKS/4` の倍数のときに書く（中断・再開しても同じ tick で書かれる）。
