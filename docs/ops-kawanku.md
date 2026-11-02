# OPS kawanku.tokengateway.ai.id (live 2026-10-30)

- App: `./run-dev.sh` di repo root, Next dev port 3010. JANGAN start dari subdir (DB path relatif, P2021).
- Tunnel: unit user `kawanku-tunnel.service` (enabled, linger=yes, Restart=always).
- Mode: config `~/.cloudflared/config.yml` + creds `~/.cloudflared/<tunnel-id>.json` (chmod 600).
- JANGAN pakai `--token run`: mode itu ingress dari dashboard, config lokal diabaikan = 503.
- Token tunnel = base64 JSON tunggal (bukan JWT): `{"a":account,"t":tunnel_id,"s":secret}`.
- Sehat = publik HTTP 200 + `x-powered-by: Next.js`, lokal 127.0.0.1:3010 200.
- Cek: `systemctl --user is-active kawanku-tunnel` + `curl -s -o /dev/null -w "%{http_code}" https://kawanku.tokengateway.ai.id/`
- Worker job queue (chat/agent): unit user `kawanku-worker.service` (enabled, Restart=always, `npm run worker`). Root cause chat diam 2026-10-30 = worker mati 10 jam (heartbeat 03:50 UTC), queue stuck.
- Cek: `systemctl --user is-active kawanku-worker` + `sqlite3 dev.db "SELECT substr(id,1,12), state FROM Job WHERE state IN ('queued','leased') LIMIT 5;"` (harus kosong).
- Log: app `~/.hermes/cache/scratch/kawan-dev.log`, worker `~/.hermes/cache/scratch/kawan-worker.log` (unit append kesana juga).
