# クラウド環境の準備のスクリプト（Claude Code on the web の環境設定に貼る）

```bash
#!/bin/bash
set -euo pipefail
cd /home/user/moss-and-gold
npm ci
```

通信の設定は「信頼できるドメインのみ」で足りる（npm から esbuild と typescript を取ってくるだけ）。
スクショ（npm run gallery、npm run shot）は Node の Playwright で撮る。クラウド環境には Node の Playwright と Chromium が最初から入っているので、追加の準備は要らない（Python の Playwright も要らない）。
手元の環境で撮るときは、Node の Playwright と Chromium を入れる（`npm i -g playwright && npx playwright install chromium` など）。
