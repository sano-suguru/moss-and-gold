---
name: visual-check
description: 見た目や動きの確認：ギャラリーの固定シーンの撮影と前後比較、見たいものが現れるまで進めて撮る shot、連続フレームの film、URL の表示切り替え。描画やドット絵を変えたとき、作業の終わりにスクリーンショットをユーザーに見せるときに使う。
---

# ビジュアルの確認

古い dist で撮らないよう、先に `node build.mjs`。見た目は数値では測れないので、必ず画像を見て判断する（一か所を直すと別のシーンが崩れることがある）。画像は build/ に置き、コミットしない。

```bash
npm run gallery -- --label before    # 変更前に撮って build/gallery/before/ に残す
npm run gallery -- --compare before  # 変更後、before と左右に並べた build/gallery/compare-before.png を作る
node tools/gallery/shoot.mjs --only dragon,camp     # 一部のシーンだけ撮り直す
npm run shot -- --seed かしたれ --find warren         # 見たいものが現れるまで進めて撮る（build/shots/）
npm run film -- --seed abc --at 12.3 --frames 6 --every 40 --follow party:12345 --name adv-enter   # 連続フレーム → build/img/<name>.png
```

- シーンの定義は `tools/gallery/scenes.ts` の `SCENES`。
- film は、その版で実行した ab の結果を `--run` に渡すと、記録にある場面の tick で撮れる。
- URL の末尾に `#lit`（全体を明るくする）、`#albedo`（地形の色だけ）、`#clean`（UI を隠す）、`#fxdemo`（攻撃エフェクトの見本）を付けられる。`#clean,lit` のように組み合わせてもよい。
