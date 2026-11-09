#!/bin/bash
# G20-S2 md.4 — Mağaza ekran görüntüleri (G14 vitrini üzerinden).
#
# Ne yapar:
#   1. Disk kontrolü (varsayılan ≥ 20 GB boş; GECE19-ORTAK kuralı). Altındaysa ÇEKMEZ, çıkar (kod 2).
#   2. "Store 6.9 iPhone" (iPhone 17 Pro Max, 1320×2868) ve "Store 6.5 iPhone" (iPhone 11 Pro Max,
#      1242×2688) simülatörlerini yoksa oluşturur, açar, mevcut dev client'ı kurar (DERLEME YAPMAZ).
#   3. scripts/store/captions.json'daki 8 kareyi TR ve EN vitrin panolarıyla çeker
#      (scripts/dev/g14-shots.sh, G14_MODE=storage → Erişilebilirlik izni gerekmez).
#   4. Çıktıyı sıralı adlandırır: $OUT/raw/<boyut>/<dil>/01-tara.png …
#   5. Android: 6.9" ham kareden durum çubuğu + ev çizgisi kırpılır, 1080×2160'a (2:1) küçültülür
#      ($OUT/raw/android/<dil>/). Play 2:1 üst sınırı (en uzun kenar ≤ 2 × kısa kenar).
#   6. STORE_COMPOSE=1 ise başlıklı mağaza kareleri: scripts/store/compose-frames.mjs (Chrome başsız).
#
# Ön koşullar (CLAUDE.md "Yerel iOS geliştirme"):
#   - Metro açık:  npx expo start --dev-client --port ${STORE_METRO_PORT:-8081}
#   - Dev client derlenmiş (DerivedData'da Kcalculate.app). Betik derleme YAPMAZ.
#   - İlk kurulumda uygulama bir kez açılıp Metro'ya bağlanmalı (dev client listesinden sunucuyu seç);
#     betik bunu bekler (Enter).
#
# Kullanım:
#   scripts/store/store-shots.sh                # iki iPhone boyutu, TR + EN, Android türetme
#   STORE_SIZES="ios-69" STORE_LANGS="tr" scripts/store/store-shots.sh
#   STORE_COMPOSE=1 scripts/store/store-shots.sh
# Ortam: STORE_OUT (varsayılan .claude/night/out/store), STORE_MIN_FREE_GB (20), STORE_WAIT (6 sn).
# İlter'in simülatörüne (CLAUDE.md UDID 31E99C6C…) DOKUNMAZ — yalnız "Store …" adlı cihazlar.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
export DEVELOPER_DIR="${DEVELOPER_DIR:-/Applications/Xcode-26.app/Contents/Developer}"
export PATH="/opt/homebrew/opt/node@20/bin:$PATH"

OUT="${STORE_OUT:-$ROOT/.claude/night/out/store}"
MIN_FREE_GB="${STORE_MIN_FREE_GB:-20}"
SIZES="${STORE_SIZES:-ios-69 ios-65}"
LANGS="${STORE_LANGS:-tr en}"
BUNDLE_ID="com.kcalmobile.app"
CAPTIONS="$ROOT/scripts/store/captions.json"

# 1) Disk
FREE_GB="$(df -g / | awk 'NR==2 {print $4}')"
if [ "$FREE_GB" -lt "$MIN_FREE_GB" ]; then
  echo "Boş disk ${FREE_GB} GB < ${MIN_FREE_GB} GB — çekim yapılmadı (STORE_MIN_FREE_GB ile değiştirilebilir)." >&2
  exit 2
fi

# Metro ayakta mı?
PORT="${STORE_METRO_PORT:-8081}"
if ! curl -s "http://localhost:$PORT/status" | grep -q "packager-status:running"; then
  echo "Metro $PORT portunda çalışmıyor: npx expo start --dev-client --port $PORT" >&2
  exit 1
fi

APP="$(ls -d "$HOME"/Library/Developer/Xcode/DerivedData/Kcalculate-*/Build/Products/Debug-iphonesimulator/Kcalculate.app 2>/dev/null | head -1 || true)"
if [ -z "$APP" ]; then
  echo "Dev client yok (DerivedData/…/Kcalculate.app). CLAUDE.md komut 1 ile derle (disk ≥ 20 GB)." >&2
  exit 1
fi

# captions.json → "<id>\t<pano>" satırları (dil başına)
frames_for() {
  node -e '
    const c = require(process.argv[1]); const lang = process.argv[2];
    for (const f of c.frames) console.log(f.id + "\t" + f.pano[lang]);
  ' "$CAPTIONS" "$1"
}
size_field() { node -e 'const c=require(process.argv[1]);console.log(c.sizes[process.argv[2]][process.argv[3]])' "$CAPTIONS" "$1" "$2"; }

ensure_sim() { # $1 ad, $2 cihaz türü kısa adı
  local name="$1" type="com.apple.CoreSimulator.SimDeviceType.$2" udid
  udid="$(xcrun simctl list devices | grep "    $name (" | head -1 | sed -E 's/.*\(([0-9A-F-]{36})\).*/\1/' || true)"
  if [ -z "$udid" ]; then
    local rt
    rt="$(xcrun simctl list runtimes | grep -E '^iOS 26\.' | tail -1 | sed -E 's/.* - (com\.apple\.[^ ]+).*/\1/')"
    udid="$(xcrun simctl create "$name" "$type" "$rt")"
    echo "oluşturuldu: $name ($udid)" >&2
  fi
  xcrun simctl boot "$udid" > /dev/null 2>&1 || true
  xcrun simctl bootstatus "$udid" -b > /dev/null
  echo "$udid"
}

for SIZE in $SIZES; do
  SIM="$(size_field "$SIZE" sim)"
  DEV="$(size_field "$SIZE" device)"
  UDID="$(ensure_sim "$SIM" "$DEV")"
  xcrun simctl install "$UDID" "$APP"
  xcrun simctl ui "$UDID" appearance light
  DATA="$(xcrun simctl get_app_container "$UDID" "$BUNDLE_ID" data)"
  MANIFEST="$DATA/Library/Application Support/$BUNDLE_ID/RCTAsyncLocalStorage_V1/manifest.json"
  if [ ! -f "$MANIFEST" ]; then
    xcrun simctl launch "$UDID" "$BUNDLE_ID" > /dev/null
    open -a Simulator
    read -r -p "[$SIM] Dev client'ta localhost:$PORT sunucusunu seç, ana ekran gelince Enter… " _
  fi
  for LANG in $LANGS; do
    RAW="$OUT/raw/$SIZE/$LANG"
    TMP="$OUT/.tmp/$SIZE/$LANG"
    mkdir -p "$RAW" "$TMP"
    PANOS="$(frames_for "$LANG" | cut -f2 | tr '\n' ' ')"
    # shellcheck disable=SC2086
    G14_UDID="$UDID" G14_MODE=storage G14_WAIT="${STORE_WAIT:-6}" G14_OUT="$TMP" \
      "$ROOT/scripts/dev/g14-shots.sh" $PANOS
    while IFS=$'\t' read -r ID PANO; do
      cp "$TMP/$PANO.png" "$RAW/$ID.png"
      echo "ok $SIZE/$LANG/$ID ($PANO) $(sips -g pixelWidth -g pixelHeight "$RAW/$ID.png" | awk '/pixel/ {printf "%s ", $2}')"
    done < <(frames_for "$LANG")
  done
done

# 5) Android: 6.9" kareden türet (1320×2868 → üst 162 px durum çubuğu + alt 66 px ev çizgisi kırp
#    → 1320×2640 = 2:1 → 1080×2160). Play: en uzun kenar ≤ 2 × kısa kenar; ≥ 1080 px (öne çıkarma için).
if echo "$SIZES" | grep -q "ios-69"; then
  for LANG in $LANGS; do
    SRC="$OUT/raw/ios-69/$LANG"
    DST="$OUT/raw/android/$LANG"
    mkdir -p "$DST"
    for f in "$SRC"/*.png; do
      b="$(basename "$f")"
      sips -c 2640 1320 --cropOffset 162 0 "$f" --out "$DST/$b" > /dev/null
      sips -z 2160 1080 "$DST/$b" > /dev/null
    done
    echo "android/$LANG: $(ls "$DST" | wc -l | tr -d ' ') kare (1080×2160)"
  done
fi

# 6) Başlıklı kareler (isteğe bağlı)
if [ "${STORE_COMPOSE:-0}" = "1" ]; then
  node "$ROOT/scripts/store/compose-frames.mjs" "$OUT"
fi
echo "Bitti → $OUT"
