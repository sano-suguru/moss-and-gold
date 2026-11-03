#!/usr/bin/env node
/**
 * 分析ツールをビルドして実行する：node tools/analysis/launch.mjs <ツール名> [引数...]
 * （npm run sim / batch / probe などはこれを通る）。
 * ビルドしたものは runs/.cache/bin/<ツール名>-<中身のハッシュ>.js に置き、中身が同じなら再ビルドしない。
 * --ref <git の参照> を最初に置くと、そのコミットの src/ でビルドする（ログの出し方は作業ツリーのツールのもの）。
 */
import { spawn } from 'child_process';
import { bin } from './lib/bins.mjs';

const argv = process.argv.slice(2);
const name = argv.shift();
let ref = 'cur';
if (argv[0] === '--ref') {
  argv.shift();
  ref = argv.shift();
}
const b = await bin(name, ref);
const p = spawn(process.execPath, [b.path, ...argv], { stdio: 'inherit' });
p.on('exit', (code, sig) => process.exit(code ?? (sig ? 1 : 0)));
