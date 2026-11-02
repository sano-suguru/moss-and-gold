# クラウド環境の準備のスクリプト（Claude Code on the web の環境設定に貼る）

```bash
cd /home/user/moss-and-gold && npm ci   # 準備のスクリプトはリポジトリの中で動くとは限らないので、先に移る
```

通信の設定は「信頼できるドメインのみ」で足りる（npm から esbuild と typescript を取ってくるだけ）。
スクショの一覧（npm run gallery）も使うなら、追加で `pip install playwright && python3 -m playwright install chromium`（通信の設定で止まることがある）。
