#!/bin/bash
set -e
REPO="$HOME/dev/kcal-mobile"; N="$REPO/.claude/night"; cd "$REPO/.claude/worktrees/g23-s1"
git pull --ff-only
while [ ! -f docs/night/G55-S1-DONE ]; do echo "G55 bekleniyor..."; sleep 120; git pull --ff-only || true; done
caffeinate -dimsu -t 21600 &
claude --bg --name G56-S1-eatkcal-siparis --permission-mode auto --settings "$N/settings.json" --mcp-config "$N/mcp.json" --strict-mcp-config "/goal $N/G56-S1.md dosyasindaki bolumler (0-6, paket haric) release/1.1.0 dalinda commit edildi; testler ve iki platform expo export geciyor; ekran goruntuleri docs/night/g56 altinda; son commit GERCEK dosya docs/night/G56-S1-DONE"
