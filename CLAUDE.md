# Moss & Gold（苔と金貨）：開発と分析の手引き（Claude Code 向け）

見下ろし2Dのダンジョン生態系アクアリウム。WebGL2 で描き、シミュレーションは CPU 上で決定的に動く。プレイヤーは眺めるだけ（介入なし）。設計の原則は「いくつもの遊びが互いに意味を与え合う構造」。
旧称「ダンジョン・アクアリウム」が保存のキー（save.ts の KEY）などに残っているが、保存データの互換のため変えない。

仕組みの詳しい説明（仕様書）は README.md（段階ごと）、各巡・各歩の狙いと結果は docs/（settling-*、adventurer-*）。種の番号と名前は `src/names.ts`。

## 見える相互作用の決まり

眺めるゲームなので、内部の仕組みは画面の中で目に見える相互作用（生き物の動き、姿、場面の変化）として現れて初めて意味がある。記録の文章や生き物の札は補い。

- **見えることから決める**：新しい仕組みは、まず「画面で何が見えるか」を決め、それを起こすのに要る分だけ内部を作る。
- **撮って添える**：作業の終わりに、その瞬間を撮って docs/img/ に置き、報告に添える（動きなら `npm run film` で数こまの連続）。撮れないときは理由を書く。
- **起きる回数を確かめる**：25日に一度も起きない場面は無いのと同じ。見せたい瞬間のシードごとの回数（compare.md と advreport の表、数え方は tools/analysis/lib/moments.ts）を比べるときの標準の指標にする。目安は「16シードのうち12以上で、25日に1回以上、できれば数回」。めったに起きない特別な出来事（骨の竜など）は対象外。新しい瞬間を作ったら moments.ts に数え方を足す。
- **見えない所を見つけたら**：小さな手直しで見せられるものはその場で直し、大きなものは報告に「見えない所」として挙げる（これまでの点検は docs/visibility-audit.md）。

```bash
npm run film -- --seed abc --at 12.3 --frames 6 --every 40 --follow party:12345 --name adv-enter   # → docs/img/<name>.png
```

## 最初に知っておくこと

- **決定的**：同じシードからは同じ展開になる。乱数は `ih(a, b, salt)` などのハッシュで、`Math.random` は描画用だけ。
- **保存からの再現**：保存して読み込み直しても続きが一致しなければならない。新しい状態は必ず `Ecology.serialize/restore`（または `WorldState`）に入れる。保存しない状態（描画だけのもの：血の跡、土ぼこり、演出など）はシミュレーションの判断に使わない。
- **帳簿（保存則）**：次の四つは常に成り立つ。崩れたら不具合。
  - 養分：`totalNutrients() − はじめ − imported + exported − born + washed = 0`
  - 金貨：`totalGold() − はじめ − goldIn + goldOut = 0`
  - 岩：`rockLedger() === initialRock`
  - マナ：`totalMana() − manaBorn + manaLeaked + manaFaded = 0`（土の `world.mana` と、生き物の `Cr.mana`）
- **キャッシュの作り直しの時機**：保存しない控え（`litMap`、`regionMap`、`dewMap`、`gkCache` など）は、刻みの番号か地形の変化の記録（`digs.length`）だけで作り直す時機を決める。「最後に作った刻みからの経過」で決めると、読み込み直したときにずれる（実際に何度も起きた）。
- 時間：`TICKS_PER_SEC = 10`、地上の1日 `DAY_TICKS = 14400` 刻み。生き物は `CR_EVERY = 2` 刻みごとに動く。地図：192×144 マス、1マス16画素（`MapData`、mapgen.ts）。

## コマンドと分析の流れ

道具はすべて `node tools/analysis/launch.mjs <道具>` を通る（npm run が呼ぶ）。**各道具の使い方は、そのファイルの先頭のコメント**（tools/analysis/*.ts）にある。
回した結果と1日ごとの状態は、版（シミュレーションのソースの中身のハッシュ）ごとの保存庫 `runs/.cache/` に残り、同じ版・同じシードなら使い回す（しくみは docs/rework-tools.md。大きくなったら消してよい）。main の版の保存庫は、クラウドのセッションでは始まりのフックが Release「sim-cache」から裏で取ってくる（様子は runs/.cache/fetched/log.txt。マージ直後で無ければ手元で回る）。

```bash
npm install                       # 初回（クラウドのセッションでは始まりのフックが入れる）
npm test                          # 決定性・帳簿・保存からの再現など（約12秒。TEST_FULL=1 で0日目から）
npm run typecheck
npm run build                     # dist/index.html（外部依存なしの1ファイル。dist はコミットしない）
```

ふだんの一巡：

1. 手直しをしたら `npm test` と `npm run check`（決まった途中の状態から、新しい流れが実際に起きるか。約1分。中身は tools/analysis/checks.ts）。新しい流れを足したら、その確かめを checks.ts に足す。
2. `npm run ab -- --preset quick`：8シード、前の版（HEAD）の10日目の状態から前の版といまの版で18日目まで続けて、対にして比べる（compare.md）。**「はっきり」の行だけを効き目とみなす**（「ばらつきの内」はシードごとの揺れで説明できる差。「1シードの寄与」の列も見る）。1シードでは効き目は分からない。
3. 気になるものは `npm run probe -- deaths|life|calls|look|stuck`（途中の状態から数秒で始まる）で追う。使い捨てのスクリプトを書く前に probe と `--expr` で足りないか見る。自前のスクリプトなら `lib/open.ts` の `openAt(シード, 刻み)`。記録に無い値は `npm run metric`（1日ごとの状態から計算）で足りるか見て、足りなければ sim.ts の記録に足す。
4. 区切りがついたら `npm run ab -- --preset final`（16シード×25日、最初から）で最終確認し、report.md の「おかしな兆候」と帳簿を見る。
5. 帳簿のずれは `tools/analysis/drift.ts`、`manacheck.ts`、`goldcheck.ts` で、ずれた刻みとその刻みに変わった生き物を突き止める。

```bash
npm run ab -- --base HEAD~1 --seeds abc,かしたれ,seed4,seed7 --days 10   # 展開を変えないはずの整理：1バイトも違わないか（違えば終わりの値が 1）
npm run ab -- --resume-check 7 --seeds かしたれ --days 10              # 途中で分けて回しても通しと一致するか
npm run bench -- --repeat 3                                            # 速さ。手直しの前後は続けて測る
```

コードを直した直後は、いまの版の状態はまだないので、probe などは前の版（HEAD）の状態から、いまの版で続けて回す（何日目から分かれたかを表示する）。
`sim` を直接回すと `--budget 秒`（既定270）で途中の状態を書き出して止まる（`--resume` で続ける）。batch・ab・check は止まらない。
記録のファイル（settle.jsonl、samples.jsonl、deaths.jsonl など）の中身は docs/records.md。

## 見た目の確認

```bash
npm run gallery -- --label before    # 直す前に撮って build/gallery/before/ に残す
npm run gallery -- --compare before  # 直したあと、before と左右に並べた build/gallery/compare-before.png
node tools/gallery/shoot.mjs --only dragon,camp     # 場面を選んで撮り直す（node build.mjs を先に）
npm run shot -- --seed かしたれ --find warren         # 見たいものが出るまで進めて撮る（build/shots/）
```

場面は `tools/gallery/scenes.ts` の `SCENES`。数値では測れないので、必ず画像を見て判断する（一箇所を直すと別の場面が崩れることがある）。古い dist で撮らないよう `node build.mjs` を忘れない。
URL の末尾に `#lit`（全体を明るく）、`#albedo`（地形の色だけ）、`#clean`（画面の部品を隠す）、`#fxdemo`（攻撃の演出の見本）を付けられる（`#clean,lit` のように並べてもよい）。

## 公開（Cloudflare Workers の静的アセット）

`wrangler.jsonc`（`dist/` をそのまま公開）と `.github/workflows/deploy.yml`。PR では typecheck・test・check（main の10日目の状態から）が回り、プレビューの URL（`pr-<番号>`）が PR にコメントされる。main への push で本番へ。Secrets（`CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_ACCOUNT_ID`）が無ければ公開だけ飛ばす。設定の確かめは `npm run build && npx wrangler deploy --dry-run`。

## ソースの地図

| ファイル | 中身 |
|---|---|
| src/mapgen.ts | 地形の生成（洞窟、迷路、水路、溶岩、苔、養分、宝物庫、深部、閉じた空洞） |
| src/world.ts | 世界の1刻み（水、養分、熱、苔、キノコ、光、掘削、瓦礫、崩落、マナ `manaStep`）、地形の変化の記録 `digs`（`k*8+種類`、0 掘る / 1 瓦礫 / 2 崩落 / 3 風化 / 4 石畳） |
| src/ecology.ts | Ecology のクラスの本体：状態、保存しない控え、定数（SPEC、STR、TIER など）、型。メソッドは無い |
| src/eco/*.ts | Ecology のメソッドを種・仕組みごとに（rat、kobold、goblin、orc、adventurer、aim、raid、cache、listen、loot、roster、dwarf、dragon、step、move、senses、groups、sleep、combat、arrivals、save など）。index.ts がすべてを読み込む |
| src/sprites.ts, atlas.ts | ドット絵の部品と、それを詰めた画像 |
| src/creatureView.ts, renderer.ts, shaders.ts | 描画 |
| src/main.ts | ループ、画面の部品、保存 |
| test/*.ts | テスト |
| tools/gallery/ | 見た目の確認（scenes.ts・shoot.mjs：決まった場面の一覧、shot.ts：探して撮る、film.mjs：数こまの連続） |
| tools/analysis/ | 分析の道具（入口は launch.mjs）。共通部品は lib/（engine.ts 進め方、state.ts 状態の読み書き、runs.ts 保存庫、open.ts 途中の状態、stats.ts 対にした比較の目安、seeds.ts シードの組、moments.ts 見せたい瞬間の数え方） |

## 変更するときの注意

- 生き物の行動を変えたら、`npm test` と `npm run check` に加えて `npm run ab -- --preset quick` で兆候と帳簿を確かめる。テストは短いので、長く回して初めて出る不具合がある（例：ドワーフがあきらめて去るとき食料が帳簿から消えていた）。
- 新しい「消える」「現れる」経路を足したら、帳簿（imported / exported / born / washed / goldIn / goldOut / 岩）と `stats`（deaths / births / exits）の両方に記録する。
- Ecology にメソッドを足すときは、合う src/eco/*.ts に `export function 名前(this: Ecology, …)` で書き、そのファイルの末尾の `declare module` と `Object.assign` に名前を足す。新しいファイルなら src/eco/index.ts に import を足す。
- 速さのための間引き：ウィスプ（光の精を除く）は生き物の1歩の4回に1回だけ判断する（`WISP_EVERY`。間引いた回は代謝だけ、`px` は動いた回の前の位置のまま残して描画の補間に使う）。苔とキノコは40刻みごとに2回ぶん進めるので、確率や増減を足すときは `MOSS_R` 倍にする。画面なしでは見たマスの更新が200刻みごとなので、見たマスを判断に使わない。
- `false &&` で古い処理を止めると、型の絞り込みで別の所が型エラーになることがある。止めるなら処理ごと消す。
