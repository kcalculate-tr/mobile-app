#!/bin/bash
set -e
REPO="$HOME/dev/kcal-mobile"; N="$REPO/.claude/night"; cd "$REPO/.claude/worktrees/g23-s1"
git pull --ff-only
caffeinate -dimsu -t 21600 &
claude --bg --name G58-S1-bayrak-turu --permission-mode auto --settings "$N/settings.json" --mcp-config "$N/mcp.json" --strict-mcp-config "/goal $N/G58-S1.md dosyasindaki bolumler (1-3) release/1.1.0 dalinda commit edildi; testler ve iki platform expo export geciyor; ekran goruntuleri docs/night/g58 altinda; LOG'da BAYRAK RAPORU var; son commit GERCEK dosya docs/night/G58-S1-DONE"
