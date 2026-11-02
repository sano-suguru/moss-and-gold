#!/usr/bin/env node
/**
 * 分析の道具を組み立てて回す：node tools/analysis/launch.mjs <道具> [引数...]
 * （npm run sim / batch / probe などはこれを通る）。
 * 組み立てたものは runs/.cache/bin/<道具>-<中身のハッシュ>.js に置き、中身が同じなら組み立て直さない。
 * --ref <git の参照> を最初に置くと、その版の src/ で組み立てる（記録の仕方はいまのもの）。
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
