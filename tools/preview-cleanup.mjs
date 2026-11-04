// 閉じた PR のプレビューのバージョンを Cloudflare から消す（.github/workflows/preview-cleanup.yml から使う）。
//
// PR のプレビューは、deploy.yml が `wrangler versions upload --message "PR #<番号> <コミット>"` でアップロードした、
// 本番に出さないバージョン。wrangler にはバージョンを消すコマンドが無いので、Cloudflare の API を直接呼ぶ
// （一覧 GET / 削除 DELETE /accounts/{アカウント}/workers/workers/{Worker}/versions）。
// どの PR のものかは、アップロードのときのメッセージ（annotations の workers/message）の先頭の「PR #<番号> 」で見分ける。
// 本番のデプロイに使われている（または使われた）バージョンは消さない。
//
//   node tools/preview-cleanup.mjs --pr 32        # PR #32 のバージョンを消す
//   node tools/preview-cleanup.mjs --closed       # 今開いていない PR のバージョンをすべて消す（溜まった分の掃除。GitHub の API で開いている PR を調べる）
//   node tools/preview-cleanup.mjs --closed --dry-run   # 消さずに、消す予定のものを表示するだけ
//
// 要る環境変数：CLOUDFLARE_API_TOKEN（Workers Scripts の書き込み権限）、CLOUDFLARE_ACCOUNT_ID。
// --closed のときは GITHUB_TOKEN と GITHUB_REPOSITORY（owner/repo）も。Worker の名前は WORKER（既定 moss-and-gold）。

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const opt = (n) => {
  const i = args.indexOf(n);
  return i >= 0 ? args[i + 1] : undefined;
};
const dry = flag('--dry-run');
const prArg = opt('--pr');
const closedMode = flag('--closed');
if (!prArg === !closedMode) {
  console.error('--pr <番号> か --closed のどちらか一つを指定する');
  process.exit(2);
}

const { CLOUDFLARE_API_TOKEN: token, CLOUDFLARE_ACCOUNT_ID: account } = process.env;
const worker = process.env.WORKER || 'moss-and-gold';
if (!token || !account) {
  console.error('CLOUDFLARE_API_TOKEN と CLOUDFLARE_ACCOUNT_ID が要る');
  process.exit(2);
}
const base = `https://api.cloudflare.com/client/v4/accounts/${account}`;

async function cf(method, path) {
  const res = await fetch(base + path, { method, headers: { Authorization: `Bearer ${token}` } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.success === false) {
    const why = (body.errors || []).map((e) => `${e.code} ${e.message}`).join('; ') || res.statusText;
    throw new Error(`${method} ${path} → ${res.status} ${why}`);
  }
  return body;
}

/** Worker のバージョンをすべて取得する（新しい順に1ページ100件ずつ、空のページが来るまで） */
async function allVersions() {
  const out = [];
  for (let page = 1; ; page++) {
    const r = await cf('GET', `/workers/workers/${worker}/versions?page=${page}&per_page=100`);
    const list = r.result || [];
    out.push(...list);
    if (list.length < 100) break;
  }
  return out;
}

/** 本番のデプロイの履歴に出てくるバージョン（消さない） */
async function deployedIds() {
  const r = await cf('GET', `/workers/scripts/${worker}/deployments`);
  const ids = new Set();
  for (const d of r.result?.deployments || []) for (const v of d.versions || []) ids.add(v.version_id);
  return ids;
}

/** GitHub で今開いている PR の番号 */
async function openPrs() {
  const { GITHUB_TOKEN: gh, GITHUB_REPOSITORY: repo } = process.env;
  if (!gh || !repo) throw new Error('--closed には GITHUB_TOKEN と GITHUB_REPOSITORY が要る');
  const nums = new Set();
  for (let page = 1; ; page++) {
    const res = await fetch(`https://api.github.com/repos/${repo}/pulls?state=open&per_page=100&page=${page}`, {
      headers: { Authorization: `Bearer ${gh}`, Accept: 'application/vnd.github+json' },
    });
    if (!res.ok) throw new Error(`GitHub の PR の一覧 → ${res.status}`);
    const list = await res.json();
    for (const p of list) nums.add(p.number);
    if (list.length < 100) break;
  }
  return nums;
}

const prOf = (v) => {
  const m = /^PR #(\d+) /.exec(v.annotations?.['workers/message'] ?? '');
  return m ? Number(m[1]) : null;
};

const versions = await allVersions();
const deployed = await deployedIds();
const keepOpen = closedMode ? await openPrs() : null;
const target = (n) => (prArg ? n === Number(prArg) : !keepOpen.has(n));

const doomed = versions.filter((v) => {
  const n = prOf(v);
  return n !== null && target(n) && !deployed.has(v.id);
});
console.log(`バージョン ${versions.length} 件のうち、消すもの ${doomed.length} 件${dry ? '（--dry-run なので消さない）' : ''}`);

let failed = 0;
for (const v of doomed) {
  const label = `${v.id}（${v.annotations['workers/message']}、${v.created_on}）`;
  if (dry) {
    console.log(`  消す予定 ${label}`);
    continue;
  }
  try {
    await cf('DELETE', `/workers/workers/${worker}/versions/${v.id}`);
    console.log(`  消した ${label}`);
  } catch (e) {
    // 消せないもの（デプロイに使われているなど）は飛ばして、ほかを続ける
    failed++;
    console.log(`  消せなかった ${label}：${e.message}`);
  }
}
const ok = doomed.length - failed;
if (process.env.GITHUB_OUTPUT) {
  const fs = await import('node:fs');
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `deleted=${dry ? 0 : ok}\nfailed=${failed}\n`);
}
// 一つも消せなかったときだけ失敗にする（一部が消せないのはデプロイの履歴にあるものなどで、異常ではない）
if (!dry && doomed.length > 0 && ok === 0) process.exit(1);
