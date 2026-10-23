#!/bin/bash
# Installs the weekly publish job (Friday 19:00 local time, one hour after the
# extension's 18:00 collection). Copies the tools to ~/kcal-platform-tools so the
# job does not depend on which branch is checked out in kcal-mobile.
set -euo pipefail
SRC="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$HOME/kcal-platform-tools"
PLIST="$HOME/Library/LaunchAgents/com.kcal.platform-publish.plist"
PY="$(command -v python3)"

mkdir -p "$DEST/normalize" "$DEST/publish" "$HOME/kcal-reports/platform_data"
cp "$SRC/normalize/normalize.py" "$DEST/normalize/"
cp "$SRC/publish/weekly_publish.py" "$DEST/publish/"

cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.kcal.platform-publish</string>
  <key>ProgramArguments</key>
  <array>
    <string>$PY</string>
    <string>$DEST/publish/weekly_publish.py</string>
  </array>
  <key>StartCalendarInterval</key>
  <dict><key>Weekday</key><integer>5</integer><key>Hour</key><integer>19</integer><key>Minute</key><integer>0</integer></dict>
  <key>EnvironmentVariables</key>
  <dict><key>PATH</key><string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string></dict>
  <key>StandardOutPath</key><string>$HOME/kcal-reports/platform_data/publish.log</string>
  <key>StandardErrorPath</key><string>$HOME/kcal-reports/platform_data/publish.log</string>
</dict>
</plist>
EOF

launchctl bootout "gui/$(id -u)/com.kcal.platform-publish" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
echo "Kuruldu: her Cuma 19:00 → $DEST/publish/weekly_publish.py (log: ~/kcal-reports/platform_data/publish.log)"
