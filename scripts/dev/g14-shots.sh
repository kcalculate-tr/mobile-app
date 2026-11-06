#!/bin/bash
# G14-S1 — Ekran vitrini ekran görüntüleri.
#
# Katalogdaki (src/dev/screenCatalog.ts) her pano için:
#   simctl ui appearance (light/dark) + content_size → simctl openurl
#   kcal://dev/screen/<Pano> → 3 sn bekle → simctl io screenshot
# Çıktı: .claude/night/out/g14/app/<Pano>.png
#
# Kullanım:
#   scripts/dev/g14-shots.sh                     # bütün katalog
#   scripts/dev/g14-shots.sh FinEkCart FinFeed-Dark   # yalnız verilenler
# Ortam:
#   G14_UDID   simülatör (varsayılan: "G14 iPhone" adlı cihaz) — İlter'in
#              simülatörüne DOKUNMAZ.
#   G14_WAIT   bekleme sn (varsayılan 3)
#   G14_OUT    çıktı klasörü
#   G14_MODE   storage → openurl/onay kutusu YOK: bekleyen pano adı uygulamanın
#              AsyncStorage manifest.json'una (g14-vitrin-pending) yazılır, uygulama
#              terminate + launch edilir (Erişilebilirlik izni gerekmez). Ön koşul:
#              uygulama bir kez açılıp Metro'ya bağlanmış olmalı (manifest var).
# Ön koşul: dev client kurulu + Metro açık (CLAUDE.md "Yerel iOS geliştirme").
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
export DEVELOPER_DIR="${DEVELOPER_DIR:-/Applications/Xcode-26.app/Contents/Developer}"
export PATH="/opt/homebrew/opt/node@20/bin:$PATH"

UDID="${G14_UDID:-$(xcrun simctl list devices | grep 'G14 iPhone (' | head -1 | sed -E 's/.*\(([0-9A-F-]{36})\).*/\1/')}"
if [ -z "$UDID" ]; then
  echo "G14 iPhone simülatörü yok: xcrun simctl create \"G14 iPhone\" \"iPhone 17 Pro\"" >&2
  exit 1
fi
# Panolar arası geçişte JS yeniden yüklenir (VitrinGate) → varsayılan 5 sn.
WAIT="${G14_WAIT:-5}"
OUT="${G14_OUT:-$ROOT/.claude/night/out/g14/app}"
mkdir -p "$OUT"

# Katalog satırları: <Pano>\t<scheme>\t<textSize>
LIST="$(cd "$ROOT" && npx --yes tsx scripts/dev/g14-catalog.ts "$@")"

xcrun simctl bootstatus "$UDID" -b > /dev/null
# Durum çubuğu sabit (karşılaştırma kararlı olsun).
xcrun simctl status_bar "$UDID" override --time 9:41 --batteryState charged --batteryLevel 100 \
  --cellularBars 4 --wifiBars 3 > /dev/null 2>&1 || true

# iOS 26: simctl openurl her seferinde "… ile Açılsın mı?" onayı soruyor.
# Simulator.app önde + Return = varsayılan "Aç" (Erişilebilirlik izni gerekir).
# G14_NO_PROMPT=1 → onay adımını atla.
accept_open_prompt() {
  [ "${G14_NO_PROMPT:-0}" = "1" ] && return 0
  sleep 1.2
  osascript -e 'tell application "Simulator" to activate' -e 'delay 0.3' \
    -e 'tell application "System Events" to key code 36' > /dev/null 2>&1 || true
}

MODE="${G14_MODE:-openurl}"
BUNDLE_ID="${G14_BUNDLE:-com.kcalmobile.app}"
MANIFEST=""
if [ "$MODE" = "storage" ]; then
  DATA="$(xcrun simctl get_app_container "$UDID" "$BUNDLE_ID" data)"
  MANIFEST="$DATA/Library/Application Support/$BUNDLE_ID/RCTAsyncLocalStorage_V1/manifest.json"
  [ -f "$MANIFEST" ] || { echo "manifest yok: $MANIFEST (uygulamayı bir kez aç)" >&2; exit 1; }
fi
set_pending() {
  python3 - "$MANIFEST" "$1" <<'PY'
import json,sys
p,pano=sys.argv[1],sys.argv[2]
m=json.load(open(p))
m['g14-vitrin-pending']=pano
m.pop('g15-vitrin-last',None)
json.dump(m,open(p,'w'),ensure_ascii=False,separators=(',',':'))
PY
}

LAST_SCHEME=""
LAST_SIZE=""
while IFS=$'\t' read -r PANO SCHEME SIZE; do
  [ -z "$PANO" ] && continue
  if [ "$SCHEME" != "$LAST_SCHEME" ]; then
    xcrun simctl ui "$UDID" appearance "$SCHEME"
    LAST_SCHEME="$SCHEME"
  fi
  if [ "$SIZE" != "$LAST_SIZE" ]; then
    xcrun simctl ui "$UDID" content_size "$SIZE"
    LAST_SIZE="$SIZE"
  fi
  if [ "$MODE" = "storage" ]; then
    xcrun simctl terminate "$UDID" "$BUNDLE_ID" > /dev/null 2>&1 || true
    set_pending "$PANO"
    xcrun simctl launch "$UDID" "$BUNDLE_ID" > /dev/null
  else
    xcrun simctl openurl "$UDID" "kcal://dev/screen/$PANO"
    accept_open_prompt
  fi
  sleep "$WAIT"
  xcrun simctl io "$UDID" screenshot --type=png "$OUT/$PANO.png" > /dev/null 2>&1
  echo "ok $PANO"
done <<< "$LIST"

xcrun simctl ui "$UDID" appearance light
xcrun simctl ui "$UDID" content_size large
