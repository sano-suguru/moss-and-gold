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
npm test                          # 決定性・帳簿・保存からの再現など（四つの部分を別のプロセスで同時に回す。約26秒）
npm run build                     # dist/index.html（外部依存なしの1ファイル）
npm run sim -- --seed かしたれ --days 30 --out runs/kashitare     # 画面なしで全速（地上1日あたり約2.5〜3秒。生き物が増える終盤ほど遅い）
npm run sim -- --resume runs/kashitare                              # 時間切れで止まった所から続ける
npm run sim -- --seed abc --days 5 --out runs/t --trace 1234        # 生き物1234の一生を毎刻み記録
npm run report -- --run runs/kashitare                              # report.md と deaths.png / births.png
npm run batch -- --seeds "abc,かしたれ,seed4" --days 25 --out runs/batch-x  # CPU の数だけ sim を並べて回し、report と比較の表 summary.md を作る
npm run batch -- --out runs/batch-x                                 # 途中で止まった batch を続ける（--summary で表だけ作り直す）
npm run batch -- --seeds ... --days 25 --adv-max 2 --out runs/b-adv2 # 冒険者の一行の上限を切り替えて回す（既定 1。段階13までは 2）
npm run compare -- --runs runs/b1,runs/b2 --names "前,後" --out docs/x.md  # batch どうしをコボルトと大ネズミの目安で並べる
npm run compare -- --runs ... --goals tools/analysis/goals-settling.json   # 目安に届いたか（✅/❌）の表をつける
npm run compare -- --runs ... --seeds "abc,かしたれ"   # 一部のシードだけ比べる（ゴブリンの集落、冒険者やコボルトとの殺し合いの表もある。目安は goals-round4.json）
npm run autopsy -- --seed seed7 --days 25 --kind 2 --cause starve   # 死んだときの様子の内訳と、死ぬ直前の様子の例（runs/autopsy-*.md）
npm run stuckmap -- --seed seed7 --days 12 --kind 2                 # 動こうとして進めない場所の地図（stuck.png）と上位のマス
npm run ab -- --base HEAD~1 --seeds abc,seed5 --days 10             # 前の版といまの版の出力が1バイトも違わないか（整理・高速化の確かめ）
npm run ab -- --resume-check 7 --seeds かしたれ --days 10            # 7日目で分けて回しても通しと一致するか
npm run ab -- --base HEAD~1 --fork 5 --days 15 --seeds ... --out runs/ab-x  # 同じ5日目の状態から前の版といまの版を続けて compare
```

手直しの効き目は、1シードでは分からない（展開が少しの違いで大きく分かれる）。8シードの batch か、`ab --fork` で同じ途中の状態から比べる。

`sim` は `--budget 秒`（既定270）を超えそうになると途中の状態（checkpoint.json）を書き出して止まる。
Claude Code の実行時間に制限がある環境では、`--resume` で何回かに分けて回す。分けても結果は同じ。

## 見た目の確認（スクショの一覧）

```bash
npm run gallery                      # 決まった場面を作って撮り、build/gallery/sheet.png（一覧）を作る
npm run gallery -- --label before    # 撮った画像を build/gallery/before/ に残す（直す前に）
npm run gallery -- --compare before  # いまの画像と before を左右に並べた build/gallery/compare-before.png
node tools/gallery/shoot.mjs --only dragon,camp     # 場面を選んで撮り直す（場面の保存はそのまま。node build.mjs を先に）
npm run gallery -- --fresh           # 場面をかならず作り直す（ふだんは、シミュレーションのコードと場面の定義が前回と同じなら作り直さない）
node tools/gallery/shoot.mjs --light                # 確認用の明かり（#lit）をつけて撮る（暗さと絵の出来を分けて見る）
npm run shot -- --seed かしたれ --find warren         # 見たいもの（warren / hide / camp / gobhide / kind:番号 / xy:x,y）が出るまで進めて撮る。
                                                    # build/shots/ に、そのまま・印つき（-marked）・真ん中を3倍に切り出し（-crop）
```

撮るのは Node の Playwright（Python は要らない）。速さの目安：gallery は描画だけ直したとき約30秒（場面を作り直すと約1分）。場面はシードごとに別のプロセスで同時に作り、撮るのはページを読み込み直さずに `window.__openScene(保存のJSON)` で場面を入れ替え、20回描き終わったら `window.__hold` で描くのを止めて撮る。ゲームの URL の末尾に `#lit`（全体を明るく照らす）、`#albedo`（地形の色だけ）、`#clean`（画面の部品を隠す）を付けられ、`#clean,lit` のように並べてもよい。

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
| settle.jsonl | `{t, k, id, ev, how, reason, to, n, x, y}`。住みつく群れの出来事（k 10 コボルトの住処、k 12 ゴブリンの集落）：ev は found（how：arrive / move / split）、abandon（reason：food / raids / alone / dragon、to：leave / move）、empty |
| samples.jsonl | 地上の1/4日ごと：シードの豊かさ（rich：開いた地表の横穴から道のり100マスで行ける床1マスあたりの、食べられる苔とキノコ）、種ごとの数（`counts` のキーは種の番号）、死骸、開いた床、瓦礫、使える養分、総量、帳簿のずれ（nutrientDrift / goldDrift / rockDrift）、噂、一行の数、外の世界の地図の区画数、ドワーフの住みかの段階 |
| deaths.jsonl | `{t, k, cause, by, x, y, near?}`（near：飢え死にした大ネズミの、食べられる苔・キノコまでの歩いた道のり。60マスまで、なければ -1）。cause：eaten 食べられた / fight 打ち合い / starve 飢え / burned 焼けた / crushed 崩落 / petrified 石化 / killed 襲われた（ゾンビなど）/ dried 干からびた（スライム）/ faded ゴーストが消えた / planted マイコニドがキノコになった / crumbled スケルトンが崩れて消えた / other。by は手を下した種（なければ −1） |
| births.jsonl | `{t, k, origin, x, y}`。origin：entrance 正面の入口 / mouth 地表の横穴 / fissure 地底の裂け目 / river 川の口 / shaft 天井の裂け目 / mana マナから / born 中で生まれた |
| moves.jsonl | `{t, k, n, x, y, tx, ty}`。群れの引っ越し（大ネズミの巣穴）：何匹が、元の場所（x, y）から移った先（tx, ty）へ（画素） |
| exits.jsonl | `{t, k, reason}`。starving 飢えて去った（住処のないコボルト、大物など） / returned 生還した冒険者 / home 満ちて巣へ帰った（ワイバーン） / abandoned 住処を捨てて群れで去った（コボルト） / dispersed 腹を空かせて群れで出ていった（大ネズミ） |
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
| tools/gallery/ | 見た目の確認（scenes.ts と shoot.mjs：決まった場面の一覧、shot.ts と shot.mjs：見たいものを探して撮る） |
| tools/analysis/ | 分析の道具（sim, report, batch：多くのシードを並べて回して比較の表, compare：batch どうしの目安の比較, autopsy：死んだときの様子, stuckmap：足止めの地図, ab：前の版との比較, drift, ratdiag：飢え死にの調査, stuck：動かない個体, digmap：掘られたマスと岩の硬さの地図, planview：ドワーフの坑道の計画を文字で描く） |
| README.md | 段階ごとの仕組みの詳しい説明（仕様書として読める） |

## いまの仕組みの要点（段階13まで）

- 来し方は三つ：正面の入口は人の道（冒険者とドワーフだけ）。自然の口（地表の横穴、地底の裂け目、川の口。序盤は天井の割れ目から小さな獣）から獣や種族。マナから魔物（トロール、ミノタウロス、バジリスク、ドラゴンの幼子は `manaBirths`。ウィスプ、ゴースト、ミミック、ガーゴイル、サラマンダー、ゾンビ、スケルトン、リッチはもとの生まれ方にマナの条件）。
- マナ（world.ts の `manaStep`、地上の5秒ごと）：深部、地底の裂け目、宝物庫、溶岩、岩盤から湧き、岩にも染みとおって広がり、入口と横穴から逃げ、少しずつ薄れる。生き物は食べるとマナを受け取り、死ぬと土に還す。
- ドラゴンは `c.sp` が育ち具合（0 幼竜、1 若い竜、2 成竜）。`c.elite` は特別な個体（1 火の精、2 亡霊の騎士、4 大ネズミの王、5 ゴブリンの頭、6 水の精、7 光の精、8 骨の竜、9 キノコの主）。名前は `names`。
- 気づき方（`canSense`：目、夜目、匂い、振動、反響、魔法）、火を怖がる獣（`fearFire`）、光に寄る狡猾な種（`lurk`）、人の気配（`presenceAt`、強い魔物ほど避ける）、やわらかい間合い（`personalSpace`）、食べる時間（`feeding`）、弱い生き物の害（`pester`）、冒険者の三段階の戦い。
- コボルトの住処（四段目の前半）：人の気配が薄く、竜（30マス）・トロールとバジリスク（15マス）から離れ、食べ物の近い、歩いて行ける所を選び、岩壁に4マスの横穴を掘ってその奥（`Warren.x, y`）を住処にする（入口は `door`）。蓄え `store`（養分の帳簿に入る）、キノコの畑（土の養分をキノコへ移す）、入口のまわりの罠 `traps`。強い相手（冒険者の一行、若い竜、トロール、ミノタウロス）が近づくと奥に隠れる（`hide`。隠れている者は入口に踏み込まれない限り誰にも気づかれず、暗く沈んだ影の姿に光る目を重ねて描く。ほかの生き物から見えないだけで、眺める人には見せる）。描画：罠（歯の並ぶ鉄の板）、入口の飾り柱、奥の寝床、畑の畝とキノコ（`farmTiles`）。4〜6匹の群れで来て、住処へ向かう道中（`st 11`）は冒険者が8マス以内にいる間その場で身をひそめて待つ（`st 12`）。掘った横穴の中と入口のまわりは畑の判定で湿った扱い。一匹ずつは去らず、蓄えが尽きて1日、襲われた回数 `raids` が4、1匹になって1日（`alone`）、竜が近くに住みつく、のどれかで群れごと住処を捨てる（開いた横穴があれば去り、なければ中の別の場所へ移る）。襲われて捨てた直後は2日来ない（`koboldShun`）。竜の寝床のそばの口からは入ってこない。冒険者は逃げていく弱い者を追わない
- 大ネズミ：食べられる苔（`edibleMoss`、`updateForage` で数えて保存）に合わせて来る数と殖える数を抑える。巣穴のまわりの苔が尽きてきたら、苔の豊かな所へ巣穴を移す（`relocateBurrow`、`Burrow.moved`、stats.moves）。移れず、腹を空かせて近くに苔がなく、飢える前に歩いて着ける開いた横穴があれば、巣穴の仲間と群れで出ていく（`st 8`）。深い水に取り残されたら泳いで抜け出せる
- 冒険者の一行の上限 `Ecology.ADV_MAX_PARTIES` は既定1（段階13までは2）
- 三巡目：大ネズミの殖える数は巣穴のまわりで決める（`Burrow.cap`、土地勘と同じ時機に数え直して保存）。巣穴は火のそばに作らない。届かない巣穴へは帰らず、はぐれ者になる。
  列の間合いは、前の仲間が動いているときだけ（止まっている仲間は脇へよけて追い越す）。
  コボルトは、口から歩いて行ける範囲に住めて食べ物の足りる場所（`warrenFood` が `KOBOLD_MIN_FOOD` 以上）がある口からだけ来る（`kobMouthOk`、600刻みごと、保存）。
- 四巡目：大ネズミは、口か天井の裂け目のまわり（道のり40マス）の食べられる苔で養える数に余裕があるときだけ、そこから来る（`ratMouthOk` / `ratShaftOk`、600刻みごと、保存）。来た群れは入ってきた所のそばの巣穴に入る（`pickBurrowNear`）。
  ゴブリンの集落（`Camp` の kind 0）もコボルトと同じ枠組み：場所は `pickGoblinCamp`（暗い、人の気配が薄い、冒険者の通り道（`routeDist`）から15マス以上、竜30・トロールとバジリスク15・コボルトの住処15マス離れ、まわり14マスの食べ物 `campFood` が `GOBLIN_MIN_FOOD` 以上）、口ごとの来訪 `gobMouthOk`、
  蓄え `store`（養分の帳簿に入る。狩り・死骸・盗みの余りを持ち帰る `st 4`）、蓄えからの出産、`watchCamps`（一行が明らかに強ければ `hide 1`：集落のまわりの暗がりに散って隠れる＝`st 7`、影の姿と光る目で描く。弱ければ `hide 2`：暗がりで待ち伏せ。見つかる・劣勢なら逃げ散って `raids` に数える）、
  `abandonCamp`（蓄えが尽きて1/3日たち皆が飢えかけ、`raids` 4、1匹で1日、竜。開いた横穴があれば `st 10` で群れごと去る＝exits `abandoned`、なければ移る）、`goblinShun`。ゴブリンの頭（elite 5）のいる集落は盗みと待ち伏せに大胆。settle.jsonl に k 12 の出来事も残る
- 五巡目：大ネズミの判定と巣穴の範囲は道のり `RAT_DOOR_REACH`（18マス）。オークはゴブリンを獲物にも敵にもせず（`HUNT_ORC`）、縄張りから20マス以内の集落を従える（`Camp.lx/ly`、`updateVassals`）。地上の約1日ごとに一匹が蓄えの3割を取り立て（`sendCollectors`、オークの `st 5` 行く / `st 6` 袋＝`units` を担いで帰る、settle.jsonl の `{k:13, ev:'tribute'}`）、従う集落のそばのコボルトを追い払う（`guardVassals`）。
  ゴブリンはコボルトの住処から12マス（`inKoboldLand`）の中の苔・獲物・死骸を目当てにせず、道筋もできるだけ避ける（`findPath` が先に避けて探す）。コボルトも住処をゴブリンの集落から15マス離す。ゴブリンは狩りと死骸あさり（`goblinCarrion`）が主で、苔とキノコは腹の4割までの足し、狩りの食べ残しを蓄えに。meta は 57
- 描画だけ：攻撃の技の演出（`fxAttacks`、`creatureView.drawAttacks`）、気づいた印、のけぞり、飛び散る粒。見本は `dist/index.html#fxdemo`。画面の部品を隠すのは `#clean`。

## 変更するときの注意

- 生き物の行動を変えたら、`npm test` に加えて、少なくとも1シードを20日回して `report.md` の兆候と帳簿を確かめる。テストは1日半しか回さないので、長く回して初めて出る不具合がある（例：ドワーフがあきらめて去るとき食料が帳簿から消えていた）。
- 新しい「消える」「現れる」経路を足したら、帳簿（imported / exported / born / washed / goldIn / goldOut / 岩）と、`stats`（deaths / births / exits）の両方に記録する。
- 描画だけの状態（血の跡、土ぼこりなど）は保存しない。シミュレーションの判断に使わないこと。
- 帳簿のずれは、`tools/analysis/manacheck.ts` と `goldcheck.ts`（ずれた刻みと、その刻みに変わった生き物・宝の山を表示する）で突き止めるのが早い。
- `false &&` で古い処理を止めると、TypeScript の型の絞り込みで別の所が型エラーになることがある。止めるなら処理ごと消す。
- 見た目の確認は、`node build.mjs` のし忘れに注意（古い dist で撮ってしまう）。
