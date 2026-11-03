# 回した結果の記録の中身（runs/<名前>/）

`npm run sim` / `batch` / `ab` が書き出すファイル。数え方を変えたら、ここと sim.ts を合わせる。


| ファイル | 中身 |
|---|---|
| settle.jsonl | `{t, k, id, ev, how, reason, to, n, x, y}`。住みつく群れの出来事（k 10 コボルトの住処、k 12 ゴブリンの集落）：ev は found（how：arrive / move / split）、abandon（reason：food / raids / alone / dragon、to：leave / move）、empty |
| samples.jsonl | 地上の1/4日ごと：シードの豊かさ（rich：開いた地表の横穴から道のり100マスで行ける床1マスあたりの、食べられる苔とキノコ）、種ごとの数（`counts` のキーは種の番号）、死骸、開いた床、瓦礫、使える養分、総量、帳簿のずれ（nutrientDrift / goldDrift / rockDrift）、噂、一行の数、外の世界の地図の区画数、ドワーフの住みかの段階 |
| deaths.jsonl | `{t, k, cause, by, x, y, near?}`（near：飢え死にした大ネズミの、食べられる苔・キノコまでの歩いた道のり。60マスまで、なければ -1）。cause：eaten 食べられた / fight 打ち合い / starve 飢え / burned 焼けた / crushed 崩落 / petrified 石化 / killed 襲われた（ゾンビなど）/ dried 干からびた（スライム）/ faded ゴーストが消えた / planted マイコニドがキノコになった / crumbled スケルトンが崩れて消えた / other。by は手を下した種（なければ −1） |
| births.jsonl | `{t, k, origin, x, y}`。origin：entrance 正面の入口 / mouth 地表の横穴 / fissure 地底の裂け目 / river 川の口 / shaft 天井の裂け目 / mana マナから / born 中で生まれた |
| moves.jsonl | `{t, k, n, x, y, tx, ty}`。群れの引っ越し（大ネズミの巣穴）：何匹が、元の場所（x, y）から移った先（tx, ty）へ（画素） |
| exits.jsonl | `{t, k, reason}`。starving 飢えて去った（住処のないコボルト、大物など） / returned 生還した冒険者 / home 満ちて巣へ帰った（ワイバーン） / abandoned 住処を捨てて群れで去った（コボルト） / dispersed 腹を空かせて群れで出ていった（大ネズミ） |
| events.jsonl | ゲームの「記録」に出る出来事（`{k:番号}` は種の名前） |
| checkpoint.json | ゲームの保存と同じ形。ブラウザの localStorage（キーは save.ts の KEY）に入れれば、その場面をゲームで開ける |
| snap/dNNN.json.gz | 地上の1日ごとの状態（checkpoint と同じ形を gzip）。batch や ab の出力では meta.json の `snaps` が保存庫の場所を指す |
| meta.json | シード、日数、刻み、冒険者の上限、版の系譜 `lineage`（どの版がどの刻みから回したか）、かかった秒数 |

samples.jsonl は、刻みが `DAY_TICKS/4` の倍数のときに記録する（続きから回しても同じ刻み）。

種の番号と名前は `src/names.ts`、賢さの段階は `TIER`、強さは `STR`（ecology.ts）。
