#!/bin/bash
set -e
REPO="$HOME/dev/kcal-mobile"; N="$REPO/.claude/night"; cd "$REPO/.claude/worktrees/g23-s1"
git pull --ff-only || true
while [ ! -f docs/night/G61-S1-DONE ]; do echo "G61-S1 bekleniyor..."; sleep 120; git pull --ff-only || true; done
caffeinate -dimsu -t 21600 &
claude --bg --name G62-S1-siparis-degerlendir --permission-mode auto --settings "$N/settings.json" --mcp-config "$N/mcp.json" --strict-mcp-config "/goal $N/G62-S1.md dosyasindaki bolumler (1-2) release/1.1.0 dalinda commit edildi; testler ve iki platform expo export geciyor; ekran goruntuleri docs/night/g62 altinda; son commit GERCEK dosya docs/night/G62-S1-DONE"
