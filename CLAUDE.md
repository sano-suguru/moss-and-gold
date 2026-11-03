# Moss & Gold（苔と金貨）：開発と分析の手引き（Claude Code 向け）

作品名は「Moss & Gold — A Living Dungeon Sim」（中国語：苔与金：活体地下城、日本語：苔と金貨）。旧称は「ダンジョン・アクアリウム」で、保存のキー（save.ts の KEY）などには旧称が残っているが、保存データの互換のため変えない。

見下ろし2Dのダンジョン生態系アクアリウム。WebGL2 で描き、シミュレーションは CPU 上で決定的に動く。
プレイヤーは眺めるだけ（介入なし）。設計の原則は「いくつもの遊びが互いに意味を与え合う構造」。

## 見える相互作用の決まり

このゲームは眺めるゲームなので、内部の仕組みは、画面の中で目に見える相互作用（生き物の動き、姿、場面の変化）として現れて初めて意味がある。記録の文章や生き物の札は補いで、主は画面の中の動きと姿。

- **見えることから決める**：新しい仕組みを作るときは、まず「画面で何が見えるか（どの生き物が、どう動き、どう見えるか）」を決め、それを起こすのに必要な分だけ内部を作る。
- **撮って添える**：作業の終わりには、その見える瞬間を Playwright でスクショ（動きなら数こまの連続。`npm run film`）に撮って docs/img/ に置き、報告に添える。撮れないときは、その理由を書く。
- **起きる回数を確かめる**：25日に一度も起きない場面は、眺める人にとって存在しないのと同じ。見せたい瞬間（通路での掠め取り、夜の盗み、聞き耳で止まる一行、戦利品の持ち帰り、ゴブリン退治の一行の到着、松明での探し出し、竜退治の寝床への到着、物資の置き場、マナからの出現、幼竜の孵化、引っ越しの列、群れで住みかを捨てる、オークの取り立てなど）が、シードごとに何回起きたかを、比べるときの標準の指標にする。compare.md と advreport の「見せたい瞬間の回数」の表（数え方は tools/analysis/lib/moments.ts）で、目安は「たいていのシード（16のうち12以上）で、25日に1回以上、できれば数回」（✅）。骨の竜のようなめったに起きない特別な出来事は対象外。新しい瞬間を作ったら、その数え方を moments.ts に足す。
- **見えない所を見つけたら**：作業の途中で、画面に見えない仕組み（数字や内部の状態としてしかなく、眺める人に伝わらないもの）を見つけたら、小さな手直しで見せられるものはその場で直し、大きなものは報告に「見えない所」として挙げる。これまでの仕組みの点検は docs/visibility-audit.md。
- 見た目だけの手直しは、シミュレーションに触れない（描画だけの状態は保存せず、判断に使わない）。

```bash
# 動きを数こまの連続に撮る（途中の状態の保存庫から始める。こまの下に日と先頭の札）→ docs/img/<name>.png
npm run film -- --seed abc --at 12.3 --frames 6 --every 40 --follow party:12345 --name adv-enter
npm run film -- --seed abc --tick 180000 --frames 6 --every 30 --xy 1200,640 --zoom 3 --name camp
npm run film -- --run runs/.cache/run/<道具の版>/a1/seed5-xxxx/0 --seed seed5 --tick 310600 --ticks 310640,310700 --xy 735,680 --name x   # その回の状態から
```

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

道具はすべて `node tools/analysis/launch.mjs <道具>` を通る（npm run が呼ぶ）。組み立てたものは `runs/.cache/bin/<道具>-<中身のハッシュ>.js` に置いて書き換えないので、batch の最中にソースを直してもよい。
回した結果と1日ごとの状態は、**版（シミュレーションのソースの中身のハッシュ）ごとの保存庫** `runs/.cache/` に残り、同じ版・同じシードならどの道具からも使い回す（しくみは docs/rework-tools.md）。

```bash
npm install                       # 初回
npm test                          # 決定性・帳簿・保存からの再現など（約12秒。保存からの再現は test/fixtures の5日目の状態から。TEST_FULL=1 で0日目から6日回すもとの確かめ）
npm run build                     # dist/index.html（外部依存なしの1ファイル）

# ふだんの一巡：手直し → 早めの確かめ → 8シードの対にした比較 → 原因を追う →（最後に）16シード×25日
npm run check                                      # 早めの確かめ（4シード、前の版の10日目の状態から18日目まで。中身は tools/analysis/checks.ts。約1分）
npm run ab -- --preset quick                       # 8シード：前の版（HEAD）の10日目の状態から、前の版といまの版で18日目まで（いまの版は8日ぶんだけ回す）→ compare.md
npm run ab -- --preset final                       # 16シード×25日、最初から（最終確認。前の版の結果は保存庫にあれば回さない）
npm run ab -- --base HEAD~1 --fork 5 --days 15 --seeds abc,かしたれ   # 分かれ目・日数・シードを選ぶ（--seeds 8 / 16 は決まった組。lib/seeds.ts）
npm run ab -- --base HEAD~1 --seeds abc,seed5 --days 10               # 1バイトも違わないか（整理・高速化の確かめ。違えば終わりの値が 1）
npm run ab -- --resume-check 7 --seeds かしたれ --days 10              # 7日目で分けて回しても、状態も記録も通しと一致するか

# 調べ物（途中の状態の保存庫から始める。どの版の何日目から始めたかを最初に表示する）
npm run probe -- deaths --seed seed7 --kind 2 --cause starve --day 19    # 19.0〜20.0日（20日目）に飢え死にした大ネズミの、死ぬ前1000刻みの履歴と様子の内訳（--warm で範囲の前から）
npm run probe -- life --seed abc --id 1234                               # ある個体の一生（生まれた日は自動で探す）
npm run probe -- calls --seed abc --method sendCollectors,vassalsOf --from 10 --to 12   # メソッドの呼び出しの回数と戻り値の内訳（日ごと）
npm run probe -- look --seed abc --at 18.5 --id 1234 --expr "e.camps.map(c => c.store)" # その刻みのまわりの地形と生き物、式の値
npm run probe -- stuck --seed seed7 --from 10 --to 12 --kind 2           # 動こうとして進めない場所の地図（stuck.png）
#   共通：--run <回したフォルダ>（その回の状態を使う）、--base <参照>（いまの版の状態がないとき使う前の版）、--pure（いまの版で最初から回した状態だけ）

# 回し直さずに値を計算する（1日ごとの状態を読み直す。記録に無い値が後から要るとき）
npm run metric -- --runs runs/ab-x/base,runs/ab-x/new --name campStore --days 10-18   # 決まった名前は metric.ts の NAMED。二つ渡すと対にした比較も
npm run metric -- --runs runs/b16 --expr "e.warrens.length"                           # 式（w, e, m, s, K）

# 回す・並べる（保存庫を使い回す。同じ版・シードを前に回していれば回さない。足りなければ続きから）
npm run sim -- --seed かしたれ --days 30 --out runs/kashitare     # 画面なしで全速（地上1日あたり約2.5〜4秒。生き物が増える終盤ほど遅い）。snap/ に1日ごとの状態
npm run sim -- --resume runs/kashitare                              # 時間切れで止まった所から続ける（記録も状態も通しと1バイトも違わない）
npm run sim -- --seed abc --days 5 --out runs/t --trace 1234        # 生き物1234の一生を毎刻み記録
npm run report -- --run runs/kashitare                              # report.md と deaths.png / births.png
npm run batch -- --seeds 16 --days 25 --out runs/b16                # 並べて回し、report と比較の表 summary.md（かかる時間の長いシードから）
npm run batch -- --seeds 8 --days 25 --ref HEAD~1                   # 前の版で回す（--fork 10 --base HEAD で前の版の10日目から）
npm run batch -- --out runs/b16 --summary                           # 表だけ作り直す
npm run batch -- --seeds ... --days 25 --adv-max 2 --out runs/b-adv2 # 冒険者の一行の上限を切り替えて回す（既定 2）
npm run compare -- --runs runs/b1,runs/b2 --names "前,後" --out docs/x.md   # batch どうしをコボルトと大ネズミの目安で並べる
npm run compare -- --runs ... --paired --since 10                            # 同じシードどうしの差の分布と「はっきり / ばらつきの内」の目安（ab が付ける）
npm run compare -- --runs ... --goals tools/analysis/goals-settling.json     # 目安に届いたか（✅/❌）の表をつける
npm run advreport -- --runs runs/ab-x/base,runs/ab-x/new --out x.md      # 冒険者の目標（着いた・果たした）、ゴブリンの盗みと退治、竜退治、大ネズミの引っ越しの列を対にして数える
npm run autopsy -- --seed seed7 --days 25 --kind 2 --cause starve   # probe deaths の別名（0〜25日目すべて）
npm run stuckmap -- --seed seed7 --days 12 --kind 2                 # probe stuck の別名
npm run bench -- --repeat 3                                         # 速さ：seed4・かしたれ・seed7 を10日目の状態から1日ずつ（同時に回さない）。手直しの前後は続けて測る（揺れが1割ほどある）
```

手直しの効き目は、1シードでは分からない（展開が少しの違いで大きく分かれる）。`ab --preset quick`（同じ途中の状態から前の版といまの版を続ける対にした比較）で見て、compare.md の「対にした比較」の目安が「はっきり」のものだけを効き目とみなす。「ばらつきの内」は、その差がシードごとの展開の揺れで説明できる大きさということ（16シードでも1シードの出来事に引っ張られることがあるので、「1シードの寄与」の列も見る）。

途中の状態の保存庫は、コードの版ごとに分かれる（版が変われば使わない）。コードを直した直後は、いまの版の状態はまだないので、調べ物は前の版（HEAD）の状態から、いまの版で続けて回す（何日目から分かれたかを表示する）。
`runs/.cache` は大きくなったら消してよい（次に回したときに作り直す）。
main の版の保存庫（16シード×25日の結果と1日ごとの状態、約26MB）は、main へのマージごとに GitHub Actions（.github/workflows/simcache.yml）が作って Release「sim-cache」に置き、クラウドのセッションは始まりのフック（.claude/hooks/session-start.sh）で裏で取ってくる（`node tools/analysis/simcache.mjs fetch --ref origin/main`。様子は runs/.cache/fetched/log.txt）。マージの直後で Actions がまだ終わっていなければ取れないので、いまどおり手元で回す。git には入れない（版が変わるとすぐ使われなくなり、履歴が重くなる）。

`sim` を直接回すときは `--budget 秒`（既定270）を超えそうになると途中の状態を書き出して止まる（`--resume` で続ける。分けても結果は同じ）。batch・ab・check は時間で止めない。

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

## 公開（Cloudflare Workers の静的アセット）

設定はすべてリポジトリの中：`wrangler.jsonc`（`dist/` をそのまま公開。Worker のコードは無い。`workers_dev` と `preview_urls` は true）と `.github/workflows/deploy.yml`。Node の版は `.node-version`、wrangler は devDependencies。

- **PR**（作ったとき・push したとき）：`check` のジョブが `npm ci`・`npm run typecheck`・`npm test`・`npm run check`（前の版＝PR の行き先の main の10日目の状態から。main の保存庫が Release にあれば取ってくる）を回す（失敗すれば PR のチェックが赤）。`preview` のジョブが `npm run build` して `wrangler versions upload --preview-alias pr-<番号>`（本番には出さない版）を上げ、プレビューの URL を PR にコメントする（同じ PR では一つのコメントを書き換える。PR ごとに変わらない `pr-<番号>` の別名の URL と、コミットごとの URL）。フォークからの PR ではプレビューを作らない。
- **main への push**：`npm run typecheck`・`npm test`・`npm run build` のあと本番へ（`npx wrangler deploy`）。
- リポジトリの Secrets に `CLOUDFLARE_API_TOKEN` と `CLOUDFLARE_ACCOUNT_ID` が無ければ、公開だけ飛ばす。

**dist はコミットしない**（`.gitignore` のとおり。`npm run build` で手元に作る）。PR には Actions がプレビューの URL を付けるので、遊んでの確かめや見た目の確かめはその URL でもできる（末尾に `#lit`・`#clean`・`#fxdemo` なども付けられる）。

Cloudflare のスキルと MCP サーバー（プラグイン `cloudflare@cloudflare`、マーケットプレイスは `cloudflare/skills`）は `.claude/settings.json` で有効にしてあり、クラウドのセッションでも毎回入る。MCP は初めて使うときに OAuth で許可を求める。
CLAUDE.md の手入れのプラグイン（`claude-md-management@claude-plugins-official`、マーケットプレイスは `anthropics/claude-plugins-official`）も同じく `.claude/settings.json` で有効にしてある：スキル `claude-md-improver`（この手引きの点検と直し案）と `/revise-claude-md`（作業でわかったことを書き足す）。

```bash
npm run build && npx wrangler deploy --dry-run     # 設定の確かめ（アカウントは要らない）
```

## 分析の流れ（推奨）

1. 手直しをしたら `npm test`、そして `npm run check`（新しい流れが実際に起きるかを、決まった途中の状態から1〜2分で）。届かない確かめがあれば、大きな比較の前に `probe` で原因を追う。新しい流れを足したら、その確かめを `tools/analysis/checks.ts` に足す（起きることがわかっているシードと日を、前の batch の settle.jsonl などから選ぶ）。
2. `npm run ab -- --preset quick` で、8シードの対にした比較（compare.md）。「はっきり」の行と「1シードの寄与」を見る。
3. 気になるものは `probe`（deaths / life / calls / look / stuck）で追う。途中の状態から始まるので数秒で始められる。使い捨てのスクリプトを書く前に、まず probe と `--expr` で足りないかを見る。短い自前のスクリプトが要るときは `lib/open.ts` の `openAt(シード, 刻み)` で状態を手に入れる。
4. 比べたい値が記録に無ければ、`npm run metric`（1日ごとの状態から計算）で足りるかを見る。足りなければ sim.ts の記録に足す（記録の仕方が変われば保存庫の結果は使われず、回し直しになる）。
5. 区切りがついたら `npm run ab -- --preset final`（16シード×25日）で最終確認し、report.md の「おかしな兆候」と帳簿を見る。
6. 帳簿のずれは `tools/analysis/drift.ts`（`--from 日 --to 日`）、`manacheck.ts`、`goldcheck.ts` で、ずれた刻みと、その刻みに変わった生き物を突き止める。

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
| snap/dNNN.json.gz | 地上の1日ごとの状態（checkpoint と同じ形を gzip）。batch や ab の出力では meta.json の `snaps` が保存庫の場所を指す |
| meta.json | シード、日数、刻み、冒険者の上限、版の系譜 `lineage`（どの版がどの刻みから回したか）、かかった秒数 |

samples.jsonl は、刻みが `DAY_TICKS/4` の倍数のときに記録する（続きから回しても同じ刻み。以前は0.3日目から1/4日ごとだった）。

種の番号と名前は `src/names.ts`、賢さの段階は `TIER`、強さは `STR`（ecology.ts）。

## ソースの地図

| ファイル | 中身 |
|---|---|
| src/mapgen.ts | 地形の生成（洞窟、迷路、水路、溶岩、苔、養分、宝物庫、深部、閉じた空洞） |
| src/world.ts | 世界の1刻み（水、養分、熱、苔、キノコ、光る苔の光、掘削、瓦礫、崩落、養分の生まれる元と流れ出る先）、地形の変化の記録（`digs`：`k*8+種類`、0 掘る / 1 瓦礫 / 2 崩落 / 3 風化 / 4 石畳） |
| src/ecology.ts | 生き物たち（Ecology）のクラスの本体：状態のフィールド、保存しない控え、定数（SPEC、STR、TIER など）、型。メソッドはここには無い |
| src/eco/*.ts | Ecology のメソッドを種・仕組みごとに（rat、kobold、goblin、orc、adventurer、dwarf、dragon、step（1歩）、move（道のりと移動）、senses、groups、sleep、combat、arrivals（外から来るもの）、save など）。各ファイルが `Object.assign(Ecology.prototype, …)` で足す。index.ts がすべてを読み込む（world.ts が読む） |
| src/sprites.ts, atlas.ts | ドット絵の部品と、それを詰めた画像 |
| src/creatureView.ts, renderer.ts, shaders.ts | 描画 |
| src/main.ts | ループ、画面の部品（ミニマップ、記録、養分の表示）、保存 |
| test/*.ts | テスト |
| tools/gallery/ | 見た目の確認（scenes.ts と shoot.mjs：決まった場面の一覧、shot.ts と shot.mjs：見たいものを探して撮る） |
| tools/analysis/ | 分析の道具（launch.mjs：組み立てて回す入口, sim, report, batch, ab：前の版との比較, compare, advreport, probe：調べ物, check と checks.ts：早めの確かめ, metric：回し直さずに値を計算, cachemap：物資の置き場の推移と地図, lairdist, partydbg, drift, digmap, planview など） |
| tools/analysis/lib/ | 道具の共通部品（bins.mjs：版の見分けと組み立て, engine.ts：進め方, state.ts：状態の読み書き, runs.ts：保存庫, open.ts：途中の状態を手に入れる, batchrun.ts, stats.ts：対にした比較の目安, seeds.ts：決まったシードの組） |
| README.md | 段階ごとの仕組みの詳しい説明（仕様書として読める） |

## いまの仕組みの要点（段階13まで）

- 来し方は三つ：正面の入口は人の道（冒険者とドワーフだけ）。自然の口（地表の横穴、地底の裂け目、川の口。序盤は天井の割れ目から小さな獣）から獣や種族。マナから魔物（トロール、ミノタウロス、バジリスク、ドラゴンの幼子は `manaBirths`。ウィスプ、ゴースト、ミミック、ガーゴイル、サラマンダー、ゾンビ、スケルトン、リッチはもとの生まれ方にマナの条件）。
- マナ（world.ts の `manaStep`、地上の5秒ごと）：深部、地底の裂け目、宝物庫、溶岩、岩盤から湧き、岩にも染みとおって広がり、入口と横穴から逃げ、少しずつ薄れる。生き物は食べるとマナを受け取り、死ぬと土に還す。
- ドラゴンは `c.sp` が育ち具合（0 幼竜、1 若い竜、2 成竜）。`c.elite` は特別な個体（1 火の精、2 亡霊の騎士、4 大ネズミの王、5 ゴブリンの頭、6 水の精、7 光の精、8 骨の竜、9 キノコの主）。名前は `names`。
- 気づき方（`canSense`：目、夜目、匂い、振動、反響、魔法）、火を怖がる獣（`fearFire`）、光に寄る狡猾な種（`lurk`）、人の気配（`presenceAt`、強い魔物ほど避ける）、やわらかい間合い（`personalSpace`）、食べる時間（`feeding`）、弱い生き物の害（`pester`）、冒険者の三段階の戦い。
- コボルトの住処（四段目の前半）：人の気配が薄く、竜（30マス）・トロールとバジリスク（15マス）から離れ、食べ物の近い、歩いて行ける所を選び、岩壁に4マスの横穴を掘ってその奥（`Warren.x, y`）を住処にする（入口は `door`）。蓄え `store`（養分の帳簿に入る）、キノコの畑（土の養分をキノコへ移す）、入口のまわりの罠 `traps`。強い相手（冒険者の一行、若い竜、トロール、ミノタウロス）が近づくと奥に隠れる（`hide`。隠れている者は入口に踏み込まれない限り誰にも気づかれず、暗く沈んだ影の姿に光る目を重ねて描く。ほかの生き物から見えないだけで、眺める人には見せる）。描画：罠（歯の並ぶ鉄の板）、入口の飾り柱、奥の寝床、畑の畝とキノコ（`farmTiles`）。4〜6匹の群れで来て、住処へ向かう道中（`st 11`）は冒険者が8マス以内にいる間その場で身をひそめて待つ（`st 12`）。掘った横穴の中と入口のまわりは畑の判定で湿った扱い。一匹ずつは去らず、蓄えが尽きて1日、襲われた回数 `raids` が4、1匹になって1日（`alone`）、竜が近くに住みつく、のどれかで群れごと住処を捨てる（開いた横穴があれば去り、なければ中の別の場所へ移る）。襲われて捨てた直後は2日来ない（`koboldShun`）。竜の寝床のそばの口からは入ってこない。冒険者は逃げていく弱い者を追わない
- 大ネズミ：食べられる苔（`edibleMoss`、`updateForage` で数えて保存）に合わせて来る数と殖える数を抑える。巣穴のまわりの苔が尽きてきたら、苔の豊かな所へ巣穴を移す（`relocateBurrow`、`Burrow.moved`、stats.moves）。移れず、腹を空かせて近くに苔がなく、飢える前に歩いて着ける開いた横穴があれば、巣穴の仲間と群れで出ていく（`st 8`）。深い水に取り残されたら泳いで抜け出せる
- 冒険者の一行の上限 `Ecology.ADV_MAX_PARTIES` は既定2（段階13までは2、四歩目までは1。目標でない住みかを避けるようになったので2に戻した：docs/cap2-marks-20261114.md）
- 三巡目：大ネズミの殖える数は巣穴のまわりで決める（`Burrow.cap`、土地勘と同じ時機に数え直して保存）。巣穴は火のそばに作らない。届かない巣穴へは帰らず、はぐれ者になる。
  列の間合いは、前の仲間が動いているときだけ（止まっている仲間は脇へよけて追い越す）。
  コボルトは、口から歩いて行ける範囲に住めて食べ物の足りる場所（`warrenFood` が `KOBOLD_MIN_FOOD` 以上）がある口からだけ来る（`kobMouthOk`、600刻みごと、保存）。
- 四巡目：大ネズミは、口か天井の裂け目のまわり（道のり40マス）の食べられる苔で養える数に余裕があるときだけ、そこから来る（`ratMouthOk` / `ratShaftOk`、600刻みごと、保存）。来た群れは入ってきた所のそばの巣穴に入る（`pickBurrowNear`）。
  ゴブリンの集落（`Camp` の kind 0）もコボルトと同じ枠組み：場所は `pickGoblinCamp`（暗い、人の気配が薄い、冒険者の通り道（`routeDist`）から15マス以上、竜30・トロールとバジリスク15・コボルトの住処15マス離れ、まわり14マスの食べ物 `campFood` が `GOBLIN_MIN_FOOD` 以上）、口ごとの来訪 `gobMouthOk`、
  蓄え `store`（養分の帳簿に入る。狩り・死骸・盗みの余りを持ち帰る `st 4`）、蓄えからの出産、`watchCamps`（一行が明らかに強ければ `hide 1`：集落のまわりの暗がりに散って隠れる＝`st 7`、影の姿と光る目で描く。弱ければ `hide 2`：暗がりで待ち伏せ。見つかる・劣勢なら逃げ散って `raids` に数える）、
  `abandonCamp`（蓄えが尽きて1/3日たち皆が飢えかけ、`raids` 4、1匹で1日、竜。開いた横穴があれば `st 10` で群れごと去る＝exits `abandoned`、なければ移る）、`goblinShun`。ゴブリンの頭（elite 5）のいる集落は盗みと待ち伏せに大胆。settle.jsonl に k 12 の出来事も残る
- 五巡目：大ネズミの判定と巣穴の範囲は道のり `RAT_DOOR_REACH`（18マス）。オークはゴブリンを獲物にも敵にもせず（`HUNT_ORC`）、縄張りから20マス以内の集落を従える（`Camp.lx/ly`、`updateVassals`）。地上の約1日ごとに一匹が蓄えの3割を取り立て（`sendCollectors`、オークの `st 5` 行く / `st 6` 袋＝`units` を担いで帰る、settle.jsonl の `{k:13, ev:'tribute'}`）、従う集落のそばのコボルトを追い払う（`guardVassals`）。
  ゴブリンはコボルトの住処から12マス（`inKoboldLand`）の中の苔・獲物・死骸を目当てにせず、道筋もできるだけ避ける（`findPath` が先に避けて探す）。コボルトも住処をゴブリンの集落から15マス離す。ゴブリンの腹の減り方は meta 57。
- 六巡目：大ネズミは、地表の横穴が一つも開いていない間だけ天井の割れ目から来る。腹を空かせた大ネズミの目当ては歩いて12マス以内のいちばん近い苔（`nearestEdible`、立てない深い水は除く）、遠くの群落（`nearestForage`）は歩いてつながった洞窟（`regionOf`）の中だけ。
  道筋の見つからない目当てはあきらめる（`paths` の gk で判定）。飢えが7割を越えた者・着ける口のない者は群れで出ていかない（`ratDisperse`）。向かい合った仲間には列の間合いを働かせない。おびえたら目当てを替える（`gait` に避ける目当て）。
  ゴブリンの食べ物の主は、集めに出た者（`st 4`）が集落のまわり14マスで摘んで持ち帰るキノコと苔（袋＝`units`、20まで）。狩り（8マス）と死骸（`goblinCarrion`）は足し。腹を空かせたら苔とキノコを腹の7割まで。
  貢ぎ物の取り立てには、腹ぺこのオークも飢えて去る途中（`st 9`）のオークも行く（取り立ては飢えて去るより先に扱う）。samples の `settle.campStore` に集落の蓄え
- 大ネズミの目当ての見直し：腹を空かせて目当てへ向かう途中も、10歩に1回まわり（歩いて12マス、`nearestEdibleD`）を見直し、目当てまでの残りの道のりより近い食べ物があれば替える。おびえて避ける目当て（`gait`）は、まわり1マスも避ける（ゴーストの居座る群落のそばで、隣のマスを目当てにしてはおびえる、を繰り返して飢えていた）
- 七巡目（docs/settling-20261109.md、住みつける仕組みはここで一区切り）：大ネズミは、地表の横穴が開いたあとでも中の数が2匹以下になったら天井の割れ目からまた2〜3匹ずつ入り直す（`ratReentry`、3匹を超えたら閉じる。settle.jsonl の `{k:2, ev:'reenter'}`）。
  オークの取り立ては決まった間隔をやめ、腹の半分を切ったときに行く（`goCollect`、同じ集落へは地上の1/3日あける）。量は腹の空きを目安に、蓄えの半分まで、集落の取り分（`campStoreGoal` の半分）は残す。オークの腹の減り方は meta 56。
  オークは、口から歩いて100マスの範囲に従っていないゴブリンの集落か獲物（大ネズミ・大トカゲ・コボルト、いるオーク1匹あたり4を引いて `ORC_MIN_PREY` 以上）のある口からだけ来る（`orcMouthOk`、600刻みごと、保存）。
  ゴブリンが分かれるときは、人数の割合で蓄えを分けて持っていく（found の記録に `store`）。湿り気 `moist` は作り直すたびに全体を0にしてから床を埋める（読み込み直したときと合わせる）
- 冒険者の作り直しの一歩目（docs/adventurer-aims-20261110.md、src/eco/aim.ts）：一行は入ってくるとき目標を一つ持つ（`Party.aim`：1 宝、2 竜、3 大物、4 アンデッド、5 ゴブリン退治、0 探索）。外の噂と職業から決め、場所を知らなければ噂の場所か深部へ当て推量で向かい（`aimGuess`）、見えたら目標にする。着くと止まって構え（`brace`、描画は振りかぶった姿）、皆に「！」。
  目標でない住処・集落・村・縄張りは道筋で避け（`advPath`、通らないと行けないときだけ通る）、その住民には自分たちから戦わない（`spareResident`：襲ってくる者と、すぐそばで行く手をふさぐ者とは戦う）。そばを通ると一度だけ止まって住みかの方を向く（「？」）。
  ゴブリンの盗み（`Party.robbed`）を生還者が噂（`rumors.goblin`）にし、0.5 を超えるとゴブリン退治の一行が来る。率いる者の名前 `Party.name`。settle.jsonl の `{k:25}`（enter / arrive / aim / pass / end）と `{k:12, ev:'rob'}`
- 冒険者の作り直しの二歩目（docs/adventurer-step2-20261111.md、src/eco/raid.ts）：夜、蓄えの乏しい集落のゴブリン1〜3匹が、10〜50マス先で焚き火を囲む一行へ暗がりを選んで忍び寄り（`st 15`、光の縁で身をひそめてから駆け寄る）、眠っている者の食べ物と松明を盗んで逃げ帰る（`st 16`、袋 `units` を蓄えへ）。見張りの向いている側3マスで見つかれば手ぶらで逃げる。`Camp.raidT`。冒険者は夜は早めに焚き火を囲む。
  ゴブリン退治の一行だけは、目指す集落の隠れたゴブリンを松明の光（5.5マス）で見つけ（`huntsCamp`）、着いて誰も見えなければ900歩探して引き返す。
  竜殺しは、竜の寝床への道（`Lore.dragonWay`、寝床のドラゴンを見通しの利く所から見た一行が持ち帰る）が知られているときだけ竜退治（`aimWay`）、なければ深部の探索（`aim 6`、寝床を見たら道を持ち帰る）。
  コボルトは腹いっぱいなら住処へ持ち帰り（`st 13`）、集めの係は畑のキノコを摘む。住処の横穴には瓦礫を置かない（`inWarrenTunnel`。前は自分たちの掘った土で住処の奥が埋まっていた）。大ネズミの巣穴の引っ越しは一列で歩く（`st 11`、`ratMarch`）。
  マナから生まれる者の出現の演出（描画だけ、`fxManaBorn`、幼竜は卵が割れて出てくる）
- 冒険者の作り直しの三歩目（docs/adventurer-step3-20261112.md、src/eco/cache.ts）：焚き火の見張りはときどきうとうとし（`Party.dozeT / dozeNext`、頭に小さな z）、その間は忍び寄るゴブリンに気づかない（ゴブリンはうとうとを待って駆け寄る）。生還者が伝えた盗みが2回（`Rumors.goblinRobs`）でゴブリン退治の一行が来て、最後に盗みを働いた集落（`goblinCamp`）を目指す。
  深部の探索の一行は荷（一人60、`Cr.units`）を背負い、引き返す所に物資の置き場（`Ecology.caches`、木箱と寝具、食料は養分の帳簿に入る）を残し、生還すれば町の知識（`Lore.caches`）に。深部の探索と竜退治は、目指す所に近い置き場へまっすぐ向かって補い、着いた置き場で休む。大ネズミがあさる。幼竜が孵ると竜の噂が立つ。
  見せたい瞬間の回数は tools/analysis/lib/moments.ts（compare.md と advreport の表）。巣穴の絵は列の先頭が着くまで古い場所（描画だけ、`fxMarch`）
- 冒険者の作り直しの四歩目（docs/adventurer-step4-20261113.md、src/eco/raid.ts・listen.ts・loot.ts）：**通路での掠め取り**：蓄えが目安の9割に満たない集落から、松明を持たないゴブリン1匹が、一行が近く（24マス、歩いて32マス）を歩いていれば最後尾をつけに出る（`st 17`、`lure` 最後尾）。いなければ、一行が50マスの内にいるとき、通り道（`routeDist`）から6〜9マス脇の暗がりで待ち伏せる（`lure 0`、2400歩。12マスに最後尾が来たらつける、30マスなら寄っていく）。灯りの縁の外をすぐ後ろ（3.5マス）までつけ、暗い所で一行が歩いていれば駆け寄って荷から食べ物を掠め取り（`goblinSteal` の how `snatch`、松明は取らない）、`st 16` で逃げ帰る。最後尾に「！」、一行は振り返る（`brace` の kind 3）。前を向いた者（盗賊・狩人は向きによらず）に灯りの中で見られると見つかって逃げ帰る。出る間隔は夜の盗み（`Camp.raidT`）と別（`Camp.snatchT`）。settle.jsonl の `{k:12, ev:'ambush' / 'stalk' / 'rob' how:'snatch' / 'spotted' how:'snatch'}`。
  **聞き耳**：物音 `noises` に種類 `s`（0 大きな音、1 足音＝重い者が歩く、2 うなり声＝腹を空かせたか戦いの中の獣。`creatureSounds`、8歩ごと、一行がいるときだけ）。足音とうなり声は冒険者だけが聞く（獣を呼ばず、眠りを覚まさない）。一行は灯りの外・暗い所の音を、音の大きさ r マス（盗賊と狩人は1.5倍）で聞き取り、立ち止まって音の方を向き「？」、前衛（戦士か竜殺し）が一歩前に出て構える（`Party.listenT / listenX / listenY / listenBy`、32歩）。同じ方角（8方位）は900歩、どの方角も200歩あける（`heardDir`）。見えた相手には今までどおり戦う・避ける。`{k:25, ev:'hear'}`。
  **戦利品**：目標（竜・大物・アンデッド・ゴブリン退治）を果たすと、倒した相手にちなむ戦利品（`Party.trophy` 種の番号、`trophyBy` 担ぐ者。名前は loot.ts の `TROPHY`）を担ぎ、生きて帰れば記録に「〜の一行が竜の牙を持ち帰った」。全滅すれば倒れた所に残る（床の道具 `ItemKind.Trophy`、fuel に種）。倒れた冒険者は荷（`ItemKind.Pack`）を残す。金貨を持つ者は量に応じた袋を担ぐ（描画だけ）。`{k:25, ev:'trophy', how:'take' / 'home' / 'lost'}`
- 上の横穴の岩壁が崩れる（`breakTopWall`、3〜5日目）：掘った通路が掘った土で埋まって横穴が開かないことがあったので、開くまで1日のあいだ掘り直す（開いたときだけ記録に出す）
- 頭の上の印（「！」「？」「z」）は暗い縁取りの吹き出しに光る太い字。聞き耳の「？」は立ち止まっている間ずっと出す（描画だけ）
- 速さのための間引き（docs/speed-experiments）：ウィスプ（光の精を除く）は生き物の1歩の4回に1回だけ判断し、その回に4回ぶん動いて食べる（`Ecology.WISP_EVERY`、`wispIdle`。描画は `moveAlpha` で4回ぶんの時間をかけて補間）。苔とキノコは40刻みごとに2回ぶん進める（`MOSS_EVERY`、`MOSS_R`）。画面なしでは見たマスの更新を200刻みごと（lib/engine.ts。見たマスは生き物の判断に使わない）
- 描画だけ：攻撃の技の演出（`fxAttacks`、`creatureView.drawAttacks`）、気づいた印、のけぞり、飛び散る粒。見本は `dist/index.html#fxdemo`。画面の部品を隠すのは `#clean`。

## 変更するときの注意

- 生き物の行動を変えたら、`npm test` と `npm run check` に加えて、`npm run ab -- --preset quick` で兆候と帳簿を確かめる。テストは1日半しか回さないので、長く回して初めて出る不具合がある（例：ドワーフがあきらめて去るとき食料が帳簿から消えていた）。
- ウィスプの処理を足すときは、判断する回が4回に1回であることに気をつける（間引いた回は代謝だけ。`px` は動いた回の前の位置のまま残し、描画の補間に使う）。苔とキノコの刻みに確率や増減を足すときは、`MOSS_R` 倍にする。
- 新しい「消える」「現れる」経路を足したら、帳簿（imported / exported / born / washed / goldIn / goldOut / 岩）と、`stats`（deaths / births / exits）の両方に記録する。
- 描画だけの状態（血の跡、土ぼこりなど）は保存しない。シミュレーションの判断に使わないこと。
- 帳簿のずれは、`tools/analysis/manacheck.ts` と `goldcheck.ts`（ずれた刻みと、その刻みに変わった生き物・宝の山を表示する）で突き止めるのが早い。
- Ecology にメソッドを足すときは、種・仕組みに合う src/eco/*.ts に `export function 名前(this: Ecology, …)` で書き、そのファイルの末尾の `declare module` と `Object.assign` に名前を足す。新しいファイルなら src/eco/index.ts に import を足す。
- 展開を変えないはずの整理は `npm run ab -- --base <整理の前のコミット> --seeds abc,かしたれ,seed4,seed7 --days 10` で1バイトも違わないことを確かめる。
- `false &&` で古い処理を止めると、TypeScript の型の絞り込みで別の所が型エラーになることがある。止めるなら処理ごと消す。
- 見た目の確認は、`node build.mjs` のし忘れに注意（古い dist で撮ってしまう）。
