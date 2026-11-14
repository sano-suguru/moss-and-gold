# Moss & Gold（苔と金貨）：開発と分析のガイド（Claude Code 向け）

見下ろし2Dのダンジョン生態系アクアリウム。描画は WebGL2、シミュレーションは CPU 上で決定的に動く。プレイヤーは眺めるだけで介入しない。設計の原則は「いくつもの遊びが互いに意味を与え合う構造」。
旧称「ダンジョン・アクアリウム」が localStorage のキー（src/save.ts の `KEY`）などに残っているが、セーブデータの互換のため変えない。

README.md（と英語版の README.en.md）は、訪れた人と遊ぶ人に向けた紹介で、仕組みは大まかにしか書かない（作りながら変えるので、数字や細かい振る舞いは書かない）。仕組みの細部は src/eco/*.ts などのコードのコメントが正。各改修の狙いと結果は、その PR の説明にある。種の番号と名前の対応は `src/names.ts`。

## 文章の書き方

コメント、docs、コミットメッセージ、PR、報告に共通。

- **日本語で書く**：セッションの中でのユーザーへの返答・報告・質問も、コメントやコミットメッセージなどと同じく日本語で書く（ユーザーが英語で書いたときも、頼まれない限り日本語で返す）。
- **標準的な開発用語はそのまま使う**：tick、キャッシュ、スナップショット、チェックポイント、シード、ビルド、コミット、ハッシュ、invariant、A/B 比較など。直訳や言い換え（「刻み」「控え」「保存庫」「版」「回す」など）はしない。
- **コードの中身は、何をするものかを言葉で書く**。関数名や変数名だけで説明を済ませない（名前は参照用に括弧で添える）。
  - ×「`starveMap` に足す」
  - ○「湧く種が飢え死にしたら、その区画の飢え死にの記憶に体の大きさを足し、生き物の更新200回ごとに薄れさせる。記憶の濃い所には魔物が湧きにくい（`starveMap`）」
- **tick と生き物の更新を区別する**：世界（水・苔・光・マナ）は tick ごと、生き物は2 tick に1回の更新（`Ecology.step` が更新の通し番号）ごとに数える。生き物の処理の「N 回ごと」「N 回たったら」は、たいてい tick ではなく生き物の更新の回数なので、コードを見て書き分ける。
- ゲームの中の名前（UI の表示、種や個体の名前、場所の名前）は日本語のまま。
- 既存の文章は、触ったついでにこの書き方へ直す。

## 「画面に見えること」を先に決める

眺めるゲームなので、内部の仕組みは、画面の中の生き物の動き・姿・場面の変化として見えて初めて意味がある。ゲーム内ログの文章や生き物の情報パネルは補助。

- **見えることから設計する**：新しい仕組みは、まず「画面で何が見えるか」を決め、それに要る分だけ内部を作る。技や攻撃は、受けた側の反応（向き直る・「!」・飛び起きる）まで決める。気づかせることと、打ってきた相手（foe・hitAt）として追わせることは分けて決める（追わせると、その種が倒されて減りやすい）。
- **スクリーンショットで見せる**：作業の終わりに、その瞬間のスクリーンショットを撮り（動きなら `npm run film` で連続フレーム。その版で実行した ab の結果を `--run` に渡すと、記録にある場面の tick で撮れる）、セッションの中でユーザーに送って見せる。画像は build/ に置き、コミットしない。撮れないときは理由を書く。
- **発生回数を確かめる**：25日に一度も起きない場面は、見る人にとって存在しないのと同じ。見せたい場面がシードごとに何回起きたか（compare.md と advreport の表。数え方は tools/analysis/lib/moments.ts）を、A/B 比較の標準の指標にする。目安は「16シード中12シード以上で、25日に1回以上、できれば数回」。ごくまれな特別イベント（骨の竜など）は対象外。新しい場面を作ったら moments.ts に数え方を足す。
- **画面に出ない仕組みを見つけたら**：小さな修正で見せられるものはその場で直し、大きなものは PR の説明に挙げる。
- **報告は PR の説明に書く**：狙い、見せたい場面とその発生回数、A/B 比較の要点、まだ見えない所。docs/ には報告も比較の表も置かない（docs/ に置くのは、今も使う説明と、README の画像 docs/img/readme-*.png だけ）。

```bash
npm run film -- --seed abc --at 12.3 --frames 6 --every 40 --follow party:12345 --name adv-enter   # → build/img/<name>.png
```

## 最初に知っておくこと

- **決定性**：同じシードからは必ず同じ展開になる。乱数はハッシュ関数（`ih(a, b, salt)` など）で作り、`Math.random` は描画にだけ使う。
- **セーブ／ロード後の再現性**：セーブしてロードし直しても、その後の展開が一致しなければならない。シミュレーションの状態を足したら、必ずシリアライズに入れる（`Ecology.serialize/restore` または `WorldState`）。セーブしない描画専用の状態（血の跡、土ぼこり、演出など）を、シミュレーションの判断に使ってはいけない。
- **保存則（invariant）**：次の四つは常に成り立つ。崩れたらバグ。
  - 養分：`totalNutrients() − 初期値 − imported + exported − born + washed = 0`
  - 金貨：`totalGold() − 初期値 − goldIn + goldOut = 0`
  - 岩：`rockLedger() === initialRock`
  - マナ：`totalMana() − manaBorn + manaLeaked + manaFaded = 0`（地面のマナ `world.mana` と、生き物が持つマナ `Cr.mana` の合計）
- **キャッシュの無効化の条件**：セーブしないキャッシュ（明るさのマップ `litMap`、つながった洞窟の領域 `regionMap`、夜露のマップ `dewMap`、群れの識別 `Cr.gk` など）は、tick 番号か生き物の更新の番号（`Ecology.step`）か地形変更ログの長さ（`digs.length`）だけで作り直しを決める。「最後に作ってから何 tick たったか」で決めると、ロードし直したときに結果がずれる（実際に何度も起きた）。
- 時間：`TICKS_PER_SEC = 10`。ゲーム内の1日は `DAY_TICKS = 14400` tick（通常速度で24分）。生き物は `CR_EVERY = 2` tick ごとに更新する（更新の通し番号は `Ecology.step`。生き物の処理の間隔や経過は、多くがこの回数で決まる）。マップ：192×144 タイル、1タイル16px（src/mapgen.ts の `MapData`）。

## コマンドと分析の流れ

分析ツールはすべて `node tools/analysis/launch.mjs <ツール名>` から起動する（npm run も同じ）。**各ツールの使い方は、そのファイルの先頭のコメント**（tools/analysis/*.ts）にある。
実行結果と日次スナップショットは、シミュレーションのソースのハッシュごとのキャッシュ `runs/.cache/` に残り、ソースとシードが同じならどのツールからも再利用される（しくみは docs/rework-tools.md。大きくなったら消してよい）。クラウドのセッションでは、SessionStart フックが main のキャッシュを GitHub Release「sim-cache」からバックグラウンドで取得する（ログは runs/.cache/fetched/log.txt）。
- **main のキャッシュは手元で作らず、Release を待つ**：マージ直後で Release に無いとき（ログの「Release にまだない」は、フックが動いた時点の話）は、Actions の simcache の実行が終わってから `node tools/analysis/simcache.mjs fetch --ref origin/main` で取得し直す。手元で作るよりずっと速く、中身は同じ。待つ間に、main のコードで batch や probe を実行しない。キャッシュの同じフォルダに書きかけのログが残り、あとで取得したものと混ざって、ログが二重になる。待つ間は、コードを読めば分かる直しを実装し、typecheck と test まで進めておく。
- **Node の版は `.node-version` の1か所だけに書く**：CI（setup-node）も、手元（mise や fnm なら、リポジトリに入ると自動でこの版になる）も、クラウドの環境のセットアップスクリプトも、このファイルを読む。`.nvmrc` など別のファイルに版を書き足さない。

```bash
npm install                       # 初回のみ（クラウドのセッションでは SessionStart フックが入れる）
npm test                          # 決定性・保存則・ロード後の再現性など（約10秒。TEST_FULL=1 で0日目から）
npm run typecheck                 # 使っていない変数・引数もエラー（tsconfig の noUnusedLocals / noUnusedParameters。要る引数は名前を _ で始める）
npm run lint                      # Biome の推奨ルール一式（警告もエラー）。このリポジトリで意図して書いている形とぶつかるものだけ止めている（biome.json）。フォーマッタは使わない
npm run build                     # dist/index.html（外部依存なしの1ファイル。dist はコミットしない）
npm run dev                       # 開発サーバー（http://localhost:8000/。src を書き換えると作り直して、ページを読み込み直す）
```

lint の自動修正は `npx biome lint --write`（使っていない import の削除などは `--unsafe` も要る。`--unsafe` の修正は `a && a.b` を `a?.b` にするなど意味が変わりうるので、src に当てたら ab で出力が変わらないか確かめる）。

通常の作業の流れ：

0. main と比べる前に、`git fetch origin main` で main を最新にし、作業ブランチに最新の main が入っているかを確かめる（`git merge-base --is-ancestor origin/main HEAD`。入っていなければ取り込む）。ずれていると、ほかの PR の変更まで差に混ざり、main のキャッシュも使われず、CI の check（main の10日目から）とも結果が合わない。
1. 変更したら `npm test` と `npm run check -- --base origin/main`（CI と同じく main の10日目から。付けないと HEAD から始まり、CI と結果が分かれる）。コミットは両方が通ってから（`&&` でつなぎ、落ちたら止まるようにする）。check は、新しい挙動が実際に起きるかを確かめる短いテスト（項目は tools/analysis/checks.ts）。新しい挙動を足したら項目を足す。1〜2シードの出来事で決まる項目は、ほかの変更で展開が分かれただけで落ちるので、既に実行している組（`RUN_WIDE` の15シードなど）の合計で見る。
2. `npm run ab -- --preset quick`：8シードについて、HEAD の10日目のスナップショットから、HEAD と作業ツリーのそれぞれで18日目まで実行し、同じシード同士で比べる（結果は `runs/ab-quick-<日時>/compare.md`）。**判定が「はっきり」の行だけを効果とみなす**。「ばらつきの内」は、シードごとの展開のばらつきで説明できる程度の差という意味。1シードの出来事に引っ張られていないか「1シードの寄与」の列も見る。1シードだけでは効果は判断できない。
   「はっきり」は差があるという意味で、問題があるという意味ではない。差が問題かどうかは、下の「差が問題かどうかの見分け方」で判断し、その判断を PR の説明に書く。
   **差が問題かどうかの見分け方**：
   - **画面で困るか**：見る人にとって、種が画面から消える、場面が起きなくなる、生き物が動けなくなる、のどれかになるか。数が少し減っただけなら問題ではない。
   - **数か、出入りか**：生まれた数・来た数・死んだ数などの出入りがはっきり変わっても、数そのもの（最後の数、群れや住処の数）がばらつきの内なら、多くは補い合っているだけ（例：倒される数が減れば、補う出入りも減る）。
   - **どれだけの時間か**：「0匹だった日数」のような数は、全体（16シード×日数）に対する割合と、いちばん長く続いたシードで見る。
   - **1シードの寄与**：差の大半が1シードから来ていれば、そのシードで何が起きたか（例：ドラゴンがいたかどうか）を見てから判断する。版をまたいで同じ向きに出る差でも、main 側の1シードの大きな出来事を、分岐のあとで失っているだけのことがある（base と new のシードごとの数を並べる）。
   - **原因を切り分ける**：作業ツリーで新しい仕組みを止めて（例：その種が来ないようにして）もう一度比べ、差が残るか消えるかを見る。ただし、止めたこと自体が別の変更になるので、main との違いがどこから始まったか（`ab` の「何日目のログから違う」）も合わせて見る。
3. 気になるものは `npm run probe -- deaths|life|calls|look|stuck` で調べる（スナップショットから始めるので数秒で動き出す）。使い捨てのスクリプトを書く前に、probe の `--expr` で足りないか見る。スクリプトが要るなら、`lib/open.ts` の `openAt(シード, tick)` でその時点の状態を取得する。ログに無い値は、まず `npm run metric`（日次スナップショットから計算する）で足りるか見て、足りなければ sim.ts のログ出力に足す。
4. 区切りがついたら `npm run ab -- --preset final`（16シード×25日、0日目から）で最終確認する。保存則のずれは compare.md の末尾に出る。ab はシードごとの report.md を作らないので、「おかしな兆候」は続けて `npm run batch -- --seeds 16 --days 25` で見る（ab の実行結果をキャッシュから使う。兆候の数は summary.md）。
5. 保存則がずれたら、`tools/analysis/drift.ts`・`manacheck.ts`・`goldcheck.ts` で、ずれた tick と、その tick に変化した生き物を特定する。

```bash
npm run ab -- --base HEAD~1 --seeds abc,かしたれ,seed4,seed7 --days 10   # 挙動を変えないはずのリファクタリング：出力が1バイトも違わないか（違えば終了コード 1）
npm run ab -- --resume-check 7 --seeds かしたれ --days 10              # 7日目で中断・再開しても、通しで実行したときと一致するか
npm run bench -- --repeat 3                                            # 実行速度。変更の前後は続けて測る
```

ログファイル（settle.jsonl、samples.jsonl、deaths.jsonl など）の形式は docs/records.md。

## ビジュアルの確認

```bash
npm run gallery -- --label before    # 変更前に撮って build/gallery/before/ に残す
npm run gallery -- --compare before  # 変更後、before と左右に並べた build/gallery/compare-before.png を作る
node tools/gallery/shoot.mjs --only dragon,camp     # 一部のシーンだけ撮り直す（先に node build.mjs）
npm run shot -- --seed かしたれ --find warren         # 見たいものが現れるまで進めて撮る（build/shots/）
```

シーンの定義は `tools/gallery/scenes.ts` の `SCENES`。見た目は数値では測れないので、必ず画像を見て判断する（一か所を直すと別のシーンが崩れることがある）。古い dist で撮らないよう、`node build.mjs` を忘れない。
URL の末尾に `#lit`（全体を明るくする）、`#albedo`（地形の色だけ）、`#clean`（UI を隠す）、`#fxdemo`（攻撃エフェクトの見本）を付けられる。`#clean,lit` のように組み合わせてもよい。

## デプロイ（Cloudflare Workers の静的アセット）

設定は `wrangler.jsonc`（`dist/` をそのまま配信）と `.github/workflows/deploy.yml`。PR では typecheck・lint・test・check（main の10日目のスナップショットから）が走り、プレビュー URL（エイリアス `pr-<番号>`）が PR にコメントされる。main への push で本番にデプロイする。Secrets（`CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_ACCOUNT_ID`）が無ければデプロイだけスキップする。設定の確認は `npm run build && npx wrangler deploy --dry-run`。

## ソースの構成

| ファイル | 中身 |
|---|---|
| src/mapgen.ts | 地形の生成（洞窟、水路、溶岩、苔、養分、宝物庫、深部、ミノタウロスの寝床、閉じた空洞） |
| src/world.ts | 世界の1 tick の更新（水、養分、熱、苔、キノコ、光、掘削、瓦礫、崩落、マナの流れ `manaStep`）。地形変更ログ `digs`（値は `k*8+種類`。種類は 0 掘削 / 1 瓦礫 / 2 崩落 / 3 風化 / 4 石畳） |
| src/ecology.ts | 生き物全体を持つクラス Ecology の本体：状態のフィールド、セーブしないキャッシュ、定数（種ごとの性質 `SPEC`、強さ `STR`、賢さの段階 `TIER` など）、型。メソッドはここには無い |
| src/eco/*.ts | Ecology のメソッドを、種や仕組みごとに分けたもの（rat、kobold、goblin、orc、adventurer、aim、raid、cache、listen、loot、roster、dwarf、dragon、step、move、senses、groups、sleep、combat、arrivals、save など）。src/eco/index.ts がすべてを読み込む |
| src/eco/spawndef.ts, generate.ts | 野の魔物の湧き方の表（どちらの資源から・どこに・何匹・体と胃とマナ）と、表を見て湧かせる共通の仕組み。外から来るのは冒険者・ドワーフ・ワイバーンだけで、野の魔物は土の養分とマナから湧く。種を足すときは表に一行足す |
| src/sprites.ts, atlas.ts | ドット絵のパーツと、それをまとめたテクスチャアトラス |
| src/creatureView.ts, renderer.ts, shaders.ts | 描画 |
| src/main.ts | メインループ、UI、セーブ |
| test/*.ts | テスト |
| tools/gallery/ | ビジュアル確認（scenes.ts・shoot.mjs：固定シーンの一覧、shot.ts：探して撮る、film.mjs：連続フレーム） |
| tools/analysis/ | 分析ツール（入口は launch.mjs）。共通部品は lib/（engine.ts 実行、state.ts 状態の読み書き、runs.ts キャッシュ、open.ts スナップショットの取得、stats.ts A/B 比較の判定、seeds.ts 固定のシードの組、moments.ts 見せたい場面の数え方） |
| tools/export-sprites.ts | 生き物のドット絵を、PNG のスプライトシートと各フレームの位置の JSON に書き出す（`npm run export-sprites` → build/sprites/。コミットしない） |

## 変更するときの注意

- 物音（`noise`）と、冒険者の体力の削れ（一行の強さの見積もり `partyStr` は残りの体力を掛ける）は、冒険者の聞き耳・ほかの種の寄り方・オークの見極めに波及する。足したら A/B で確かめる。
- 生き物や物が「消える」「現れる」経路を足したら、保存則の出入り（imported / exported / born / washed / goldIn / goldOut / 岩）と、統計（`stats` の deaths / births / exits）の両方に記録する。
- Ecology にメソッドを足すときは、種や仕組みに合う src/eco/*.ts に `export function 名前(this: Ecology, …)` で書き、そのファイルの末尾の `declare module` と `Object.assign` に名前を足す。新しいファイルなら src/eco/index.ts に import を足す。
- 速度のための間引き：
  - ウィスプ（光の精を除く）は、4回の更新に1回だけ行動を決め、その回にまとめて4回分動く（`WISP_EVERY`）。残りの3回は代謝だけ。`px` は動く前の位置のまま残し、描画の補間に使う。
  - 苔とキノコは40 tick ごとに2回分まとめて進める。確率や増減を足すときは `MOSS_R` 倍にする。
  - 画面なしの実行では、プレイヤーに見えたタイルの更新が200 tick ごとになる。なので、見えたタイルを生き物の判断に使わない。
  - 見送った案：生き物の更新を4 tick ごとにすると約3割速くなるが、来訪や繁殖などの間隔が生き物の更新の回数で決まっているため、展開が大きく変わる。やるなら、その間隔をゲーム内の時間に合わせて直してから。
- `false &&` で古い処理を止めると、TypeScript の型の絞り込みで別の箇所が型エラーになることがある。止めるなら処理ごと消す。
