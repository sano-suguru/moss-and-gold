# Moss & Gold（苔と金貨）：開発と分析の手引き（Claude Code 向け）

作品名は「Moss & Gold — A Living Dungeon Sim」（中国語：苔与金：活体地下城、日本語：苔と金貨）。旧称は「ダンジョン・アクアリウム」で、保存のキー（save.ts の KEY）などには旧称が残っているが、保存データの互換のため変えない。

見下ろし2Dのダンジョン生態系アクアリウム。WebGL2 で描き、シミュレーションは CPU 上で決定的に動く。
プレイヤーは眺めるだけ（介入なし）。設計の原則は「いくつもの遊びが互いに意味を与え合う構造」。

## 最初に知っておくこと

- **決定的**：同じシードからは、何度回しても同じ展開になる。乱数は `ih(a, b, salt)` などのハッシュで、`Math.random` は使わない（描画用を除く）。
- **保存からの再現**：保存して読み込み直しても、続きの展開が一致しなければならない。新しい状態を足したら、必ず `Ecology.serialize/restore`（または `WorldState`）に入れる。保存しない状態（描画だけのもの）は、シミュレーションの判断に使ってはいけない。
- **帳簿（保存則）**：次の四つは常に成り立つ。崩れたら不具合。
  - 養分：`totalNutrients() − はじめ − imported + exported − born + washed = 0`
  - 金貨：`totalGold() − はじめ − goldIn + goldOut = 0`
  - 岩：`rockLedger() === initialRock`
  - マナ：`totalMana() − manaBorn + manaLeaked + manaFaded = 0`（土の `world.mana` と、生き物の `Cr.mana`）
- **キャッシュの作り直しの時機**：保存しない控え（明るさの地図 `litMap`、洞窟のまとまり `regionMap`、夜露の地図 `dewMap`、群れの身元 `gkCache` など）は、刻みの番号や地形の変化の記録（`digs.length`）だけで作り直す時機が決まるようにする。「最後に作った刻みからの経過」で作り直すと、読み込み直したときにずれる（実際に何度も起きた）。
- 時間：`TICKS_PER_SEC = 10`、地上の1日 `DAY_TICKS = 14400` 刻み（通常速度で24分）。生き物は `CR_EVERY = 2` 刻みごとに動く。
- 地図：192×144 マス、1マス16画素。`MapData`（mapgen.ts）の `solid / sealed / rubble / lava / paved / dug` など。

## よく使うコマンド

```bash
npm install                       # 初回
npm test                          # 決定性・帳簿・保存からの再現など（約1分）
npm run build                     # dist/index.html（外部依存なしの1ファイル）
npm run sim -- --seed かしたれ --days 30 --out runs/kashitare     # 画面なしで全速（地上1日あたり約2.5秒）
npm run sim -- --resume runs/kashitare                              # 時間切れで止まった所から続ける
npm run sim -- --seed abc --days 5 --out runs/t --trace 1234        # 生き物1234の一生を毎刻み記録
npm run report -- --run runs/kashitare                              # report.md と deaths.png / births.png
```

`sim` は `--budget 秒`（既定270）を超えそうになると途中の状態（checkpoint.json）を書き出して止まる。
Claude Code の実行時間に制限がある環境では、`--resume` で何回かに分けて回す。分けても結果は同じ。

## 見た目の確認（スクショの一覧）

```bash
npm run gallery                      # 決まった場面を作って撮り、build/gallery/sheet.png（一覧）を作る
npm run gallery -- --label before    # 撮った画像を build/gallery/before/ に残す（直す前に）
npm run gallery -- --compare before  # いまの画像と before を左右に並べた build/gallery/compare-before.png
python3 tools/gallery/shoot.py --only dragon,camp   # 場面を選んで撮り直す（場面の保存はそのまま）
```

場面は `tools/gallery/scenes.ts` の `SCENES`（シード、時刻、見たい場所を探す関数、拡大率、スマホかどうか）。見た目を変えたら、直す前に `--label` で残し、直したあと `--compare` で並べて確かめる。数値では測れないので、必ず画像を見て判断する（一箇所を直すと別の場面が崩れることがある）。

## 分析の流れ（推奨）

1. 複数のシードで、少なくとも20〜30日回す（`かしたれ`、`abc`、`はじまりの洞窟` など）。
2. `report.md` の「おかしな兆候」を見る（種の絶滅、一時的な増えすぎ、帳簿のずれ、死の一区画への集中）。
3. 死因と「誰が誰を」で、食物連鎖が意図どおりか確かめる。生き物の由来で、外からの来訪に頼りすぎていないか見る。
4. `deaths.png` / `births.png` で場所の偏りを見る。
5. 気になる個体は `--trace` で一生を追う。帳簿のずれは `tools/analysis/drift.ts`（`--from 日 --to 日`）で、ずれた刻みと、その刻みに変わった生き物を突き止める。
6. 直したら `npm test`、もう一度 `sim` と `report` で比べる。

### 記録の中身（runs/<名前>/）

| ファイル | 中身 |
|---|---|
| samples.jsonl | 地上の1/4日ごと：種ごとの数（`counts` のキーは種の番号）、死骸、開いた床、瓦礫、使える養分、総量、帳簿のずれ（nutrientDrift / goldDrift / rockDrift）、噂、一行の数、外の世界の地図の区画数、ドワーフの住みかの段階 |
| deaths.jsonl | `{t, k, cause, by, x, y}`。cause：eaten 食べられた / fight 打ち合い / starve 飢え / burned 焼けた / crushed 崩落 / petrified 石化 / killed 襲われた（ゾンビなど）/ dried 干からびた（スライム）/ faded ゴーストが消えた / planted マイコニドがキノコになった / other。by は手を下した種（なければ −1） |
| births.jsonl | `{t, k, origin, x, y}`。origin：entrance 正面の入口 / mouth 地表の横穴 / fissure 地底の裂け目 / river 川の口 / shaft 天井の裂け目 / mana マナから / born 中で生まれた |
| exits.jsonl | `{t, k, reason}`。starving 飢えて去った / returned 生還した冒険者 |
| events.jsonl | ゲームの「記録」に出る出来事（`{k:番号}` は種の名前） |
| checkpoint.json | ゲームの保存と同じ形。ブラウザの localStorage（キーは save.ts の KEY）に入れれば、その場面をゲームで開ける |

種の番号と名前は `src/names.ts`、賢さの段階は `TIER`、強さは `STR`（ecology.ts）。

## ソースの地図

| ファイル | 中身 |
|---|---|
| src/mapgen.ts | 地形の生成（洞窟、迷路、水路、溶岩、苔、養分、宝物庫、深部、閉じた空洞） |
| src/world.ts | 世界の1刻み（水、養分、熱、苔、キノコ、光る苔の光、掘削、瓦礫、崩落、養分の生まれる元と流れ出る先）、地形の変化の記録（`digs`：`k*8+種類`、0 掘る / 1 瓦礫 / 2 崩落 / 3 風化 / 4 石畳） |
| src/ecology.ts | 生き物すべて（行動、戦い、傷、逃げる、物音、冒険者の一行と噂と外の世界の地図、ドワーフ、集落、宝、記録、分析用の記録 `stats`） |
| src/sprites.ts, atlas.ts | ドット絵の部品と、それを詰めた画像 |
| src/creatureView.ts, renderer.ts, shaders.ts | 描画 |
| src/main.ts | ループ、画面の部品（ミニマップ、記録、養分の表示）、保存 |
| test/*.ts | テスト |
| tools/analysis/ | 分析の道具（sim, report, drift, ratdiag：飢え死にの調査, stuck：動かない個体, digmap：掘られたマスと岩の硬さの地図, planview：ドワーフの坑道の計画を文字で描く） |
| README.md | 段階ごとの仕組みの詳しい説明（仕様書として読める） |

## いまの仕組みの要点（段階13まで）

- 来し方は三つ：正面の入口は人の道（冒険者とドワーフだけ）。自然の口（地表の横穴、地底の裂け目、川の口。序盤は天井の割れ目から小さな獣）から獣や種族。マナから魔物（トロール、ミノタウロス、バジリスク、ドラゴンの幼子は `manaBirths`。ウィスプ、ゴースト、ミミック、ガーゴイル、サラマンダー、ゾンビ、スケルトン、リッチはもとの生まれ方にマナの条件）。
- マナ（world.ts の `manaStep`、地上の5秒ごと）：深部、地底の裂け目、宝物庫、溶岩、岩盤から湧き、岩にも染みとおって広がり、入口と横穴から逃げ、少しずつ薄れる。生き物は食べるとマナを受け取り、死ぬと土に還す。
- ドラゴンは `c.sp` が育ち具合（0 幼竜、1 若い竜、2 成竜）。`c.elite` は特別な個体（1 火の精、2 亡霊の騎士、4 大ネズミの王、5 ゴブリンの頭、6 水の精、7 光の精、8 骨の竜、9 キノコの主）。名前は `names`。
- 気づき方（`canSense`：目、夜目、匂い、振動、反響、魔法）、火を怖がる獣（`fearFire`）、光に寄る狡猾な種（`lurk`）、人の気配（`presenceAt`、強い魔物ほど避ける）、やわらかい間合い（`personalSpace`）、食べる時間（`feeding`）、弱い生き物の害（`pester`）、冒険者の三段階の戦い。
- 描画だけ：攻撃の技の演出（`fxAttacks`、`creatureView.drawAttacks`）、気づいた印、のけぞり、飛び散る粒。見本は `dist/index.html#fxdemo`。画面の部品を隠すのは `#clean`。

## 変更するときの注意

- 生き物の行動を変えたら、`npm test` に加えて、少なくとも1シードを20日回して `report.md` の兆候と帳簿を確かめる。テストは1日半しか回さないので、長く回して初めて出る不具合がある（例：ドワーフがあきらめて去るとき食料が帳簿から消えていた）。
- 新しい「消える」「現れる」経路を足したら、帳簿（imported / exported / born / washed / goldIn / goldOut / 岩）と、`stats`（deaths / births / exits）の両方に記録する。
- 描画だけの状態（血の跡、土ぼこりなど）は保存しない。シミュレーションの判断に使わないこと。
- 帳簿のずれは、`tools/analysis/manacheck.ts` と `goldcheck.ts`（ずれた刻みと、その刻みに変わった生き物・宝の山を表示する）で突き止めるのが早い。
- `false &&` で古い処理を止めると、TypeScript の型の絞り込みで別の所が型エラーになることがある。止めるなら処理ごと消す。
- 見た目の確認は、`node build.mjs` のし忘れに注意（古い dist で撮ってしまう）。
