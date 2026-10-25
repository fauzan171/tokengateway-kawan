#!/bin/bash
# Kawanku harness (chat-first rebrand) di production tunnel.
# Branch feature/kawanku-chat-agents; host 127.0.0.1 supaya hanya lewat
# tunnel cloudflared (kawanku.tokengateway.ai.id). --trusted-host membuka
# Host fence /api untuk authority tunnel.
# KAWANKU_LOGIN_SECRET (`salt:hash` scrypt) mengaktifkan form login;
# tanpa env ini hanya token URL launch yang berlaku.
# Generate: node /tmp/gen-secret.mjs <password> (script lokal, jangan commit).
cd /home/hermes/workspace/projects/tokengateway-kawan/.agents/worktrees/feature/kawanku-chat-agents/kawanku-harness || exit 1
export PATH="$HOME/.local/node24/bin:$PATH"
export KAWANKU_LOGIN_SECRET="$(cat /home/hermes/.kawanku-login-secret.txt 2>/dev/null)"
exec pnpm dsh web --no-open --host 127.0.0.1 --port 3082 \
  --public-url https://kawanku.tokengateway.ai.id \
  --trusted-host kawanku.tokengateway.ai.id
